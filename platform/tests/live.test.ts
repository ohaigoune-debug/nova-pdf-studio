import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { auditLogs, courseEnrollments, courses, groups, jobs, liveSessions, notifications, teachers } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { unseal } from '@/server/lib/secret-box'
import { processQueuedJobs } from '@/server/jobs/runner'
import {
  attachRecording,
  createLiveSession,
  ensureLiveRemindersScheduled,
  joinInfo,
  listLiveAdmin,
  liveAttendance,
  runLiveRemindersJob,
  setLiveStatus,
  upcomingForStudent,
  updateLiveSession
} from '@/server/services/live.service'
import { createContent } from '@/server/services/content.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb, workspaceIdOfTeacher } from './helpers'

let h: DatabaseHandle
let admin: Actor
let teacher: Actor
let otherTeacher: Actor
let student: Actor
let noTerms: Actor
let outsider: Actor
let courseId: string
let workspaceId: string
const JOIN_URL = 'https://zoom.us/j/123456789?pwd=secret-pass'

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

beforeAll(async () => {
  process.env.SESSION_SECRET ??= 'test-session-secret'
  h = await setupDb()
  admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin, 'أستاذ الدورة')
  otherTeacher = await makeTeacher(h.db, admin, 'أستاذ آخر')
  student = await makeStudent(h.db, 'تلميذ مشترك')
  noTerms = await makeStudent(h.db, 'تلميذ بلا شروط')
  outsider = await makeStudent(h.db, 'تلميذ خارجي')
  workspaceId = await workspaceIdOfTeacher(h.db, teacher)
  const [t] = await h.db.select({ id: teachers.id }).from(teachers).where(eq(teachers.workspaceId, workspaceId))
  const [g] = await h.db.insert(groups).values({ workspaceId, teacherId: t!.id, name: 'فوج الدورة' }).returning()
  const [c] = await h.db
    .insert(courses)
    .values({ slug: 'bac-arabic-live', title: 'دورة البكالوريا', workspaceId, groupId: g!.id, season: '2026/2027', status: 'PUBLISHED', priceDzd: 5000 })
    .returning()
  courseId = c!.id
  await h.db.insert(courseEnrollments).values([
    { courseId, studentId: student.studentId!, status: 'ACTIVE', acceptedTermsAt: new Date(), acceptedTermsVersion: 1 },
    { courseId, studentId: noTerms.studentId!, status: 'ACTIVE' }
  ])
})

afterAll(async () => {
  await h.close()
})

