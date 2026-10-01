import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setAiProviderForTests } from '@/server/ai/provider'
import type { AIProvider, ExtractQuestionsInput } from '@/server/ai/types'
import { answerKeyFromText, parseExtract } from '@/server/ai/shared'
import type { DatabaseHandle } from '@/server/db/connect'
import { bankQuestions, jobs, notifications, subjects, levels } from '@/server/db/schema'
import { seedCurriculum } from '@/server/db/seed-curriculum'
import { processQueuedJobs } from '@/server/jobs/runner'
import type { Actor } from '@/server/lib/actor'
import { uploadFile } from '@/server/services/files.service'
import { approveReviewed, bankStats, createBankQuestion, deleteBankQuestion, getBankQuestion, importQuizToBank, listBankQuestions, requestQuestionExtraction, setBankQuestionStatus, toggleFavorite, tsQueryOf, updateBankQuestion } from '@/server/services/question-bank.service'
import { createQuiz } from '@/server/services/quizzes.service'
import { createGroup } from '@/server/services/groups.service'
import { makeAdmin, makeTeacher, setupDb } from './helpers'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

let h: DatabaseHandle
let admin: Actor
let teacher: Actor
let other: Actor
let arabic: string
let l3: string

beforeAll(async () => {
  h = await setupDb()
  await seedCurriculum(h.db)
  admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin)
  other = await makeTeacher(h.db, admin, 'أستاذ آخر')
  arabic = (await h.db.select({ id: subjects.id }).from(subjects).where(eq(subjects.code, 'ARABIC')))[0]!.id
  l3 = (await h.db.select({ id: levels.id }).from(levels).where(eq(levels.code, '3AS')))[0]!.id
  process.env.UPLOADS_DIR = await mkdtemp(path.join(tmpdir(), 'bank-uploads-'))
  process.env.DRIVE_CACHE_DIR = await mkdtemp(path.join(tmpdir(), 'bank-cache-'))
})

afterAll(async () => {
  setAiProviderForTests(null)
  await h.close()
})

