/**
 * MADRASA PLAY — سياسة الوصول والتجربة (11_ACCESS_AND_TRIAL_POLICY، 12_MANDATORY_ACCEPTANCE_GATES):
 * مشترك الدورة الملائمة مجانًا؛ غير المشترك 72 ساعة من أول بدء فعلي مرة واحدة؛ الحماية في الخادم عند كل طلب.
 */
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { courseEnrollments, levels, playAccessTrials, playQuestions, streams, subjects } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { PLAY_TRIAL_MS } from '@/server/play/constants'
import { importQuestions, syncCatalog } from '@/server/play/importer'
import type { PlayContentQuestion } from '@/server/play/question-types'
import { createCourse, enrollStudent } from '@/server/services/courses.service'
import { assertPlayAccess, beginPlayAccess, getPlayAccess, remainingLabel } from '@/server/services/play-access.service'
import { getSessionView, setPlayProfile, startPlaySession, submitPlayAnswer } from '@/server/services/play.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb, workspaceIdOfTeacher } from './helpers'

let h: DatabaseHandle
let admin: Actor
let ws: string
let arabicCourse: string
let mathCourse: string
const H = 3_600_000
const T0 = new Date('2026-11-02T08:00:00.000Z')

const catalog = {
  version: 1,
  grades: [
    {
      grade: '3AS',
      subjects: [
        { subject: 'AR', units: [{ code: 'U1', name: 'البناء اللغوي', verified: true, lessons: [{ code: 'L1', name: 'الصور البيانية', verified: true }] }] },
        { subject: 'MATH', streams: ['SCI', 'MATH'], units: [{ code: 'U1', name: 'الدوال', verified: true, lessons: [{ code: 'L1', name: 'النهايات', verified: true }] }] }
      ]
    }
  ]
}

function q(key: string, subject: 'AR' | 'MATH'): PlayContentQuestion {
  return {
    key,
    type: 'MCQ',
    grade: '3AS',
    subject,
    streams: subject === 'MATH' ? ['SCI', 'MATH'] : undefined,
    unit: 'U1',
    lesson: 'L1',
    difficulty: 'EASY',
    question: subject === 'AR' ? `ما نوع الصورة في «ابتسم الصباح»؟ (${key})` : `نهاية 1/x عند +∞؟ (${key})`,
    options: subject === 'AR' ? ['تشبيه بليغ', 'استعارة مكنية', 'كناية', 'مجاز مرسل'] : ['0', '1', '2', '3'],
    correct: subject === 'AR' ? 1 : 0,
    explanation: subject === 'AR' ? 'شُبّه الصباح بإنسان يبتسم وحُذف المشبه به.' : 'كلما كبر x اقترب 1/x من الصفر.'
  }
}

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

async function newStudent(stream: string | null = 'SCI'): Promise<Actor> {
  const s = await makeStudent(h.db, 'تلميذ PLAY')
  await setPlayProfile(h.db, s, { gradeCode: '3AS', streamCode: stream })
  return s
}

async function answerFirst(student: Actor, sessionId: string, now: Date) {
  const view = await getSessionView(h.db, student, sessionId)
  const first = view.questions[0]!
  const key = first.payload.type === 'MCQ' ? first.payload.options[0]!.key : ''
  return submitPlayAnswer(h.db, student, sessionId, first.id, { type: 'MCQ', key }, 1000, now)
}

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  const teacher = await makeTeacher(h.db, admin)
  ws = await workspaceIdOfTeacher(h.db, teacher)
  await h.db.insert(subjects).values([
    { code: 'ARABIC', slug: 'arabic', nameAr: 'اللغة العربية', nameFr: 'Arabe', sortOrder: 1 },
    { code: 'MATH', slug: 'math', nameAr: 'الرياضيات', nameFr: 'Mathématiques', sortOrder: 2 }
  ])
  await h.db.insert(streams).values([{ code: 'LIT', nameAr: 'آداب وفلسفة', sortOrder: 2 }])
  await h.db.insert(levels).values([{ code: '2AS', nameAr: 'السنة الثانية ثانوي', sortOrder: 2 }])
  await syncCatalog(h.db, catalog)
  const batch: PlayContentQuestion[] = []
  for (let i = 1; i <= 12; i++) batch.push(q(`3AS-AR-U1-L1-${String(i).padStart(4, '0')}`, 'AR'), q(`3AS-MATH-U1-L1-${String(i).padStart(4, '0')}`, 'MATH'))
  await importQuestions(h.db, batch)
  const [lvl] = await h.db.select().from(levels).where(eq(levels.code, '3AS'))
  const [ar] = await h.db.select().from(subjects).where(eq(subjects.code, 'ARABIC'))
  const [ma] = await h.db.select().from(subjects).where(eq(subjects.code, 'MATH'))
  const [sci] = await h.db.select().from(streams).where(eq(streams.code, 'SCI'))
  arabicCourse = (await createCourse(h.db, admin, { title: 'دورة العربية 3 ثانوي', workspaceId: ws, season: '2026/2027', levelId: lvl!.id, subjectId: ar!.id, status: 'DRAFT' })).id
  mathCourse = (await createCourse(h.db, admin, { title: 'دورة الرياضيات علوم', workspaceId: ws, season: '2026/2027', levelId: lvl!.id, subjectId: ma!.id, streamIds: [sci!.id], status: 'DRAFT' })).id
})

