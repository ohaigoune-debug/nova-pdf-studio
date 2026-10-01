import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { exams, levels, subjects } from '@/server/db/schema'
import { seedCurriculum } from '@/server/db/seed-curriculum'
import type { Actor } from '@/server/lib/actor'
import { addItemFromBank, createExam, createFromTemplate, duplicateExam, examHistory, listExams, recordPrint, updateExam, workspaceStats } from '@/server/services/exams.service'
import { createGroup } from '@/server/services/groups.service'
import { createBankQuestion } from '@/server/services/question-bank.service'
import { makeAdmin, makeTeacher, setupDb } from './helpers'

let h: DatabaseHandle
let teacher: Actor
let other: Actor
let arabic: string
let math: string
let l3: string
let q1: string
let groupId: string

beforeAll(async () => {
  h = await setupDb()
  await seedCurriculum(h.db)
  const admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin)
  other = await makeTeacher(h.db, admin, 'أستاذ آخر')
  arabic = (await h.db.select({ id: subjects.id }).from(subjects).where(eq(subjects.code, 'ARABIC')))[0]!.id
  math = (await h.db.select({ id: subjects.id }).from(subjects).where(eq(subjects.code, 'MATH')))[0]!.id
  l3 = (await h.db.select({ id: levels.id }).from(levels).where(eq(levels.code, '3AS')))[0]!.id
  q1 = (await createBankQuestion(h.db, teacher, { kind: 'EXERCISE', type: 'OPEN', title: 'البناء الفكري', body: 'اقرأ النصّ ثم أجب.', points: 8, difficulty: 3, estimatedMinutes: 40, subjectId: arabic, levelId: l3 })).id
  groupId = (await createGroup(h.db, teacher, { name: 'فوج 3 ع ت' })).id
})

afterAll(async () => {
  await h.close()
})

