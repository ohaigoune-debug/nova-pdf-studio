import { and, eq, isNull } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { DEFAULT_ASSISTANT_PAY, cleanPayConfig, computeStatement, formatDa, markOverLimit, monthOf, monthRange, termOf, type AssistantPayConfig } from '@/lib/assistant-pay'
import { content, contentTargets } from '@/server/db/schema'
import { classifyContent } from '@/server/lib/course-sections'
import type { Actor } from '@/server/lib/actor'
import { acceptTerms, courseHome, createCourse, enrollStudent } from '@/server/services/courses.service'
import { groupIntoDoors } from '@/server/lib/course-doors'
import { seedCurriculum } from '@/server/db/seed-curriculum'
import { createAssistantCode, joinAsAssistant } from '@/server/services/assistants.service'
import {
  assistantMonth,
  cancelPayout,
  getAssistantPayConfig,
  markMonthPaid,
  removeAssistantContent,
  setAssistantPayConfig,
  setReplyCorrection,
  submitAssistantContent
} from '@/server/services/assistant-pay.service'
import { addComment, createPost } from '@/server/services/classroom.service'
import { createGroup } from '@/server/services/groups.service'
import { actorOf, makeAdmin, makeStudent, makeTeacher, setupDb, workspaceIdOfTeacher } from './helpers'

const cfg: AssistantPayConfig = DEFAULT_ASSISTANT_PAY
const replies = (n: number, chars = 50) => Array.from({ length: n }, () => ({ chars, correction: false }))