afterAll(async () => {
  await h.close()
})

describe('subscribers of a matching course play free', () => {
  it('Arabic course ⇒ Arabic rounds free, no trial row, answers accepted', async () => {
    const s = await newStudent()
    await enrollStudent(h.db, admin, { courseId: arabicCourse, studentId: s.studentId!, source: 'MANUAL', expiresAt: new Date(T0.getTime() + 300 * 24 * H) })
    const a = await getPlayAccess(h.db, s, { gradeCode: '3AS', streamCode: 'SCI', subjectCode: 'AR' }, T0)
    expect(a.state.kind).toBe('subscriber')
    const session = await startPlaySession(h.db, s, { challengeType: 'QUICK10', subjectCode: 'AR' }, T0)
    expect((await answerFirst(s, session.id, new Date(T0.getTime() + 500 * H))).answeredCount).toBe(1)
    expect(await h.db.select().from(playAccessTrials).where(eq(playAccessTrials.studentId, s.studentId!))).toHaveLength(0)
  })

  it('a course for one subject is not a blanket pass: Math falls back to the trial', async () => {
    const s = await newStudent()
    await enrollStudent(h.db, admin, { courseId: arabicCourse, studentId: s.studentId!, source: 'MANUAL', expiresAt: null })
    const before = await getPlayAccess(h.db, s, { gradeCode: '3AS', streamCode: 'SCI', subjectCode: 'MATH' }, T0)
    expect(before.state.kind).toBe('trial_available')
    await startPlaySession(h.db, s, { challengeType: 'QUICK10', subjectCode: 'MATH' }, T0)
    const after = await getPlayAccess(h.db, s, { gradeCode: '3AS', streamCode: 'SCI', subjectCode: 'MATH' }, T0)
    expect(after.state.kind).toBe('trial_active')
  })

  it('multi-subject rounds of a partial subscriber draw only from subscribed subjects', async () => {
    const s = await newStudent()
    await enrollStudent(h.db, admin, { courseId: arabicCourse, studentId: s.studentId!, source: 'MANUAL', expiresAt: null })
    const session = await startPlaySession(h.db, s, { challengeType: 'QUICK10' }, T0)
    const qs = await h.db.select({ subjectCode: playQuestions.subjectCode }).from(playQuestions)
    const rows = qs.length ? await getSessionView(h.db, s, session.id) : null
    expect(rows!.questions.every((x) => x.subjectCode === 'AR')).toBe(true)
    expect(await h.db.select().from(playAccessTrials).where(eq(playAccessTrials.studentId, s.studentId!))).toHaveLength(0)
  })

  it('stream and level must match the course', async () => {
    const lit = await newStudent('LIT')
    await enrollStudent(h.db, admin, { courseId: mathCourse, studentId: lit.studentId!, source: 'MANUAL', expiresAt: null })
    expect((await getPlayAccess(h.db, lit, { gradeCode: '3AS', streamCode: 'LIT', subjectCode: 'MATH' }, T0)).state.kind).toBe('trial_available')
    const sci = await newStudent('SCI')
    await enrollStudent(h.db, admin, { courseId: mathCourse, studentId: sci.studentId!, source: 'MANUAL', expiresAt: null })
    expect((await getPlayAccess(h.db, sci, { gradeCode: '3AS', streamCode: 'SCI', subjectCode: 'MATH' }, T0)).state.kind).toBe('subscriber')
    expect((await getPlayAccess(h.db, sci, { gradeCode: '2AS', streamCode: 'SCI', subjectCode: 'MATH' }, T0)).state.kind).toBe('trial_available')
  })
})

