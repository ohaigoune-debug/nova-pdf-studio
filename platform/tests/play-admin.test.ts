import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { playQuestions } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { importQuestions, syncCatalog } from '@/server/play/importer'
import type { PlayContentQuestion } from '@/server/play/question-types'
import { getPlayRules, reportQuestion, setPlayProfile, updatePlayRules } from '@/server/services/play.service'
import {
  archiveQuestion,
  bulkReviewByFilter,
  bulkSetReviewStatus,
  coverageMatrix,
  duplicateGroups,
  exportQuestions,
  getQuestionAdmin,
  lessonsLackingQuestions,
  listLessonsAdmin,
  listQuestionsAdmin,
  listReports,
  listReportsDetailed,
  nextManualKey,
  playAdminOverview,
  resolveReport,
  setReviewStatus,
  setSuspended,
  upsertQuestionManual
} from '@/server/services/play-admin.service'
import { makeAdmin, makeStudent, setupDb } from './helpers'

let h: DatabaseHandle
let admin: Actor
let student: Actor

const catalog = {
  version: 1,
  grades: [
    {
      grade: '3AS',
      subjects: [
        {
          subject: 'AR',
          units: [
            { code: 'U1', name: 'البناء اللغوي', verified: true, lessons: [{ code: 'L1', name: 'الصور البيانية', verified: true }, { code: 'L2', name: 'إعراب المفردات', verified: true }, { code: 'L3', name: 'المحسنات البديعية' }] }
          ]
        },
        { subject: 'MATH', streams: ['SCI', 'MATH'], units: [{ code: 'U1', name: 'الدوال', lessons: [{ code: 'L1', name: 'النهايات' }] }] }
      ]
    }
  ]
}

function q(key: string, patch: Partial<PlayContentQuestion> = {}): PlayContentQuestion {
  return {
    key,
    type: 'MCQ',
    grade: '3AS',
    subject: 'AR',
    unit: 'U1',
    lesson: 'L1',
    difficulty: 'EASY',
    question: `ما نوع الصورة البيانية في «ابتسم الصباح»؟ (${key})`,
    options: ['تشبيه بليغ', 'استعارة مكنية', 'كناية', 'مجاز مرسل'],
    correct: 1,
    explanation: 'شُبّه الصباح بإنسان يبتسم وحُذف المشبه به وأبقيت لازمة من لوازمه.',
    ...patch
  }
}

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  student = await makeStudent(h.db, 'تلميذ مبلِّغ')
  await syncCatalog(h.db, catalog)
  const batch: PlayContentQuestion[] = []
  for (let i = 1; i <= 60; i++) batch.push(q(`3AS-AR-U1-L1-${String(i).padStart(4, '0')}`, { difficulty: i % 3 === 0 ? 'HARD' : i % 2 === 0 ? 'MEDIUM' : 'EASY' }))
  batch.push(q('3AS-AR-U1-L2-0001', { lesson: 'L2', type: 'FILL_BLANK', question: 'إنَّ العلمَ ____', options: undefined, correct: undefined, blanks: ['نافعٌ'], bank: ['نافعٌ', 'نافعًا', 'نافعٍ', 'نافعْ'], difficulty: 'MEDIUM' }))
  batch.push(q('3AS-MATH-U1-L1-0001', { subject: 'MATH', streams: ['SCI'], question: 'نهاية 1/x عندما x → +∞ هي؟', options: ['0', '1', '+∞', '−1'], correct: 0, explanation: 'كلما كبر x صغر 1/x واقترب من الصفر دون أن يبلغه.' }))
  const r = await importQuestions(h.db, batch)
  expect(r.inserted).toBe(62)
})

afterAll(async () => {
  await h.close()
})