describe('حساب أجر الأستاذ المساعد (قرار المالك 23 نوفمبر 2026)', () => {
  it('الأرقام الافتراضيّة كما اتُّفق عليها', () => {
    expect(cfg).toMatchObject({
      baseSalary: 40000,
      includedReplies: 300,
      extraCap: 30000,
      termLimit: 4
    })
    expect(cfg.replyRates).toEqual({
      SHORT: 40,
      DETAILED: 80,
      CORRECTION: 150
    })
    expect(cfg.contentRates).toEqual({
      SUMMARY: 400,
      EXERCISES: 500,
      EXAM: 1000,
      PROPOSAL: 1000
    })
  })

  it('أوّل 300 ردّ في الرّاتب، ثمّ قصير ومفصّل، والمحتوى بالصّفحة', () => {
    const s = computeStatement(
      {
        replies: [...replies(380), ...replies(40, 400)],
        content: [{ kind: 'SUMMARY', pages: 20 }]
      },
      cfg
    )
    expect(s.repliesIncluded).toBe(300)
    expect(s.extraReplies.SHORT).toEqual({ count: 80, amount: 3200 })
    expect(s.extraReplies.DETAILED).toEqual({ count: 40, amount: 3200 })
    expect(s.contentAmount).toBe(8000)
    expect(s).toMatchObject({ extra: 14400, total: 54400, capped: false })
  })

  it('الاختبار والمقترح 1000 دج لصفحة الموضوع (4 صفحات = 4000)، والتّصحيح 150', () => {
    const s = computeStatement(
      {
        replies: [...replies(300), { chars: 10, correction: true }],
        content: [
          { kind: 'EXAM', pages: 4 },
          { kind: 'PROPOSAL', pages: 3 }
        ]
      },
      cfg
    )
    expect(s.extraReplies.CORRECTION).toEqual({ count: 1, amount: 150 })
    expect(s.contentAmount).toBe(7000)
    expect(s.total).toBe(40000 + 7150)
  })

  it('سقف واحد للرّدود والمحتوى معًا: الأقصى 70000', () => {
    const s = computeStatement(
      {
        replies: [...replies(300), ...replies(400, 500)],
        content: [{ kind: 'PROPOSAL', pages: 10 }]
      },
      cfg
    )
    expect(s.extraBeforeCap).toBe(32000 + 10000)
    expect(s).toMatchObject({ extra: 30000, total: 70000, capped: true })
  })

  it('حدّ 4 اختبارات ومقترحات معًا في الفصل؛ الملخّصات والتّمارين بلا حدّ', () => {
    const items = markOverLimit([{ kind: 'EXAM' as const }, { kind: 'SUMMARY' as const }, { kind: 'PROPOSAL' as const }, { kind: 'EXAM' as const }], 2, cfg)
    expect(items.map((i) => i.overLimit)).toEqual([false, false, false, true])
    const s = computeStatement({ replies: [], content: items.map((i) => ({ ...i, pages: 2 })) }, cfg)
    expect(s.contentAmount).toBe(2000 + 800 + 2000)
    expect(s.contentOverLimit).toBe(1)
    expect(
      markOverLimit([{ kind: 'EXAM' as const }], 50, {
        ...cfg,
        termLimit: 0
      })[0]!.overLimit
    ).toBe(false)
  })

  it('الفصول الجزائريّة وحدود الشّهر بتوقيت الجزائر', () => {
    expect(termOf('2026-11')).toMatchObject({
      key: '2026-2027·1',
      firstMonth: '2026-09'
    })
    expect(termOf('2027-02')).toMatchObject({
      key: '2026-2027·2',
      firstMonth: '2027-01'
    })
    expect(termOf('2027-05')).toMatchObject({
      key: '2026-2027·3',
      firstMonth: '2027-04'
    })
    expect(termOf('2026-08')).toMatchObject({
      key: '2025-2026·3',
      firstMonth: '2026-04'
    })
    expect(monthRange('2026-11')!.start.toISOString()).toBe('2026-10-31T23:00:00.000Z')
    expect(monthRange('2026-13')).toBeNull()
    expect(monthOf(new Date('2026-11-30T23:30:00Z'))).toBe('2026-12')
    expect(formatDa(50110)).toBe('\u206650\u00a0110\u2069\u00a0دج')
  })

  it('الإعدادات: الأرقام النّصّيّة تُقبل، والسّالب وغير المعروف يرجع إلى الافتراضيّ', () => {
    const c = cleanPayConfig({
      baseSalary: '45000',
      extraCap: -5,
      contentRates: { EXAM: 'abc', SUMMARY: 450 },
      contentUnits: { EXAM: 'ITEM', SUMMARY: 'X' }
    })
    expect(c.baseSalary).toBe(45000)
    expect(c.extraCap).toBe(30000)
    expect(c.contentRates).toMatchObject({ EXAM: 1000, SUMMARY: 450 })
    expect(c.contentUnits).toMatchObject({ EXAM: 'ITEM', SUMMARY: 'PAGE' })
    expect(computeStatement({ replies: [], content: [{ kind: 'EXAM', pages: 5 }] }, c).contentAmount).toBe(1000)
  })
})

