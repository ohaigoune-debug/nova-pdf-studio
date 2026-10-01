import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { bankQuestions, examItems, levels, subjects } from '@/server/db/schema'
import { seedCurriculum } from '@/server/db/seed-curriculum'
import type { Actor } from '@/server/lib/actor'
import { addFreeItem, addItemFromBank, createExam, deleteExam, duplicateExam, duplicateItem, examHeading, getExam, listExams, proposeDistribution, rebalancePoints, removeItem, reorderItems, updateExam, updateItem } from '@/server/services/exams.service'
import { createBankQuestion } from '@/server/services/question-bank.service'
import { makeAdmin, makeTeacher, setupDb } from './helpers'

let h: DatabaseHandle
let teacher: Actor
let other: Actor
let arabic: string
let l3: string
let qMcq: string
let qExercise: string
let qPublicOther: string

beforeAll(async () => {
  h = await setupDb()
  await seedCurriculum(h.db)
  const admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin)
  other = await makeTeacher(h.db, admin, 'أستاذ آخر')
  arabic = (await h.db.select({ id: subjects.id }).from(subjects).where(eq(subjects.code, 'ARABIC')))[0]!.id
  l3 = (await h.db.select({ id: levels.id }).from(levels).where(eq(levels.code, '3AS')))[0]!.id
  qMcq = (await createBankQuestion(h.db, teacher, { type: 'MCQ', body: 'نوع الصورة؟', options: [{ label: 'استعارة', isCorrect: true }, { label: 'كناية', isCorrect: false }], points: 2, difficulty: 1, estimatedMinutes: 3, subjectId: arabic, levelId: l3 })).id
  const ex = await createBankQuestion(h.db, teacher, { kind: 'EXERCISE', type: 'OPEN', title: 'البناء الفكري', body: 'اقرأ النصّ ثم أجب.', points: 8, difficulty: 3, estimatedMinutes: 40, subjectId: arabic, levelId: l3, solution: 'الحلّ…' })
  qExercise = ex.id
  await createBankQuestion(h.db, teacher, { type: 'OPEN', body: 'ما الفكرة العامة؟', points: 3, parentId: ex.id, sortOrder: 0 })
  await createBankQuestion(h.db, teacher, { type: 'OPEN', body: 'ما موقف الشاعر؟', points: 5, parentId: ex.id, sortOrder: 1 })
  qPublicOther = (await createBankQuestion(h.db, other, { type: 'TRUE_FALSE', body: 'عام من أستاذ آخر', answerKey: { value: true }, points: 1, difficulty: 2, visibility: 'PUBLIC' })).id
  await createBankQuestion(h.db, other, { type: 'TRUE_FALSE', body: 'خاص بأستاذ آخر', answerKey: { value: false }, points: 1 })
})

afterAll(async () => {
  await h.close()
})