describe('الحصص المباشرة: الإنشاء والإدارة', () => {
  it('المشرف ينشئ حصة: الرابط مختوم ولا يُخزَّن صريحاً، وتُسجَّل في التدقيق', async () => {
    const startsAt = new Date(Date.now() + 2 * 3600_000)
    const s = await createLiveSession(h.db, admin, { courseId, title: 'مراجعة النص الأدبي', startsAt, durationMinutes: 60, provider: 'ZOOM', joinUrl: JOIN_URL })
    expect(s.hasJoinUrl).toBe(true)
    expect('joinUrlSealed' in s).toBe(false)
    const [row] = await h.db.select().from(liveSessions).where(eq(liveSessions.id, s.id))
    expect(row?.joinUrlSealed).toBeTruthy()
    expect(row?.joinUrlSealed).not.toContain('zoom.us')
    expect(JSON.stringify(row)).not.toContain('secret-pass')
    expect(unseal(row!.joinUrlSealed!, 'live')).toBe(JOIN_URL)
    const audits = await h.db.select().from(auditLogs).where(and(eq(auditLogs.action, 'live.create'), eq(auditLogs.entityId, s.id)))
    expect(audits).toHaveLength(1)
    expect(JSON.stringify(audits[0]!.newValue)).not.toContain('secret-pass')
  })

  it('أستاذ الدورة يدير حصص مساحته؛ أستاذ آخر مرفوض؛ التلميذ مرفوض', async () => {
    const s = await createLiveSession(h.db, teacher, { courseId, title: 'حصة الأستاذ', startsAt: new Date(Date.now() + 86_400_000), joinUrl: JOIN_URL })
    await expectCode(() => createLiveSession(h.db, otherTeacher, { courseId, title: 'x', startsAt: new Date() }), 'FORBIDDEN')
    await expectCode(() => createLiveSession(h.db, student, { courseId, title: 'x', startsAt: new Date() }), 'FORBIDDEN')
    await expectCode(() => updateLiveSession(h.db, otherTeacher, s.id, { title: 'y' }), 'FORBIDDEN')
    const u = await updateLiveSession(h.db, teacher, s.id, { title: 'حصة معدّلة', durationMinutes: 45 })
    expect(u.title).toBe('حصة معدّلة')
    expect(u.durationMinutes).toBe(45)
    const st = await setLiveStatus(h.db, teacher, s.id, 'CANCELLED')
    expect(st.status).toBe('CANCELLED')
    const list = await listLiveAdmin(h.db, admin, { courseId })
    expect(list.map((x) => x.id)).toContain(s.id)
    expect(await listLiveAdmin(h.db, otherTeacher, {})).toHaveLength(0)
  })

  it('يرفض رابطاً غير صالح وحالة غير معروفة', async () => {
    await expectCode(() => createLiveSession(h.db, admin, { courseId, title: 'x', startsAt: new Date(), joinUrl: 'javascript:alert(1)' }), 'VALIDATION')
    await expectCode(() => createLiveSession(h.db, admin, { courseId, title: '', startsAt: new Date() }), 'VALIDATION')
  })

  it('ربط التسجيل: فيديو من مساحة الدورة فقط', async () => {
    const s = await createLiveSession(h.db, admin, { courseId, title: 'حصة بتسجيل', startsAt: new Date(Date.now() + 3600_000) })
    const video = await createContent(h.db, teacher, { type: 'VIDEO', title: 'تسجيل الحصة', visibility: 'GROUP_ONLY', groupIds: [(await h.db.select().from(courses).where(eq(courses.id, courseId)))[0]!.groupId], externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', publish: true })
    const r = await attachRecording(h.db, admin, s.id, video.id)
    expect(r.recordingContentId).toBe(video.id)
    const foreign = await createContent(h.db, otherTeacher, { type: 'VIDEO', title: 'فيديو غريب', visibility: 'STUDENTS_ONLY', externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
    await expectCode(() => attachRecording(h.db, admin, s.id, foreign.id), 'CONTENT_NOT_FOUND')
  })
})

describe('الحصص المباشرة: انضمام التلميذ', () => {
  let sessionId: string
  const startsAt = new Date('2027-01-10T18:00:00Z')

  beforeAll(async () => {
    const s = await createLiveSession(h.db, admin, { courseId, title: 'حصة الانضمام', startsAt, durationMinutes: 60, joinUrl: JOIN_URL })
    sessionId = s.id
  })

  it('مرفوض قبل فتح النافذة (أكثر من 15 دقيقة قبل الموعد) وبعد إغلاقها', async () => {
    await expectCode(() => joinInfo(h.db, student, sessionId, new Date(startsAt.getTime() - 16 * 60_000)), 'LIVE_NOT_OPEN')
    await expectCode(() => joinInfo(h.db, student, sessionId, new Date(startsAt.getTime() + 91 * 60_000)), 'LIVE_NOT_OPEN')
  })

  it('مرفوض لغير المشترك، ولمن لم يقبل الشروط، ولغير التلميذ', async () => {
    const inWindow = new Date(startsAt.getTime() - 5 * 60_000)
    await expectCode(() => joinInfo(h.db, outsider, sessionId, inWindow), 'COURSE_NOT_ENROLLED')
    await expectCode(() => joinInfo(h.db, noTerms, sessionId, inWindow), 'LIVE_NOT_OPEN')
    await expectCode(() => joinInfo(h.db, teacher, sessionId, inWindow), 'FORBIDDEN')
    await expectCode(() => joinInfo(h.db, student, '00000000-0000-4000-8000-000000000000', inWindow), 'LIVE_NOT_FOUND')
  })

  it('مسموح داخل النافذة (من −15 د إلى النهاية +30 د) ويُسجَّل live.join كحضور', async () => {
    const r = await joinInfo(h.db, student, sessionId, new Date(startsAt.getTime() - 15 * 60_000))
    expect(r.url).toBe(JOIN_URL)
    expect(r.provider).toBe('ZOOM')
    const late = await joinInfo(h.db, student, sessionId, new Date(startsAt.getTime() + 90 * 60_000))
    expect(late.url).toBe(JOIN_URL)
    const audits = await h.db.select().from(auditLogs).where(and(eq(auditLogs.action, 'live.join'), eq(auditLogs.entityId, sessionId)))
    expect(audits).toHaveLength(2)
    expect(audits[0]!.actorUserId).toBe(student.userId)
    expect(audits[0]!.newValue).toMatchObject({ studentId: student.studentId, sessionId })
    const att = await liveAttendance(h.db, admin, sessionId)
    expect(att).toHaveLength(1)
    expect(att[0]!.studentId).toBe(student.studentId)
  })

  it('اشتراك منتهٍ أو ملغى ⇒ COURSE_NOT_ENROLLED؛ حصة ملغاة ⇒ LIVE_NOT_OPEN', async () => {
    const inWindow = new Date(startsAt.getTime() - 5 * 60_000)
    await h.db.update(courseEnrollments).set({ status: 'REVOKED' }).where(and(eq(courseEnrollments.courseId, courseId), eq(courseEnrollments.studentId, student.studentId!)))
    await expectCode(() => joinInfo(h.db, student, sessionId, inWindow), 'COURSE_NOT_ENROLLED')
    await h.db.update(courseEnrollments).set({ status: 'ACTIVE' }).where(and(eq(courseEnrollments.courseId, courseId), eq(courseEnrollments.studentId, student.studentId!)))
    await setLiveStatus(h.db, admin, sessionId, 'CANCELLED')
    await expectCode(() => joinInfo(h.db, student, sessionId, inWindow), 'LIVE_NOT_OPEN')
    await setLiveStatus(h.db, admin, sessionId, 'SCHEDULED')
  })

  it('upcomingForStudent: حصص الدورات المشترك فيها خلال 14 يوماً فقط', async () => {
    const now = new Date(startsAt.getTime() - 3 * 86_400_000)
    const mine = await upcomingForStudent(h.db, student, now)
    expect(mine.map((s) => s.id)).toContain(sessionId)
    expect(mine.find((s) => s.id === sessionId)?.termsAccepted).toBe(true)
    expect(mine.every((s) => s.startsAt.getTime() <= now.getTime() + 14 * 86_400_000)).toBe(true)
    expect(await upcomingForStudent(h.db, outsider, now)).toHaveLength(0)
    const far = await upcomingForStudent(h.db, student, new Date(startsAt.getTime() - 20 * 86_400_000))
    expect(far.map((s) => s.id)).not.toContain(sessionId)
    const noT = await upcomingForStudent(h.db, noTerms, now)
    expect(noT.find((s) => s.id === sessionId)?.termsAccepted).toBe(false)
  })
})

describe('الحصص المباشرة: التذكير', () => {
  it('المهمة تُعلّم reminderSentAt مرة واحدة وتُشعر المشتركين النشطين فقط', async () => {
    const now = new Date('2027-02-01T10:00:00Z')
    const s = await createLiveSession(h.db, admin, { courseId, title: 'حصة التذكير', startsAt: new Date(now.getTime() + 35 * 60_000), joinUrl: JOIN_URL })
    const tooSoon = await createLiveSession(h.db, admin, { courseId, title: 'حصة قريبة جداً', startsAt: new Date(now.getTime() + 10 * 60_000), joinUrl: JOIN_URL })
    const tooFar = await createLiveSession(h.db, admin, { courseId, title: 'حصة بعيدة', startsAt: new Date(now.getTime() + 60 * 60_000), joinUrl: JOIN_URL })
    const before = (await h.db.select().from(notifications)).length
    const r1 = await runLiveRemindersJob(h.db, now)
    expect(r1.sessions).toBe(1)
    expect(r1.notified).toBe(2) // student + noTerms (كلاهما ACTIVE)؛ outsider ليس مشتركاً
    const after = await h.db.select().from(notifications)
    const mine = after.slice(before).filter((n) => (n.meta as { liveSessionId?: string }).liveSessionId === s.id)
    expect(mine).toHaveLength(2)
    expect(new Set(mine.map((n) => n.userId))).toEqual(new Set([student.userId, noTerms.userId]))
    expect(mine[0]!.title).toContain('حصة التذكير')
    expect(mine[0]!.title).toContain('30 دقيقة')
    expect(mine[0]!.type).toBe('SESSION_REMINDER')
    const [row] = await h.db.select().from(liveSessions).where(eq(liveSessions.id, s.id))
    expect(row?.reminderSentAt?.getTime()).toBe(now.getTime())
    for (const other of [tooSoon.id, tooFar.id]) {
      const [o] = await h.db.select().from(liveSessions).where(eq(liveSessions.id, other))
      expect(o?.reminderSentAt).toBeNull()
    }
    // تشغيل ثانٍ: لا تكرار
    const r2 = await runLiveRemindersJob(h.db, new Date(now.getTime() + 60_000))
    expect(r2.sessions).toBe(0)
    expect((await h.db.select().from(notifications)).length).toBe(after.length)
    const audits = await h.db.select().from(auditLogs).where(and(eq(auditLogs.action, 'live.reminders'), eq(auditLogs.entityId, s.id)))
    expect(audits).toHaveLength(1)
  })

  it('ensureLiveRemindersScheduled يُدرج LIVE_REMINDERS مرة كل 10 دقائق والعامل ينفّذها', async () => {
    expect(await ensureLiveRemindersScheduled(h.db)).toBe(true)
    expect(await ensureLiveRemindersScheduled(h.db)).toBe(false)
    const queued = await h.db.select().from(jobs).where(eq(jobs.type, 'LIVE_REMINDERS'))
    expect(queued).toHaveLength(1)
    const summary = await processQueuedJobs(h.db, { limit: 5 })
    expect(summary.failed).toBe(0)
    const [done] = await h.db.select().from(jobs).where(eq(jobs.type, 'LIVE_REMINDERS'))
    expect(done?.status).toBe('COMPLETED')
  })
})