describe('الكشف الشّهريّ في قاعدة البيانات', () => {
  let h: DatabaseHandle
  let admin: Actor
  let teacher: Actor
  let helper: Actor
  let attendance: Actor
  let student: Actor
  let postId: string
  let courseId: string
  let courseSlug: string
  let courseGroupId: string
  const month = monthOf(new Date())
  const pdf = (name = 'x.pdf') => ({
    name,
    type: 'application/pdf',
    bytes: Buffer.from('%PDF-1.4 test')
  })

  async function join(owner: Actor, email: string, scope: 'FULL' | 'CLASSROOM') {
    const c = await createAssistantCode(h.db, owner, { email, scope })
    const r = await joinAsAssistant(h.db, {
      code: c.code,
      email,
      fullName: 'أستاذ مساعد',
      password: 'Assist@12345'
    })
    return actorOf(h.db, r.userId)
  }

  beforeAll(async () => {
    h = await setupDb()
    admin = await makeAdmin(h.db)
    await seedCurriculum(h.db)
    teacher = await makeTeacher(h.db, admin, 'الأستاذ')
    const g = await createGroup(h.db, teacher, { name: 'دورة الأدب' })
    student = await makeStudent(h.db, 'تلميذ')
    helper = await join(teacher, 'pay-helper@test.dz', 'CLASSROOM')
    attendance = await join(teacher, 'pay-attend@test.dz', 'FULL')
    postId = (await createPost(h.db, teacher, { groupId: g.id, body: 'اطرحوا أسئلتكم' })).id
    const course = await createCourse(h.db, admin, { title: 'دورة الأدب العربي', workspaceId: await workspaceIdOfTeacher(h.db, teacher), season: '2026/2027', priceDzd: 2500, accessEndsOn: '2027-06-30', status: 'DRAFT' })
    courseId = course.id
    courseSlug = course.slug
    courseGroupId = course.groupId!
  })
  afterAll(async () => {
    await h.close()
  })

  it('المشرف وحده يغيّر الأرقام', async () => {
    await expect(setAssistantPayConfig(h.db, teacher, { includedReplies: 1 })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await setAssistantPayConfig(h.db, admin, {
      ...DEFAULT_ASSISTANT_PAY,
      includedReplies: 1,
      termLimit: 1
    })
    expect((await getAssistantPayConfig(h.db)).includedReplies).toBe(1)
  })

  it('ردوده تُعدّ: الأوّل في الرّاتب، ثمّ قصير ومفصّل، ووسم «تصحيح تعبير»', async () => {
    await addComment(h.db, helper, postId, 'الجواب: الكناية.')
    const short = await addComment(h.db, helper, postId, 'راجع درس البلاغة.')
    await addComment(h.db, helper, postId, 'ش'.repeat(450))
    let m = await assistantMonth(h.db, helper, { month })
    expect(m.statement.repliesTotal).toBe(3)
    expect(m.statement.repliesAmount).toBe(40 + 80)

    await expect(setReplyCorrection(h.db, attendance, short.id, true)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(setReplyCorrection(h.db, student, short.id, true)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await setReplyCorrection(h.db, helper, short.id, true)
    await setReplyCorrection(h.db, helper, short.id, true)
    m = await assistantMonth(h.db, helper, { month })
    expect(m.statement.repliesAmount).toBe(150 + 80)
    expect(m.replies.find((r) => r.id === short.id)).toMatchObject({
      correction: true,
      kind: 'CORRECTION',
      included: false
    })
  })

  it('يرفع محتوى PDF أو Word فيُحسب فورًا، وحدّ الفصل يُطبَّق', async () => {
    await expect(
      submitAssistantContent(h.db, helper, {
        courseId,
        kind: 'EXAM',
        title: 'اختبار',
        pages: 0,
        file: pdf()
      })
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(
      submitAssistantContent(h.db, helper, {
        courseId,
        kind: 'EXAM',
        title: 'اختبار',
        pages: 2,
        file: {
          name: 'a.exe',
          type: 'application/x-msdownload',
          bytes: Buffer.from('MZ')
        }
      })
    ).rejects.toMatchObject({ code: 'FILE_TYPE_NOT_ALLOWED' })
    await expect(
      submitAssistantContent(h.db, attendance, {
        courseId,
        kind: 'EXAM',
        title: 'اختبار',
        pages: 2,
        file: pdf()
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    await submitAssistantContent(h.db, helper, {
      courseId,
      kind: 'EXAM',
      title: 'اختبار الفصل الأوّل',
      pages: 4,
      file: pdf()
    })
    await submitAssistantContent(h.db, helper, {
      courseId,
      kind: 'PROPOSAL',
      title: 'المقترح الثّاني',
      pages: 3,
      file: pdf()
    })
    const sum = await submitAssistantContent(h.db, helper, {
      courseId,
      kind: 'SUMMARY',
      title: 'ملخّص الإعراب',
      pages: 2,
      file: pdf('s.pdf')
    })
    // PDF فقط (يُعرض للتلميذ داخل المنصّة)
    await expect(
      submitAssistantContent(h.db, helper, { courseId, kind: 'SUMMARY', title: 'ملف وورد', pages: 1, file: { name: 's.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes: Buffer.from('PK') } })
    ).rejects.toMatchObject({ code: 'FILE_TYPE_NOT_ALLOWED' })
    // يُنشر فورًا داخل الدورة لفوجها (الملخّص في «الملفات»، الاختبار والمقترح في «الفروض والاختبارات»)
    const pub = await h.db
      .select({ id: content.id, type: content.type, visibility: content.visibility, published: content.publishedAt, groupId: contentTargets.groupId })
      .from(content)
      .innerJoin(contentTargets, eq(contentTargets.contentId, content.id))
      .where(and(eq(content.fileId, sum.fileId), isNull(content.deletedAt)))
    expect(pub).toHaveLength(1)
    expect(pub[0]).toMatchObject({ id: sum.contentId, type: 'PDF', visibility: 'GROUP_ONLY', groupId: courseGroupId })
    expect(pub[0]!.published).toBeTruthy()
    // في صفحة الدورة عند التلميذ: الملخّص في «الملفات»، الاختبار والمقترح في «الفروض والاختبارات»
    const learner = await makeStudent(h.db, 'تلميذ الدورة')
    await enrollStudent(h.db, admin, { courseId, studentId: learner.studentId!, source: 'MANUAL' })
    const home = await courseHome(h.db, learner, courseSlug)
    if (home.needsTerms) await acceptTerms(h.db, learner, courseId)
    const after = await courseHome(h.db, learner, courseSlug)
    if (after.needsTerms) throw new Error('terms')
    const doors = groupIntoDoors(after.sections)
    const titlesIn = (id: string) => doors.find((d) => d.id === id)!.groups.flatMap((g) => g.items.map((i) => i.title)).sort()
    expect(titlesIn('files')).toEqual(['ملخّص الإعراب'])
    expect(titlesIn('exams')).toEqual(['اختبار الفصل الأوّل', 'المقترح الثّاني'].sort())
    // ولو كان عنوانه «اختبار…» يبقى في «الملفات»
    expect(classifyContent({ title: 'اختبار الفصل الأوّل', type: 'PDF', forceSection: 'files' })).toBe('files')
    expect(classifyContent({ title: 'اختبار الفصل الأوّل', type: 'PDF' })).toBe('tests')
    await expect(
      submitAssistantContent(h.db, helper, { courseId: '00000000-0000-4000-8000-000000000000', kind: 'SUMMARY', title: 'دورة غريبة', pages: 1, file: pdf() })
    ).rejects.toMatchObject({ code: 'VALIDATION' })
    let m = await assistantMonth(h.db, helper, { month })
    // termLimit = 1 في هذا الاختبار: المقترح بعد الاختبار فوق الحدّ
    expect(m.content.find((c) => c.kind === 'PROPOSAL')?.overLimit).toBe(true)
    expect(m.statement.contentAmount).toBe(4000 + 800)
    expect(m.term).toMatchObject({ used: 2, limit: 1 })

    await expect(removeAssistantContent(h.db, helper, sum.id)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await removeAssistantContent(h.db, admin, sum.id)
    const [gone] = await h.db.select({ deletedAt: content.deletedAt }).from(content).where(eq(content.id, sum.contentId))
    expect(gone?.deletedAt).toBeTruthy()
    m = await assistantMonth(h.db, helper, { month })
    expect(m.statement.contentAmount).toBe(4000)
    expect(m.statement.total).toBe(40000 + 230 + 4000)
  })

  it('كلّ واحد يرى كشفه، والمشرف يسجّل الدّفع مرّة واحدة', async () => {
    await expect(
      assistantMonth(h.db, helper, {
        assistantUserId: attendance.userId,
        month
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(assistantMonth(h.db, attendance, { month })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(assistantMonth(h.db, teacher, { assistantUserId: helper.userId, month })).rejects.toMatchObject({ code: 'FORBIDDEN' })

    const paid = await markMonthPaid(h.db, admin, helper.userId, month)
    expect(paid.amount).toBe(44230)
    await expect(markMonthPaid(h.db, admin, helper.userId, month)).rejects.toMatchObject({ code: 'PAYOUT_ALREADY_RECORDED' })
    expect((await assistantMonth(h.db, helper, { month })).payout?.amount).toBe(44230)
    await cancelPayout(h.db, admin, helper.userId, month)
    expect(
      (
        await assistantMonth(h.db, admin, {
          assistantUserId: helper.userId,
          month
        })
      ).payout
    ).toBeNull()
  })
})