describe('ورشة الأستاذ — المرحلة 6', () => {
  it('النطاقات والفلاتر: الكل / المسودات / الجاهزة / القوالب / الأرشيف', async () => {
    const a = await createExam(h.db, teacher, { title: 'اختبار الفصل الأول', subjectId: arabic, levelId: l3, schoolTerm: 1 })
    const b = await createExam(h.db, teacher, { title: 'فرض الرياضيات', kind: 'HOMEWORK', subjectId: math, levelId: l3 })
    const c = await createExam(h.db, teacher, { title: 'قالب بكالوريا بيضاء', kind: 'BAC_MOCK', subjectId: arabic, levelId: l3 })
    await updateExam(h.db, teacher, b.id, { status: 'READY' })
    await updateExam(h.db, teacher, c.id, { isTemplate: true })
    await updateExam(h.db, teacher, a.id, { groupId })
    await expect(updateExam(h.db, teacher, a.id, { groupId: '00000000-0000-4000-8000-000000000000' })).rejects.toMatchObject({ code: 'VALIDATION' })
    await createExam(h.db, other, { title: 'لأستاذ آخر' })

    const all = await listExams(h.db, teacher)
    expect(all.map((r) => r.title).sort()).toEqual(['اختبار الفصل الأول', 'فرض الرياضيات'])
    expect(all.find((r) => r.id === a.id)!.groupName).toBe('فوج 3 ع ت')
    expect((await listExams(h.db, teacher, { scope: 'draft' })).map((r) => r.id)).toEqual([a.id])
    expect((await listExams(h.db, teacher, { scope: 'ready' })).map((r) => r.id)).toEqual([b.id])
    expect((await listExams(h.db, teacher, { scope: 'templates' })).map((r) => r.id)).toEqual([c.id])
    expect((await listExams(h.db, teacher, { subjectId: math })).map((r) => r.id)).toEqual([b.id])
    expect((await listExams(h.db, teacher, { kind: 'HOMEWORK' })).map((r) => r.id)).toEqual([b.id])
    expect((await listExams(h.db, teacher, { groupId })).map((r) => r.id)).toEqual([a.id])
    expect((await listExams(h.db, teacher, { q: 'الفصل' })).map((r) => r.id)).toEqual([a.id])
    expect(await listExams(h.db, teacher, { scope: 'archived' })).toEqual([])
    await updateExam(h.db, teacher, b.id, { status: 'ARCHIVED' })
    expect((await listExams(h.db, teacher, { scope: 'archived' })).map((r) => r.id)).toEqual([b.id])
    expect((await listExams(h.db, teacher)).map((r) => r.id)).toEqual([a.id])
  })

  it('من قالب: نسخة كاملة ليست قالباً، والنسخ العادي لا يحمل القالب ولا عدّاد الطباعة', async () => {
    const tpl = (await listExams(h.db, teacher, { scope: 'templates' }))[0]!
    await addItemFromBank(h.db, teacher, tpl.id, q1)
    await updateExam(h.db, teacher, tpl.id, { header: { school: 'ثانوية قسنطينة' }, instructions: 'اقرأ جيداً' })
    await expect(createFromTemplate(h.db, other, tpl.id)).rejects.toMatchObject({ code: 'EXAM_NOT_FOUND' })
    const ex = await createFromTemplate(h.db, teacher, tpl.id)
    expect(ex.isTemplate).toBe(false)
    expect(ex.status).toBe('DRAFT')
    expect(ex.sourceExamId).toBe(tpl.id)
    expect(ex.title).toBe('قالب بكالوريا بيضاء')
    expect(ex.header.school).toBe('ثانوية قسنطينة')
    expect(ex.instructions).toBe('اقرأ جيداً')
    expect((await listExams(h.db, teacher)).some((r) => r.id === ex.id && r.items === 1)).toBe(true)
    // امتحان عادي لا يُستعمل كقالب
    await expect(createFromTemplate(h.db, teacher, ex.id)).rejects.toMatchObject({ code: 'EXAM_NOT_FOUND' })
    await recordPrint(h.db, teacher, ex.id, { mode: 'subject', variant: 'A' })
    await updateExam(h.db, teacher, ex.id, { isTemplate: true })
    const dup = await duplicateExam(h.db, teacher, ex.id)
    expect(dup.isTemplate).toBe(false)
    expect(dup.printCount).toBe(0)
    expect(dup.lastPrintedAt).toBeNull()
    expect(dup.sourceExamId).toBe(ex.id)
    await updateExam(h.db, teacher, ex.id, { isTemplate: false })
  })

  it('تسجيل الطباعة والسجلّ: أحداث، نسخ مشتقّة، وأصل', async () => {
    const tpl = (await listExams(h.db, teacher, { scope: 'templates' })).find((r) => r.title === 'قالب بكالوريا بيضاء')!
    const copy = (await listExams(h.db, teacher)).find((r) => r.title === 'قالب بكالوريا بيضاء')!
    await recordPrint(h.db, teacher, copy.id, { mode: 'correction', variant: 'B' })
    await expect(recordPrint(h.db, other, copy.id, { mode: 'subject', variant: 'A' })).rejects.toMatchObject({ code: 'EXAM_NOT_FOUND' })
    const [row] = await h.db.select().from(exams).where(eq(exams.id, copy.id))
    expect(row!.printCount).toBe(2)
    expect(row!.lastPrintedAt).not.toBeNull()
    const hist = await examHistory(h.db, teacher, copy.id)
    expect(hist.source).toEqual({ id: tpl.id, title: tpl.title })
    expect(hist.copies).toHaveLength(1)
    const actions = hist.events.map((e) => e.action)
    expect(actions[0]).toBe('exam.print')
    expect(hist.events[0]!.newValue).toEqual({ mode: 'correction', variant: 'B' })
    expect(actions).toContain('exam.from_template')
    expect(actions).toContain('exam.template')
    expect(hist.events.every((e) => e.actorName === teacher.fullName)).toBe(true)
    const tplHist = await examHistory(h.db, teacher, tpl.id)
    expect(tplHist.copies.map((c) => c.id)).toEqual([copy.id])
    expect(tplHist.source).toBeNull()
  })

  it('إحصاءات الورشة', async () => {
    const s = await workspaceStats(h.db, teacher)
    expect(s.exams).toEqual({ total: 3, draft: 3, ready: 0, templates: 1, archived: 1 })
    expect(s.prints.total).toBe(2)
    expect(s.prints.month).toBe(1)
    expect(s.bySubject.map((x) => x.name)).toContain('اللغة العربية')
    expect(s.byKind.find((k) => k.kind === 'BAC_MOCK')!.n).toBe(3)
    expect(s.difficulty[3]).toBe(3)
    expect(s.topQuestions[0]).toMatchObject({ id: q1, usageCount: 1 })
    expect(s.recent.length).toBeGreaterThan(0)
    expect(s.recent.every((r) => r.status !== 'ARCHIVED')).toBe(true)
    expect(s.printsByMonth).toHaveLength(1)
    expect(s.printsByMonth[0]!.n).toBe(2)
    // الأستاذ الآخر لا يرى شيئاً من هذا
    const o = await workspaceStats(h.db, other)
    expect(o.exams.total).toBe(1)
    expect(o.prints.total).toBe(0)
  })
})