describe('التفويض', () => {
  it('كل دوال الإدارة ترفض غير المشرف العام بـ FORBIDDEN', async () => {
    const [row] = await h.db.select({ id: playQuestions.id }).from(playQuestions).limit(1)
    const id = row!.id
    await expectCode(() => listQuestionsAdmin(h.db, student, {}), 'FORBIDDEN')
    await expectCode(() => getQuestionAdmin(h.db, student, id), 'FORBIDDEN')
    await expectCode(() => setReviewStatus(h.db, student, id, 'APPROVED'), 'FORBIDDEN')
    await expectCode(() => bulkSetReviewStatus(h.db, student, [id], 'APPROVED'), 'FORBIDDEN')
    await expectCode(() => bulkReviewByFilter(h.db, student, { grade: '3AS' }, 'APPROVED'), 'FORBIDDEN')
    await expectCode(() => setSuspended(h.db, student, id, true), 'FORBIDDEN')
    await expectCode(() => archiveQuestion(h.db, student, id), 'FORBIDDEN')
    await expectCode(() => upsertQuestionManual(h.db, student, q('3AS-AR-U1-L1-9001')), 'FORBIDDEN')
    await expectCode(() => listReports(h.db, student), 'FORBIDDEN')
    await expectCode(() => listReportsDetailed(h.db, student), 'FORBIDDEN')
    await expectCode(() => resolveReport(h.db, student, id, 'RESOLVED'), 'FORBIDDEN')
    await expectCode(() => playAdminOverview(h.db, student), 'FORBIDDEN')
    await expectCode(() => coverageMatrix(h.db, student), 'FORBIDDEN')
    await expectCode(() => lessonsLackingQuestions(h.db, student), 'FORBIDDEN')
    await expectCode(() => duplicateGroups(h.db, student), 'FORBIDDEN')
    await expectCode(() => exportQuestions(h.db, student, {}), 'FORBIDDEN')
    await expectCode(() => listLessonsAdmin(h.db, student), 'FORBIDDEN')
    await expectCode(() => nextManualKey(h.db, student, '3AS', 'AR', 'U1', 'L1'), 'FORBIDDEN')
    await expectCode(() => updatePlayRules(h.db, student, { publicLeaderboard: true }), 'FORBIDDEN')
  })
})

describe('القائمة والتصفية', () => {
  it('ترقيم 50 في الصفحة وتصفية بالمادة/النوع/الصعوبة/البحث', async () => {
    const p1 = await listQuestionsAdmin(h.db, admin, { page: 1, pageSize: 50 })
    expect(p1.total).toBe(62)
    expect(p1.items.length).toBe(50)
    expect(p1.items[0]?.lessonName).toBeTruthy()
    const p2 = await listQuestionsAdmin(h.db, admin, { page: 2, pageSize: 50 })
    expect(p2.items.length).toBe(12)
    expect(new Set([...p1.items, ...p2.items].map((i) => i.id)).size).toBe(62)

    expect((await listQuestionsAdmin(h.db, admin, { subject: 'MATH' })).total).toBe(1)
    expect((await listQuestionsAdmin(h.db, admin, { type: 'FILL_BLANK' })).total).toBe(1)
    expect((await listQuestionsAdmin(h.db, admin, { difficulty: 'HARD' })).total).toBe(20)
    expect((await listQuestionsAdmin(h.db, admin, { search: '0007' })).total).toBe(1)
    expect((await listQuestionsAdmin(h.db, admin, { stream: 'LIT' })).total).toBe(61) // MATH مقصورة على SCI
    expect((await listQuestionsAdmin(h.db, admin, { unit: 'U9' })).total).toBe(0)
  })

  it('النظرة العامة تحسب الأعداد حسب الحالة والنوع', async () => {
    const ov = await playAdminOverview(h.db, admin)
    expect(ov.total).toBe(62)
    expect(ov.byType.MCQ).toBe(61)
    expect(ov.byType.FILL_BLANK).toBe(1)
    expect(ov.byGrade['3AS']).toBe(62)
    expect(ov.openReports).toBe(0)
  })
})