describe('بنك الأسئلة — المرحلة 1', () => {
  it('إنشاء بتصنيف كامل، فحص المفاتيح، والبحث النصّي والفلاتر', async () => {
    const q1 = await createBankQuestion(h.db, teacher, {
      kind: 'QUESTION',
      type: 'MCQ',
      body: 'ما نوع الصورة البيانية في «رأيت أسداً يخطب»؟',
      options: [
        { label: 'استعارة تصريحية', isCorrect: true },
        { label: 'كناية', isCorrect: false },
        { label: 'تشبيه', isCorrect: false }
      ],
      points: 2,
      difficulty: 2,
      estimatedMinutes: 3,
      subjectId: arabic,
      levelId: l3,
      schoolTerm: 1,
      examKind: 'BAC',
      sourceLabel: 'بكالوريا 2024 — آداب وفلسفة',
      sourceYear: 2024,
      rightsStatus: 'PUBLIC_DOMAIN',
      keywords: ['البلاغة', 'الاستعارة'],
      solution: 'استعارة تصريحية: صُرّح بالمشبّه به (أسداً).'
    })
    expect(q1).toMatchObject({ status: 'PUBLISHED', visibility: 'PRIVATE', workspaceId: teacher.workspaceId, difficulty: 2 })
    expect(q1.searchText).toContain('الاستعاره')
    // MCQ بلا إجابة صحيحة يُرفض
    await expect(createBankQuestion(h.db, teacher, { type: 'MCQ', body: 'س', options: [{ label: 'أ', isCorrect: false }, { label: 'ب', isCorrect: false }] })).rejects.toMatchObject({ code: 'BANK_INVALID_QUESTION' })
    await expect(createBankQuestion(h.db, teacher, { type: 'OPEN', body: 'س', points: 0 })).rejects.toMatchObject({ code: 'VALIDATION' })

    const q2 = await createBankQuestion(h.db, teacher, { kind: 'EXERCISE', type: 'OPEN', title: 'التمرين الثاني', body: 'ادرس تغيّرات الدالة $f(x)=e^x-x$', points: 6, difficulty: 3, estimatedMinutes: 25, subjectId: (await h.db.select({ id: subjects.id }).from(subjects).where(eq(subjects.code, 'MATH')))[0]!.id, levelId: l3, schoolTerm: 1, keywords: ['الدوال'] })
    await createBankQuestion(h.db, teacher, { type: 'SHORT_ANSWER', body: 'ما هي نهاية الدالة عند +∞؟', answerKey: { accepted: ['+∞'] }, parentId: q2.id, points: 2 })
    // الأستاذ الآخر لا يرى الخاص
    expect((await listBankQuestions(h.db, other, {})).items).toHaveLength(0)
    // الفلاتر والبحث
    expect(tsQueryOf('تمارين الدوال صعبة')).toBe('تمارين:* & الدوال:* & صعبه:*')
    const mine = await listBankQuestions(h.db, teacher, { scope: 'mine' })
    expect(mine.items.map((i) => i.kind).sort()).toEqual(['EXERCISE', 'QUESTION'])
    expect(mine.items.find((i) => i.id === q2.id)!.children).toBe(1)
    expect((await listBankQuestions(h.db, teacher, { q: 'الدوال' })).items.map((i) => i.id)).toEqual([q2.id])
    expect((await listBankQuestions(h.db, teacher, { q: 'استعارة' })).items.map((i) => i.id)).toEqual([q1.id])
    expect((await listBankQuestions(h.db, teacher, { subjectId: arabic, difficulties: [2], examKind: 'BAC', sourceYear: 2024, hasSolution: true })).items.map((i) => i.id)).toEqual([q1.id])
    expect((await listBankQuestions(h.db, teacher, { difficulties: [3], minPoints: 5 })).items.map((i) => i.id)).toEqual([q2.id])
    expect((await listBankQuestions(h.db, teacher, { types: ['MCQ'], hasSolution: false })).items).toHaveLength(0)
    const full = await getBankQuestion(h.db, teacher, q2.id)
    expect(full.subs).toHaveLength(1)
    expect(full.subs[0]!.type).toBe('SHORT_ANSWER')
  })

  it('العام المنشور يراه الآخرون، والمفضّلة والأرشفة والتعديل تحترم الملكية', async () => {
    const pub = await createBankQuestion(h.db, other, { type: 'TRUE_FALSE', body: 'الكناية من علم البيان.', answerKey: { value: true }, visibility: 'PUBLIC', subjectId: arabic, levelId: l3 })
    const seen = await listBankQuestions(h.db, teacher, { scope: 'public' })
    expect(seen.items.map((i) => i.id)).toEqual([pub.id])
    expect((await listBankQuestions(h.db, teacher, { scope: 'all' })).items.some((i) => i.id === pub.id)).toBe(true)
    await expect(updateBankQuestion(h.db, teacher, pub.id, { type: 'OPEN', body: 'x' })).rejects.toMatchObject({ code: 'BANK_QUESTION_NOT_FOUND' })
    await expect(setBankQuestionStatus(h.db, teacher, pub.id, 'ARCHIVED')).rejects.toMatchObject({ code: 'BANK_QUESTION_NOT_FOUND' })
    expect(await toggleFavorite(h.db, teacher, pub.id)).toEqual({ favorite: true })
    expect((await listBankQuestions(h.db, teacher, { scope: 'favorites' })).items.map((i) => i.id)).toEqual([pub.id])
    expect(await toggleFavorite(h.db, teacher, pub.id)).toEqual({ favorite: false })
    // أرشفة سؤال من بنكي يخفيه من «الكل» ويبقى بالفلتر الصريح
    const mine = (await listBankQuestions(h.db, teacher, { scope: 'mine', q: 'استعارة' })).items[0]!
    await setBankQuestionStatus(h.db, teacher, mine.id, 'ARCHIVED')
    expect((await listBankQuestions(h.db, teacher, { scope: 'mine', q: 'استعارة' })).items).toHaveLength(0)
    expect((await listBankQuestions(h.db, teacher, { scope: 'mine', statuses: ['ARCHIVED'] })).items.map((i) => i.id)).toEqual([mine.id])
    await setBankQuestionStatus(h.db, teacher, mine.id, 'PUBLISHED')
    const stats = await bankStats(h.db, teacher)
    expect(stats.mine).toBe(2)
  })

  it('أسئلة اختبار إلكتروني تُنسخ إلى البنك بمفاتيحها، بلا تكرار', async () => {
    const group = await createGroup(h.db, teacher, { name: 'فوج البنك' })
    const quiz = await createQuiz(h.db, teacher, {
      title: 'اختبار البلاغة',
      topic: 'البلاغة',
      isPublic: false,
      publish: false,
      maxAttempts: 1,
      groupIds: [group.id],
      studentIds: [],
      questions: [
        { type: 'TRUE_FALSE', prompt: 'التشبيه البليغ حُذفت منه الأداة ووجه الشبه.', points: 1, answerKey: { value: true }, options: [] },
        { type: 'MCQ', prompt: 'أركان التشبيه؟', points: 2, answerKey: null, options: [{ label: 'أربعة', isCorrect: true }, { label: 'اثنان', isCorrect: false }] }
      ]
    })
    const r = await importQuizToBank(h.db, teacher, quiz.id, { subjectId: arabic, levelId: l3, schoolTerm: 2 })
    expect(r).toEqual({ imported: 2, skipped: 0 })
    await expect(importQuizToBank(h.db, teacher, quiz.id)).rejects.toMatchObject({ code: 'BANK_NOTHING_TO_IMPORT' })
    const got = (await listBankQuestions(h.db, teacher, { examKind: 'QUIZ' })).items
    expect(got).toHaveLength(2)
    expect(got.find((i) => i.type === 'MCQ')!.options).toEqual([{ label: 'أربعة', isCorrect: true }, { label: 'اثنان', isCorrect: false }])
    expect(got.every((i) => i.schoolTerm === 2 && i.sourceLabel === 'اختبار: اختبار البلاغة')).toBe(true)
    await expect(importQuizToBank(h.db, other, quiz.id)).rejects.toMatchObject({ code: 'QUIZ_NOT_FOUND' })
  })

  it('الاستخراج من ملف يذهب إلى المراجعة لا إلى البنك، ثم يُعتمد ما يصلح', async () => {
    const text = ['التمرين الأول: (04 نقاط)', 'اشرح الاستعارة المكنية في قول الشاعر.', '', 'التمرين الثاني: (06 نقاط)', 'أعرب ما تحته خط: «العلمُ نورٌ».', 'الحل: العلم مبتدأ مرفوع.'].join('\n')
    const f = await uploadFile(h.db, teacher, { originalName: 'اختبار الفصل الأول 2023.txt', mimeType: 'text/plain', bytes: Buffer.from(text) })
    // بلا مزوّد حقيقي: مرفوض
    setAiProviderForTests(null)
    await expect(requestQuestionExtraction(h.db, teacher, { fileIds: [f.id] })).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' })
    const extractor = {
      name: 'openai',
      model: 'x',
      async extractQuestions(input: ExtractQuestionsInput) {
        expect(input.text).toContain('التمرين الأول')
        return parseExtract({
          questions: [
            { kind: 'EXERCISE', type: 'OPEN', title: 'التمرين الأول', body: 'اشرح الاستعارة المكنية في قول الشاعر.', options: [], answer_key: null, solution: null, points: 4, difficulty: 2, estimated_minutes: 10, topic: 'البلاغة', keywords: ['الاستعارة'], children: [] },
            { kind: 'EXERCISE', type: 'OPEN', title: 'التمرين الثاني', body: 'أعرب ما تحته خط: «العلمُ نورٌ».', options: [], answer_key: null, solution: 'العلم مبتدأ مرفوع.', points: 6, difficulty: 3, estimated_minutes: 15, topic: 'النحو', keywords: ['الإعراب'], children: [{ kind: 'QUESTION', type: 'MCQ', title: null, body: 'سؤال فرعي بلا إجابة صحيحة', options: [{ label: 'أ', is_correct: false }, { label: 'ب', is_correct: false }], answer_key: null, solution: null, points: null, difficulty: 1, estimated_minutes: null, topic: null, keywords: [] }] }
          ],
          note: null
        })
      }
    } as unknown as AIProvider
    setAiProviderForTests(extractor)
    const r = await requestQuestionExtraction(h.db, teacher, { fileIds: [f.id], subjectId: arabic, levelId: l3, schoolTerm: 1, examKind: 'TEST', sourceLabel: 'ثانوية قسنطينة', sourceYear: 2023, rightsStatus: 'THIRD_PARTY' })
    expect(r.files).toBe(1)
    await processQueuedJobs(h.db)
    const [j] = await h.db.select().from(jobs).where(eq(jobs.id, r.jobId))
    expect(j!.status).toBe('COMPLETED')
    expect(j!.result).toMatchObject({ extracted: 3 })
    const review = await listBankQuestions(h.db, teacher, { scope: 'review' })
    expect(review.items).toHaveLength(2)
    expect(review.items.every((i) => i.status === 'NEEDS_REVIEW' && i.sourceLabel === 'ثانوية قسنطينة' && i.sourceYear === 2023 && i.rightsStatus === 'THIRD_PARTY' && i.originalFileId === f.id)).toBe(true)
    const second = review.items.find((i) => i.title === 'التمرين الثاني')!
    expect(second).toMatchObject({ solution: 'العلم مبتدأ مرفوع.', points: '6.00', difficulty: 3, children: 1 })
    expect(second.keywords).toEqual(['الإعراب', 'النحو'])
    // لا شيء منها في «الكل» قبل الاعتماد
    expect((await listBankQuestions(h.db, teacher, { scope: 'all', q: 'الاستعارة المكنية' })).items).toHaveLength(0)
    const n = await h.db.select().from(notifications).where(eq(notifications.userId, teacher.userId))
    expect(n.some((x) => x.title.includes('بانتظار مراجعتك'))).toBe(true)

    const a = await approveReviewed(h.db, teacher, review.items.map((i) => i.id))
    expect(a.approved).toBe(2)
    expect((await listBankQuestions(h.db, teacher, { scope: 'review' })).items).toHaveLength(0)
    // الفرعي المعطوب (MCQ بلا إجابة) بقي للمراجعة ولم يُنشر مع أمّه
    const sub = (await h.db.select().from(bankQuestions).where(eq(bankQuestions.parentId, second.id)))[0]!
    expect(sub.status).toBe('NEEDS_REVIEW')
    await expect(approveReviewed(h.db, teacher, [sub.id])).resolves.toEqual({ approved: 0 })
    // أرشفة/حذف
    await deleteBankQuestion(h.db, teacher, second.id)
    expect((await h.db.select().from(bankQuestions).where(eq(bankQuestions.id, sub.id)))[0]!.deletedAt).not.toBeNull()
  })

  it('مفاتيح الإجابة من نصّ المستخرج تطابق المصحّح الآلي', () => {
    expect(answerKeyFromText('TRUE_FALSE', 'صحيح')).toEqual({ value: true })
    expect(answerKeyFromText('TRUE_FALSE', 'faux')).toEqual({ value: false })
    expect(answerKeyFromText('SHORT_ANSWER', 'الفاعل | فاعل')).toEqual({ accepted: ['الفاعل', 'فاعل'] })
    expect(answerKeyFromText('FILL_BLANK', 'مرفوع|منصوب')).toEqual({ blanks: [['مرفوع'], ['منصوب']] })
    expect(answerKeyFromText('OPEN', 'x')).toBeNull()
    const out = parseExtract({ questions: [{ kind: 'nope', type: 'weird', body: 'نصّ', difficulty: 9 }], note: 'ملاحظة' })
    expect(out.questions[0]).toMatchObject({ kind: 'QUESTION', type: 'OPEN', difficulty: 2, children: [] })
    expect(out.note).toBe('ملاحظة')
  })
})
