import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { files, jobs, notifications, skills } from '@/server/db/schema'
import { processQueuedJobs } from '@/server/jobs/runner'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { storage, verifyFileSignature } from '@/server/lib/storage'
import { dataInsights } from '@/server/queries/teacher-extras.queries'
import { createAssignment, reviewSubmission, submitAnswer } from '@/server/services/assignments.service'
import { closeSession, startSession } from '@/server/services/class-sessions.service'
import { createContent } from '@/server/services/content.service'
import { generateCodes } from '@/server/services/enrollment-codes.service'
import { redeemEnrollmentCode } from '@/server/services/enrollment.service'
import { createGroup } from '@/server/services/groups.service'
import { createQuiz } from '@/server/services/quizzes.service'
import { listSkills } from '@/server/services/reference.service'
import { listReports, requestReport, runReportJob, toCsv } from '@/server/services/reports.service'
import { recordSkillResult, remediationPlan } from '@/server/services/skills.service'
import { issueAttendanceToken, scanAttendanceToken } from '@/server/services/attendance.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb } from './helpers'

let h: DatabaseHandle
let admin: Actor
let teacher: Actor
let teacherB: Actor
let group: { id: string }
const studs: Actor[] = []
let skillA: string
let skillB: string

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

beforeAll(async () => {
  process.env.UPLOADS_DIR = `data/test-uploads-${Date.now()}`
  h = await setupDb()
  admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin, 'الأستاذ أ')
  teacherB = await makeTeacher(h.db, admin, 'الأستاذ ب')
  group = await createGroup(h.db, teacher, { name: 'فوج التقارير' })
  const names = ['أحمد', 'بلال', 'جميلة', 'دليلة', 'هشام', 'وردة']
  for (const n of names) {
    const s = await makeStudent(h.db, n)
    const r = await generateCodes(h.db, teacher, { groupId: group.id, count: 1 })
    await redeemEnrollmentCode(h.db, s, r.codes[0]!.code)
    studs.push(s)
  }
  await h.db.insert(skills).values([
    { code: 'IMAGERY', nameAr: 'الصور البيانية', category: 'RHETORIC' },
    { code: 'PARSING', nameAr: 'إعراب المفردات', category: 'GRAMMAR' }
  ])
  const sk = await listSkills(h.db)
  skillA = sk[0]!.id
  skillB = sk[1]!.id
})

afterAll(async () => {
  await h.close()
})