describe('المراجعة والتعليق', () => {
  it('تغيير الحالة فردياً وجماعياً وبالمرشّح', async () => {
    const list = await listQuestionsAdmin(h.db, admin, { subject: 'AR', pageSize: 10 })
    const [a, b, c] = list.items
    await setReviewStatus(h.db, admin, a!.id, 'APPROVED', 'ممتاز')
    const d = await getQuestionAdmin(h.db, admin, a!.id)
    expect(d.reviewStatus).toBe('APPROVED')
    expect(d.note).toBe('ممتاز')
    expect(d.reviewedByUserId).toBe(admin.userId)

    expect(await bulkSetReviewStatus(h.db, admin, [b!.id, c!.id, 'not-a-uuid'], 'REJECTED')).toBe(2)
    expect((await listQuestionsAdmin(h.db, admin, { status: 'REJECTED' })).total).toBe(2)

    const before = (await listQuestionsAdmin(h.db, admin, { status: 'NEEDS_REVIEW' })).total
    const n = await bulkReviewByFilter(h.db, admin, { subject: 'AR', status: 'AUTO_VALIDATED', difficulty: 'HARD' }, 'NEEDS_REVIEW')
    expect(n).toBeGreaterThan(0)
    expect((await listQuestionsAdmin(h.db, admin, { status: 'NEEDS_REVIEW' })).total).toBe(before + n)
    expect((await listQuestionsAdmin(h.db, admin, { status: 'AUTO_VALIDATED', difficulty: 'HARD', subject: 'AR' })).total).toBe(0)
    await expectCode(() => setReviewStatus(h.db, admin, a!.id, 'BOGUS' as never), 'VALIDATION')
    await expectCode(() => setReviewStatus(h.db, admin, '00000000-0000-0000-0000-000000000000', 'APPROVED'), 'PLAY_QUESTION_NOT_FOUND')
  })

  it('التعليق وإلغاؤه والأرشفة', async () => {
    const [row] = await h.db.select({ id: playQuestions.id }).from(playQuestions).where(eq(playQuestions.key, '3AS-AR-U1-L1-0010'))
    await setSuspended(h.db, admin, row!.id, true)
    expect((await listQuestionsAdmin(h.db, admin, { suspended: true })).items.map((i) => i.id)).toEqual([row!.id])
    expect((await playAdminOverview(h.db, admin)).suspended).toBe(1)
    await setSuspended(h.db, admin, row!.id, false)
    expect((await listQuestionsAdmin(h.db, admin, { suspended: true })).total).toBe(0)

    const [arch] = await h.db.select({ id: playQuestions.id }).from(playQuestions).where(eq(playQuestions.key, '3AS-AR-U1-L1-0011'))
    await archiveQuestion(h.db, admin, arch!.id)
    expect((await listQuestionsAdmin(h.db, admin, {})).total).toBe(61)
    expect((await exportQuestions(h.db, admin, {})).find((e) => e.key === '3AS-AR-U1-L1-0011')).toBeUndefined()
  })
})

describe('الإنشاء اليدوي', () => {
  it('يولّد المفتاح التالي 9NNN ويحفظ بصيغة المحتوى', async () => {
    expect(await nextManualKey(h.db, admin, '3AS', 'AR', 'U1', 'L3')).toBe('3AS-AR-U1-L3-9001')
    const id = await upsertQuestionManual(h.db, admin, q('3AS-AR-U1-L3-9001', { lesson: 'L3', question: 'ما المحسن البديعي في «يحيا ويموت»؟', options: ['طباق', 'جناس', 'سجع', 'مقابلة'], correct: 0, explanation: 'الجمع بين الشيء وضده في الكلام طباق إيجاب.' }))
    const d = await getQuestionAdmin(h.db, admin, id)
    expect(d.source).toBe('TEACHER')
    expect(d.reviewStatus).toBe('APPROVED')
    expect(d.lessonName).toBe('المحسنات البديعية')
    expect(await nextManualKey(h.db, admin, '3AS', 'AR', 'U1', 'L3')).toBe('3AS-AR-U1-L3-9002')
    // تعديل
    await upsertQuestionManual(h.db, admin, q('3AS-AR-U1-L3-9001', { lesson: 'L3', question: 'ما المحسن البديعي في «يحيا ويموت» ؟ (معدَّل)', options: ['طباق', 'جناس', 'سجع', 'مقابلة'], correct: 0, explanation: 'الجمع بين الشيء وضده في الكلام طباق إيجاب.', difficulty: 'HARD' }), id)
    expect((await getQuestionAdmin(h.db, admin, id)).difficulty).toBe('HARD')
    await expectCode(() => upsertQuestionManual(h.db, admin, q('3AS-AR-U1-L3-9002', { lesson: 'L3', correct: 9 })), 'VALIDATION')
    await expectCode(() => upsertQuestionManual(h.db, admin, q('3AS-AR-U2-L1-9001', { unit: 'U2' })), 'PLAY_LESSON_NOT_FOUND')
    const lessons = await listLessonsAdmin(h.db, admin)
    expect(lessons.length).toBe(4)
  })
})