describe('72-hour trial from the first real play, server time only', () => {
  it('a new non-subscriber gets exactly 72:00 from the first round start, not from sign-up', async () => {
    const s = await newStudent()
    const start = new Date(T0.getTime() + 30 * 24 * H) // حساب قديم: يبدأ عند أول لعب بعد الإطلاق
    expect((await getPlayAccess(h.db, s, { gradeCode: '3AS', streamCode: 'SCI', subjectCode: 'AR' }, start)).state.kind).toBe('trial_available')
    // زيارة الصفحة لا تبدأ التجربة
    expect(await h.db.select().from(playAccessTrials).where(eq(playAccessTrials.studentId, s.studentId!))).toHaveLength(0)
    const session = await startPlaySession(h.db, s, { challengeType: 'QUICK10', subjectCode: 'AR' }, start)
    const [trial] = await h.db.select().from(playAccessTrials).where(eq(playAccessTrials.studentId, s.studentId!))
    expect(trial!.startedAt.toISOString()).toBe(start.toISOString())
    expect(trial!.endsAt.getTime() - trial!.startedAt.getTime()).toBe(PLAY_TRIAL_MS)
    expect(PLAY_TRIAL_MS).toBe(72 * H)

    // 71:59 مسموح، 72:00 مرفوض (عند الإرسال وعند بدء جولة جديدة)
    await answerFirst(s, session.id, new Date(start.getTime() + 72 * H - 60_000))
    const view = await getSessionView(h.db, s, session.id)
    const second = view.questions[1]!
    const key = second.payload.type === 'MCQ' ? second.payload.options[0]!.key : ''
    await expectCode(() => submitPlayAnswer(h.db, s, session.id, second.id, { type: 'MCQ', key }, 1000, new Date(start.getTime() + 72 * H)), 'PLAY_TRIAL_EXPIRED')
    await expectCode(() => startPlaySession(h.db, s, { challengeType: 'QUICK10', subjectCode: 'AR' }, new Date(start.getTime() + 72 * H)), 'PLAY_TRIAL_EXPIRED')
    const after = await getPlayAccess(h.db, s, { gradeCode: '3AS', streamCode: 'SCI', subjectCode: 'AR' }, new Date(start.getTime() + 72 * H))
    expect(after.state.kind).toBe('trial_expired')
    expect(after.canPlay).toBe(false)
  })

  it('cannot be renewed: second device, parallel starts, or an earlier clock never extend it', async () => {
    const s = await newStudent()
    const scope = { gradeCode: '3AS', streamCode: 'SCI', subjectCode: 'AR' }
    const [a, b] = await Promise.all([beginPlayAccess(h.db, s, scope, T0), beginPlayAccess(h.db, s, scope, new Date(T0.getTime() + 5_000))])
    expect(a.access.state.kind).toBe('trial_active')
    expect(b.access.state.kind).toBe('trial_active')
    const rows = await h.db.select().from(playAccessTrials).where(eq(playAccessTrials.studentId, s.studentId!))
    expect(rows).toHaveLength(1)
    const endsAt = rows[0]!.endsAt.getTime()
    // «جهاز ثانٍ» = نفس الحساب: يقرأ الصف نفسه
    await beginPlayAccess(h.db, s, scope, new Date(T0.getTime() + 10 * H))
    // ساعة متأخرة على الجهاز لا تصل الخادم؛ وحتى لو مُرِّر وقت أقدم لا يُعدَّل الصف
    await getPlayAccess(h.db, s, scope, new Date(T0.getTime() - 100 * H))
    const [same] = await h.db.select().from(playAccessTrials).where(eq(playAccessTrials.studentId, s.studentId!))
    expect(same!.endsAt.getTime()).toBe(endsAt)
    await expectCode(() => beginPlayAccess(h.db, s, scope, new Date(endsAt)), 'PLAY_TRIAL_EXPIRED')
  })

  it('answering without ever starting is refused', async () => {
    const s = await newStudent()
    await expectCode(() => assertPlayAccess(h.db, s, { gradeCode: '3AS', streamCode: 'SCI', subjectCode: 'AR' }, T0), 'PLAY_TRIAL_REQUIRED')
  })
})

describe('course lifecycle after the trial', () => {
  it('expired or revoked enrollment ⇒ no free access; renewal ⇒ free again, even after the trial ended', async () => {
    const s = await newStudent()
    const scope = { gradeCode: '3AS', streamCode: 'SCI', subjectCode: 'AR' }
    // تجربة منتهية
    await beginPlayAccess(h.db, s, scope, T0)
    const late = new Date(T0.getTime() + 100 * H)
    expect((await getPlayAccess(h.db, s, scope, late)).state.kind).toBe('trial_expired')
    // اشتراك منتهي الصلاحية
    await enrollStudent(h.db, admin, { courseId: arabicCourse, studentId: s.studentId!, source: 'MANUAL', expiresAt: new Date(T0.getTime() + 50 * H) })
    expect((await getPlayAccess(h.db, s, scope, late)).state.kind).toBe('trial_expired')
    // فشل التفعيل / إلغاء
    await h.db.update(courseEnrollments).set({ status: 'REVOKED', expiresAt: null }).where(eq(courseEnrollments.studentId, s.studentId!))
    expect((await getPlayAccess(h.db, s, scope, late)).state.kind).toBe('trial_expired')
    // تجديد الدورة
    await enrollStudent(h.db, admin, { courseId: arabicCourse, studentId: s.studentId!, source: 'MANUAL', expiresAt: new Date(late.getTime() + 200 * 24 * H) })
    const renewed = await getPlayAccess(h.db, s, scope, late)
    expect(renewed.state.kind).toBe('subscriber')
    const session = await startPlaySession(h.db, s, { challengeType: 'QUICK10', subjectCode: 'AR' }, late)
    expect((await answerFirst(s, session.id, late)).answeredCount).toBe(1)
  })
})

describe('remaining time label', () => {
  it('reads naturally in Arabic', () => {
    expect(remainingLabel(56 * H)).toBe('يومان و8 ساعات')
    expect(remainingLabel(72 * H)).toBe('3 أيام')
    expect(remainingLabel(25 * H)).toBe('يوم وساعة')
    expect(remainingLabel(11 * H)).toBe('11 ساعة')
    expect(remainingLabel(30 * 60_000)).toBe('30 دقيقة')
  })
})