describe('محرّر الامتحان — المرحلة 2', () => {
  it('إنشاء، ترويسة مشتقّة، وإدراج من البنك بنسخة مجمّدة واحتساب الاستعمال', async () => {
    const ex = await createExam(h.db, teacher, { title: 'اختبار الفصل الأول', kind: 'TEST', subjectId: arabic, levelId: l3, schoolTerm: 1, durationMinutes: 120 })
    expect(ex.academicYear).toBe('2026/2027')
    expect(examHeading(ex)).toBe('اختبار الفصل الأول')
    expect(ex.header.teacherName).toBe(teacher.fullName)
    await expect(getExam(h.db, other, ex.id)).rejects.toMatchObject({ code: 'EXAM_NOT_FOUND' })

    const i1 = await addItemFromBank(h.db, teacher, ex.id, qExercise)
    expect(i1.kind).toBe('EXERCISE')
    expect(i1.snapshot.children).toHaveLength(2)
    expect(i1.snapshot.solution).toBe('الحلّ…')
    const i2 = await addItemFromBank(h.db, teacher, ex.id, qMcq)
    expect(i2.kind).toBe('QUESTION')
    // العام من الآخرين يُدرج، والخاص لا
    await addItemFromBank(h.db, teacher, ex.id, qPublicOther)
    const privateOther = (await h.db.select().from(bankQuestions).where(eq(bankQuestions.body, 'خاص بأستاذ آخر')))[0]!
    await expect(addItemFromBank(h.db, teacher, ex.id, privateOther.id)).rejects.toMatchObject({ code: 'BANK_QUESTION_NOT_FOUND' })
    const used = (await h.db.select().from(bankQuestions).where(eq(bankQuestions.id, qExercise)))[0]!
    expect(used.usageCount).toBe(1)
    expect(used.lastUsedAt).not.toBeNull()

    const view = await getExam(h.db, teacher, ex.id)
    expect(view.items.map((i) => i.kind)).toEqual(['EXERCISE', 'QUESTION', 'QUESTION'])
    expect(view.numbering[i1.id]).toBe('التمرين الأول')
    expect(view.numbering[i2.id]).toBe('السؤال 1')
    expect(Number(view.totalPoints)).toBe(11) // 8 (3+5) + 2 + 1
    expect(view.difficultySummary).toMatchObject({ counts: { 1: 1, 2: 1, 3: 1 }, minutes: 43 })
    expect(view.difficultySummary.label).toBe('متوسط إلى صعب')
    // تعديل البنك لا يمسّ الورقة
    await h.db.update(bankQuestions).set({ body: 'نصّ تغيّر' }).where(eq(bankQuestions.id, qMcq))
    expect((await getExam(h.db, teacher, ex.id)).items[1]!.snapshot.body).toBe('نوع الصورة؟')
  })

  it('ترتيب، نسخ، حذف، فاصل صفحة، تمرين حرّ، وتعديل داخل الورقة', async () => {
    const ex = (await listExams(h.db, teacher))[0]!
    const view = await getExam(h.db, teacher, ex.id)
    const ids = view.items.map((i) => i.id)
    await reorderItems(h.db, teacher, ex.id, [ids[2]!, ids[0]!, ids[1]!])
    expect((await getExam(h.db, teacher, ex.id)).items.map((i) => i.id)).toEqual([ids[2], ids[0], ids[1]])
    await expect(reorderItems(h.db, teacher, ex.id, [ids[0]!])).rejects.toMatchObject({ code: 'VALIDATION' })

    const pb = await addFreeItem(h.db, teacher, ex.id, { kind: 'PAGE_BREAK', position: 1 })
    expect((await getExam(h.db, teacher, ex.id)).items.map((i) => i.kind)).toEqual(['QUESTION', 'PAGE_BREAK', 'EXERCISE', 'QUESTION'])
    const free = await addFreeItem(h.db, teacher, ex.id, { kind: 'EXERCISE', body: 'تمرين من كتابتي', points: 4 })
    expect(Number((await getExam(h.db, teacher, ex.id)).totalPoints)).toBe(15)
    await expect(addFreeItem(h.db, teacher, ex.id, { kind: 'TEXT', body: '  ' })).rejects.toMatchObject({ code: 'VALIDATION' })

    const dup = await duplicateItem(h.db, teacher, free.id)
    expect(dup.position).toBe(free.position + 1)
    expect(Number((await getExam(h.db, teacher, ex.id)).totalPoints)).toBe(19)
    await removeItem(h.db, teacher, dup.id)
    await removeItem(h.db, teacher, pb.id)
    const after = await getExam(h.db, teacher, ex.id)
    expect(after.items.map((i) => i.position)).toEqual([0, 1, 2, 3])
    expect(Number(after.totalPoints)).toBe(15)

    // تعديل فرعيات التمرين يعيد حساب المجموع؛ البنك لا يتغيّر
    const exercise = after.items.find((i) => i.kind === 'EXERCISE' && i.bankQuestionId === qExercise)!
    await updateItem(h.db, teacher, exercise.id, { childPoints: [2, 4], title: 'التمرين الأول: النصّ', solution: 'حلّ معدَّل' })
    const v2 = await getExam(h.db, teacher, ex.id)
    const e2 = v2.items.find((i) => i.id === exercise.id)!
    expect(e2.snapshot.children!.map((c) => c.points)).toEqual([2, 4])
    expect(e2.points).toBeNull()
    expect(v2.numbering[e2.id]).toBe('التمرين الأول: النصّ')
    expect(Number(v2.totalPoints)).toBe(13)
    expect((await h.db.select().from(bankQuestions).where(eq(bankQuestions.id, qExercise)))[0]!.solution).toBe('الحلّ…')
    await expect(updateItem(h.db, other, exercise.id, { body: 'x' })).rejects.toMatchObject({ code: 'EXAM_NOT_FOUND' })
  })

  it('توزيع النقاط على المجموع المستهدف', async () => {
    expect(proposeDistribution([4, 5, 6, 6], 20)).toEqual([4, 5, 5.5, 5.5])
    expect(proposeDistribution([3, 3, 3], 20).reduce((a, b) => a + b, 0)).toBe(20)
    expect(proposeDistribution([1, 1, 1, 1], 10)).toEqual([2.5, 2.5, 2.5, 2.5])
    expect(proposeDistribution([], 20)).toEqual([])
    const ex = (await listExams(h.db, teacher))[0]!
    const r = await rebalancePoints(h.db, teacher, ex.id)
    expect(r.total).toBe(20)
    const v = await getExam(h.db, teacher, ex.id)
    const exercise = v.items.find((i) => i.bankQuestionId === qExercise)!
    expect(exercise.snapshot.children!.reduce((a, c) => a + (c.points ?? 0), 0)).toBe(Number(exercise.points))
  })

  it('إعدادات، نسخ الامتحان، وحذفه', async () => {
    const ex = (await listExams(h.db, teacher))[0]!
    const u = await updateExam(h.db, teacher, ex.id, { header: { school: 'ثانوية الإخوة بلقاسم', heading: 'اختبار تجريبي' }, durationMinutes: 180, status: 'READY' })
    expect(u.header).toMatchObject({ school: 'ثانوية الإخوة بلقاسم', heading: 'اختبار تجريبي', teacherName: teacher.fullName })
    expect(examHeading(u)).toBe('اختبار تجريبي')
    await expect(updateExam(h.db, teacher, ex.id, { durationMinutes: 2 })).rejects.toMatchObject({ code: 'VALIDATION' })
    const copy = await duplicateExam(h.db, teacher, ex.id)
    expect(copy).toMatchObject({ title: `${ex.title} (نسخة)`, status: 'DRAFT', sourceExamId: ex.id })
    expect((await h.db.select().from(examItems).where(eq(examItems.examId, copy.id))).length).toBe(4)
    expect((await listExams(h.db, teacher)).length).toBe(2)
    await deleteExam(h.db, teacher, copy.id)
    expect((await listExams(h.db, teacher)).length).toBe(1)
    await expect(deleteExam(h.db, other, ex.id)).rejects.toMatchObject({ code: 'EXAM_NOT_FOUND' })
  })
})