describe('البلاغات', () => {
  it('تُدرج مع اسم التلميذ وتُعالَج بقرار', async () => {
    await setPlayProfile(h.db, student, { gradeCode: '3AS', streamCode: 'LIT' })
    const [row] = await h.db.select({ id: playQuestions.id }).from(playQuestions).where(eq(playQuestions.key, '3AS-AR-U1-L1-0020'))
    await reportQuestion(h.db, student, { questionId: row!.id, reason: 'TYPO', message: 'خطأ إملائي في الخيار الثالث' })
    const open = await listReportsDetailed(h.db, admin, 'OPEN')
    expect(open.length).toBe(1)
    expect(open[0]?.studentName).toBe('تلميذ مبلِّغ')
    expect(open[0]?.key).toBe('3AS-AR-U1-L1-0020')
    expect((await playAdminOverview(h.db, admin)).openReports).toBe(1)
    expect((await listQuestionsAdmin(h.db, admin, { reported: true })).total).toBe(1)
    await resolveReport(h.db, admin, open[0]!.id, 'RESOLVED', 'صُحّح الخيار')
    expect((await listReportsDetailed(h.db, admin, 'OPEN')).length).toBe(0)
    const resolved = await listReportsDetailed(h.db, admin, 'RESOLVED')
    expect(resolved[0]?.resolution).toBe('صُحّح الخيار')
    expect((await getQuestionAdmin(h.db, admin, row!.id)).reports[0]?.status).toBe('RESOLVED')
    await expectCode(() => resolveReport(h.db, admin, '00000000-0000-0000-0000-000000000000', 'DISMISSED'), 'NOT_FOUND')
  })
})

describe('القواعد', () => {
  it('updatePlayRules ذهاباً وإياباً مع دمج جزئي', async () => {
    const before = await getPlayRules(h.db)
    expect(before.xp.correct).toBe(10)
    const next = await updatePlayRules(h.db, admin, { xp: { ...before.xp, correct: 12 }, mastery: { minAnswered: 10, minPct: 85 }, servableStatuses: ['APPROVED', 'PUBLISHED'], publicLeaderboard: true, levels: [{ title: 'مبتدئ', minXp: 0 }, { title: 'خبير', minXp: 500 }] })
    expect(next.xp.correct).toBe(12)
    expect(next.xp.correctHard).toBe(15)
    const after = await getPlayRules(h.db)
    expect(after).toEqual(next)
    expect(after.levels.length).toBe(2)
    expect(after.servableStatuses).toEqual(['APPROVED', 'PUBLISHED'])
    expect(after.publicLeaderboard).toBe(true)
    // تعديل جزئي لا يمسح الباقي
    await updatePlayRules(h.db, admin, { publicLeaderboard: false })
    const again = await getPlayRules(h.db)
    expect(again.publicLeaderboard).toBe(false)
    expect(again.xp.correct).toBe(12)
  })
})

describe('التغطية', () => {
  it('مصفوفة سنة × مادة والدروس الفارغة', async () => {
    const m = await coverageMatrix(h.db, admin)
    const ar = m.find((c) => c.subjectCode === 'AR')!
    const math = m.find((c) => c.subjectCode === 'MATH')!
    expect(ar.gradeCode).toBe('3AS')
    expect(ar.lessons).toBe(3)
    expect(ar.lessonsWithQuestions).toBe(3) // L3 صار له سؤال يدوي
    expect(ar.questions).toBe(61) // 60 − 1 مؤرشف + 1 L2 + 1 L3
    expect(ar.verifiedLessons).toBe(2)
    expect(math.lessons).toBe(1)
    expect(math.questions).toBe(1)
    const lacking = await lessonsLackingQuestions(h.db, admin, 3)
    expect(lacking.map((l) => `${l.subjectCode}-${l.lessonCode}`).sort()).toEqual(['AR-L2', 'AR-L3', 'MATH-L1'])
    expect(await duplicateGroups(h.db, admin)).toEqual([])
  })
})