describe('التقارير كمهام + ربط الغياب بالمستوى + خطة التقوية', () => {
  it('CSV آمن: BOM، اقتباس، ومنع حقن الصيغ', () => {
    const csv = toCsv(['a', 'b'], [['=cmd()', 'قيمة, بفاصلة'], ['عادي', 'سطر\nجديد']])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain("'=cmd()")
    expect(csv).toContain('"قيمة, بفاصلة"')
    expect(csv).toContain('"سطر\nجديد"')
  })

  it('يبني بيانات: 3 حصص، الطلاب 4-6 يغيبون، الطالبان 1-2 ضعيفان في مهارة', async () => {
    let day = new Date('2026-10-03T08:00:00Z')
    for (let i = 0; i < 3; i++) {
      const s = await startSession(h.db, teacher, { groupId: group.id, title: `حصة ${i + 1}`, now: day })
      for (let j = 0; j < 3; j++) {
        const tok = await issueAttendanceToken(h.db, studs[j]!, group.id, day)
        await scanAttendanceToken(h.db, teacher, { classSessionId: s.id, token: tok.token, now: new Date(day.getTime() + 60_000) })
      }
      await closeSession(h.db, teacher, s.id, new Date(day.getTime() + 2 * 3600_000))
      day = new Date(day.getTime() + 7 * 86400_000)
    }
    // مهارات: الحاضرون أقوياء، الغائبون ضعفاء
    for (let j = 0; j < 6; j++) {
      await recordSkillResult(h.db, { studentId: studs[j]!.studentId!, skillId: skillA, percent: j < 3 ? 85 : 40, sourceType: 'MANUAL' })
      await recordSkillResult(h.db, { studentId: studs[j]!.studentId!, skillId: skillB, percent: j < 3 ? 90 : 50, sourceType: 'MANUAL' })
    }
    const a = await createAssignment(h.db, teacher, { title: 'واجب التقرير', maxScore: 20, skillId: skillA, groupIds: [group.id], studentIds: [] })
    const sub = await submitAnswer(h.db, studs[0]!, a.id, 'إجابة كافية للتصحيح')
    await reviewSubmission(h.db, teacher, sub.submissionId, { score: 16, strengths: ['جيد'], improvements: [] })
  })

  it('التحليلات تربط الغياب بالمستوى كتوصية', async () => {
    const insights = await dataInsights(h.db, teacher)
    const link = insights.find((i) => i.text.includes('الأكثر غياباً'))
    expect(link).toBeTruthy()
    expect(link?.text).toContain('توصية')
    expect(link?.text).toContain('لا حكم')
  })

  it('طلب تقرير: تحقق من الفوج والنوع، ثم المهمة تولّد ملفاً خاصاً برابط موقّع وإشعاراً', async () => {
    await expectCode(() => requestReport(h.db, teacher, { kind: 'GROUP_GRADES', groupId: null }), 'VALIDATION')
    await expectCode(() => requestReport(h.db, teacherB, { kind: 'GROUP_GRADES', groupId: group.id }), 'NOT_FOUND')
    await expectCode(() => requestReport(h.db, studs[0]!, { kind: 'STUDENTS' }), 'FORBIDDEN')
    // @ts-expect-error نوع غير معروف
    await expectCode(() => requestReport(h.db, teacher, { kind: 'HACK', groupId: group.id }), 'VALIDATION')

    for (const kind of ['GROUP_ATTENDANCE', 'GROUP_GRADES', 'GROUP_SKILLS'] as const) await requestReport(h.db, teacher, { kind, groupId: group.id })
    await requestReport(h.db, teacher, { kind: 'STUDENTS' })
    let list = await listReports(h.db, teacher)
    expect(list).toHaveLength(4)
    expect(list.every((r) => r.status === 'QUEUED' && r.downloadUrl === null)).toBe(true)

    const summary = await processQueuedJobs(h.db)
    expect(summary).toMatchObject({ processed: 4, completed: 4, failed: 0 })
    list = await listReports(h.db, teacher)
    expect(list.every((r) => r.status === 'COMPLETED' && !!r.downloadUrl)).toBe(true)
    const att = list.find((r) => r.kind === 'GROUP_ATTENDANCE')!
    expect(att.rows).toBe(6)
    const url = new URL(att.downloadUrl!, 'http://x')
    const fileId = url.pathname.split('/').pop()!
    expect(verifyFileSignature(fileId, url.searchParams.get('exp'), url.searchParams.get('sig'))).toBe(true)
    const [f] = await h.db.select().from(files).where(eq(files.id, fileId))
    expect(f?.bucket).toBe('private')
    expect(f?.mimeType).toBe('text/csv')
    const bytes = await storage().get(f!.storageKey)
    const text = bytes.toString('utf8')
    expect(text.startsWith('﻿')).toBe(true)
    expect(text).toContain('حصة 1')
    expect(text).toContain('أحمد')
    expect(text).toContain('حاضر')
    expect(text).toContain('غير مبرر')

    const gradesRep = list.find((r) => r.kind === 'GROUP_GRADES')!
    expect(gradesRep.rows).toBe(1)
    const skillsRep = list.find((r) => r.kind === 'GROUP_SKILLS')!
    expect(skillsRep.rows).toBe(12)

    const n = await h.db.select().from(notifications).where(eq(notifications.userId, teacher.userId))
    expect(n.filter((x) => x.title.startsWith('التقرير جاهز')).length).toBe(4)
    // عزل: الأستاذ الآخر لا يرى التقارير
    expect(await listReports(h.db, teacherB)).toHaveLength(0)
  })

  it('المهمة ترفض حمولة مزوّرة (فوج من مساحة أخرى)', async () => {
    const gB = await createGroup(h.db, teacherB, { name: 'فوج ب' })
    await expect(runReportJob(h.db, { kind: 'GROUP_ATTENDANCE', groupId: gB.id, workspaceId: teacher.workspaceId, userId: teacher.userId })).rejects.toSatisfy((e) => e instanceof AppError && e.code === 'NOT_FOUND')
    const jobRows = await h.db.select().from(jobs).where(eq(jobs.type, 'REPORT_EXPORT'))
    expect(jobRows.every((j) => j.status === 'COMPLETED')).toBe(true)
  })

  it('خطة التقوية: درس + تمرين + اختبار للمهارة الأضعف من المحتوى المتاح للطالب فقط', async () => {
    await createContent(h.db, teacher, { type: 'LESSON', title: 'درس علاجي أ', skillId: skillA, visibility: 'GROUP_ONLY', groupIds: [group.id], publish: true })
    await createContent(h.db, teacher, { type: 'EXERCISE', title: 'تمرين أ', skillId: skillA, visibility: 'STUDENTS_ONLY', publish: true })
    await createContent(h.db, teacher, { type: 'LESSON', title: 'درس مخفي', skillId: skillA, visibility: 'GROUP_ONLY', groupIds: [(await createGroup(h.db, teacher, { name: 'فوج آخر' })).id], publish: true })
    await createContent(h.db, teacher, { type: 'LESSON', title: 'درس غير منشور', skillId: skillA, visibility: 'PUBLIC', publish: false })
    await createQuiz(h.db, teacher, {
      title: 'اختبار قصير أ',
      skillId: skillA,
      isPublic: true,
      publish: true,
      groupIds: [],
      studentIds: [],
      questions: [{ type: 'TRUE_FALSE', prompt: 'س', points: 1, skillId: skillA, answerKey: { value: true }, options: [] }]
    })
    const weakStudent = studs[4]!
    const plan = await remediationPlan(h.db, weakStudent)
    expect(plan.length).toBe(2)
    expect(plan[0]?.skillId).toBe(skillA) // الأضعف أولاً
    expect(plan[0]?.lessons.map((l) => l.title)).toEqual(['درس علاجي أ'])
    expect(plan[0]?.exercises.map((l) => l.title)).toEqual(['تمرين أ'])
    expect(plan[0]?.quizzes.map((q) => q.title)).toEqual(['اختبار قصير أ'])
    expect(plan[1]?.lessons).toHaveLength(0)
    // الطالب القوي بلا خطة
    expect(await remediationPlan(h.db, studs[0]!)).toHaveLength(0)
    await expectCode(() => remediationPlan(h.db, teacher), 'FORBIDDEN')
  })
})
