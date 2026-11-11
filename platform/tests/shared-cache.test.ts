/**
 * الذاكرة القصيرة المشتركة (ttl-cache) — اختبار الضغط 4 نوفمبر 2026، الجزء الثاني:
 *  - ما يُحفظ هو المشترك بين كل الزوّار فقط (بيانات مرجعية، خريطة الأعداد، أحدث الدروس العامة، سياسة الإحالة للعرض)،
 *  - وما يخصّ تلميذًا (تقدّمه، محاولاته) لا يمرّ أبدًا من تلميذ إلى آخر عبر ذاكرة مشتركة ساخنة.
 * الذاكرة معطّلة في بقية الاختبارات؛ هنا تُفعَّل عمدًا (TTL_CACHE_IN_TESTS=1) وتُفرَّغ قبل كل اختبار.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { playExamSets, playLessonProgress, playLessons, playSubjects, wilayas } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { ttlDelete } from '@/server/lib/ttl-cache'
import { readExamSetFile, validateExamSet } from '@/server/play/exams/engine'
import type { ExamSetDocument } from '@/server/play/exams/types'
import { latestPublicContent, listPublicContent } from '@/server/queries/content.queries'
import { publicStudentsPerWilaya, studentsPerWilaya } from '@/server/queries/map.queries'
import { registerStudent } from '@/server/services/auth.service'
import { createContent } from '@/server/services/content.service'
import { finishExamAttempt, listExamSets, startExamAttempt } from '@/server/services/play-exams.service'
import { listLessonsFor, listSubjectsFor, setPlayProfile } from '@/server/services/play.service'
import { listLevels, listStreams, listWilayas } from '@/server/services/reference.service'
import { referralPolicy, referralPolicyForDisplay, setReferralPolicy } from '@/server/services/referrals.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb, uniq } from './helpers'

let h: DatabaseHandle
let admin: Actor
let teacher: Actor

beforeAll(async () => {
  process.env.TTL_CACHE_IN_TESTS = '1'
  h = await setupDb()
  admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin)
})

beforeEach(() => {
  ttlDelete('')
})

afterAll(async () => {
  delete process.env.TTL_CACHE_IN_TESTS
  ttlDelete('')
  await h.close()
})

describe('بيانات مرجعية مشتركة (صفحة التسجيل)', () => {
  it('الولايات والمستويات والشعب تُقرأ مرة ثم تُقدَّم من الذاكرة، وتُحدَّث بعد انقضاء عمرها', async () => {
    const first = await listWilayas(h.db)
    expect(first.map((w) => w.code)).toEqual(['24', '25'])
    expect((await listLevels(h.db)).map((l) => l.code)).toEqual(['3AS'])
    expect((await listStreams(h.db)).map((s) => s.code)).toEqual(['SCI'])

    await h.db.insert(wilayas).values({ code: '26', nameAr: 'المدية', nameFr: 'Médéa' })
    // داخل العمر: القائمة المحفوظة (لا استعلام جديد)
    expect((await listWilayas(h.db)).map((w) => w.code)).toEqual(['24', '25'])
    // بعد انقضاء العمر (هنا: إبطال المفتاح): القائمة الجديدة
    ttlDelete('ref:')
    expect((await listWilayas(h.db)).map((w) => w.code)).toEqual(['24', '25', '26'])
  })

  it('مستدعٍ يغيّر القائمة التي استلمها لا يفسد القائمة المحفوظة لغيره', async () => {
    const mine = await listWilayas(h.db)
    const n = mine.length
    mine.reverse()
    mine.pop()
    const next = await listWilayas(h.db)
    expect(next).toHaveLength(n)
    expect(next[0]!.code).toBe('24')
  })
})

describe('الصفحة الرئيسية العامة', () => {
  it('خريطة الولايات: أعداد مجمّعة فقط (لا اسم ولا معرّف تلميذ)، محفوظة للعموم وفورية للمشرف', async () => {
    const all = await h.db.select().from(wilayas)
    const guelma = all.find((w) => w.code === '24')!
    const email = `${uniq('s')}@test.dz`
    await registerStudent(h.db, { email, password: 'Student@12345', fullName: 'تلميذ سرّي الاسم', wilayaId: guelma.id })
    const before = await publicStudentsPerWilaya(h.db)
    for (const row of before) expect(Object.keys(row).sort()).toEqual(['code', 'name', 'students'])
    expect(JSON.stringify(before)).not.toContain('تلميذ سرّي الاسم')
    expect(JSON.stringify(before)).not.toContain(email)
    const n = before.find((r) => r.code === '24')!.students

    await registerStudent(h.db, { email: `${uniq('s')}@test.dz`, password: 'Student@12345', fullName: 'تلميذ ثانٍ', wilayaId: guelma.id })
    // العموم: الرقم المحفوظ حتى انقضاء الدقيقة؛ لوحة المشرف: الرقم الفوري
    expect((await publicStudentsPerWilaya(h.db)).find((r) => r.code === '24')!.students).toBe(n)
    expect((await studentsPerWilaya(h.db)).find((r) => r.code === '24')!.students).toBe(n + 1)
    ttlDelete('public:')
    expect((await publicStudentsPerWilaya(h.db)).find((r) => r.code === '24')!.students).toBe(n + 1)
  })

  it('أحدث الدروس: المنشور للعموم فقط — لا مسودة ولا محتوى خاص بالتلاميذ، حتى والذاكرة ساخنة', async () => {
    const pub = await createContent(h.db, teacher, { type: 'ARTICLE', title: 'مقال عام للرئيسية', visibility: 'PUBLIC', publish: true })
    const draft = await createContent(h.db, teacher, { type: 'ARTICLE', title: 'مسودة لا تُعرض', visibility: 'PUBLIC', publish: false })
    const priv = await createContent(h.db, teacher, { type: 'LESSON', title: 'درس للتلاميذ المسجّلين فقط', body: 'نص', visibility: 'STUDENTS_ONLY', publish: true })
    const latest = await latestPublicContent(h.db)
    const ids = latest.map((x) => x.id)
    expect(ids).toContain(pub.id)
    expect(ids).not.toContain(draft.id)
    expect(ids).not.toContain(priv.id)
    expect(latest.length).toBeLessThanOrEqual(6)
    // النتيجة نفسها التي يعيدها الاستعلام المباشر
    expect(ids).toEqual((await listPublicContent(h.db, { limit: 6 })).map((x) => x.id))
    // درس عام جديد: يظهر بعد انقضاء العمر، لا قبله
    const later = await createContent(h.db, teacher, { type: 'ARTICLE', title: 'مقال عام لاحق', visibility: 'PUBLIC', publish: true })
    expect((await latestPublicContent(h.db)).map((x) => x.id)).not.toContain(later.id)
    ttlDelete('public:')
    expect((await latestPublicContent(h.db)).map((x) => x.id)).toContain(later.id)
  })
})

describe('سياسة الإحالة للعرض (صفحة التسجيل)', () => {
  it('تعديل المشرف يُبطل الذاكرة فورًا، والقرار الماليّ يقرأ القاعدة دائمًا', async () => {
    const shown = await referralPolicyForDisplay(h.db)
    const next = await setReferralPolicy(h.db, admin, { welcomeCreditDzd: shown.welcomeCreditDzd + 100, enabled: !shown.enabled })
    expect((await referralPolicyForDisplay(h.db)).welcomeCreditDzd).toBe(next.welcomeCreditDzd)
    expect((await referralPolicyForDisplay(h.db)).enabled).toBe(!shown.enabled)
    expect(await referralPolicy(h.db)).toEqual(next)
  })
})

describe('لا يمرّ ما يخصّ تلميذًا إلى تلميذ آخر عبر الذاكرة المشتركة', () => {
  it('دروس PLAY: قائمة الدروس مشتركة، وتقدّم كل تلميذ له وحده', async () => {
    await h.db.insert(playSubjects).values({ code: 'AR', nameAr: 'اللغة العربية' }).onConflictDoNothing()
    const [lesson] = await h.db.insert(playLessons).values({ gradeCode: '3AS', subjectCode: 'AR', unitCode: 'U1', unitName: 'الوحدة الأولى', lessonCode: 'L1', lessonName: 'الاستعارة' }).returning()
    const a = await makeStudent(h.db, 'التلميذ أ')
    const b = await makeStudent(h.db, 'التلميذ ب')
    await h.db.insert(playLessonProgress).values({ studentId: a.studentId!, lessonId: lesson!.id, answered: 9, correct: 8, masteryPct: 88, masteredAt: new Date() })

    // أ يملأ الذاكرة المشتركة أولًا
    const forA = await listLessonsFor(h.db, '3AS', 'SCI', 'AR', a.studentId!)
    expect(forA[0]!.lessons[0]).toMatchObject({ lessonName: 'الاستعارة', masteryPct: 88, mastered: true, answered: 9 })
    // ب يقرأ من الذاكرة نفسها: القائمة نفسها بلا أي أثر من تقدّم أ
    const forB = await listLessonsFor(h.db, '3AS', 'SCI', 'AR', b.studentId!)
    expect(forB[0]!.lessons[0]).toMatchObject({ lessonName: 'الاستعارة', masteryPct: 0, mastered: false, answered: 0 })
    // وأ ما زال يرى تقدّمه بعد قراءة ب
    expect((await listLessonsFor(h.db, '3AS', 'SCI', 'AR', a.studentId!))[0]!.lessons[0]!.masteryPct).toBe(88)
    // المشترك نفسه (بلا تلميذ) لا يحمل تقدّم أحد
    expect((await listLessonsFor(h.db, '3AS', 'SCI', 'AR'))[0]!.lessons[0]!.answered).toBe(0)
    expect((await listSubjectsFor(h.db, '3AS', 'SCI')).map((s) => s.code)).toEqual(['AR'])
  })

  it('مواضيع PLAY: قائمة المواضيع مشتركة، ومحاولات كل تلميذ وأفضل نتيجته له وحده', async () => {
    const { doc: d, checksum } = readExamSetFile('content/play-exams/sets/2AS/AR/ar-2as-t1-sci-03.json')
    const approved: ExamSetDocument = structuredClone(d)
    approved.set_id = 'shared-cache-test-set'
    approved.status = 'APPROVED'
    approved.source.verified = true
    for (const s of approved.steps) if (s.type !== 'essay_builder') s.review_status = 'approved'
    expect(validateExamSet(approved).publishable).toBe(true)
    const [set] = await h.db
      .insert(playExamSets)
      .values({ kind: 'TEST', gradeCode: '2AS', streamCodes: d.source.streams, subjectCode: 'AR', year: d.source.year, term: 1, paper: null, scoreTotal: 20, stepCount: d.steps.length, setId: approved.set_id, title: approved.source.title, status: 'APPROVED', publishable: true, checksum: 'shared-' + checksum, document: approved })
      .returning()
    const a = await makeStudent(h.db, 'التلميذ أ')
    const b = await makeStudent(h.db, 'التلميذ ب')
    for (const s of [a, b]) await setPlayProfile(h.db, s, { gradeCode: '2AS', streamCode: 'SCI' })

    const { attemptId } = await startExamAttempt(h.db, a, set!.id, 'PRACTICE')
    await finishExamAttempt(h.db, a, attemptId)
    // أ يملأ الذاكرة المشتركة أولًا
    const forA = (await listExamSets(h.db, a, { subjectCode: 'AR', kind: 'TESTS' })).items.find((i) => i.id === set!.id)!
    expect(forA.attempts).toBe(1)
    expect(forA.best).not.toBeNull()
    const forB = (await listExamSets(h.db, b, { subjectCode: 'AR', kind: 'TESTS' })).items.find((i) => i.id === set!.id)!
    expect(forB).toMatchObject({ attempts: 0, best: null, title: forA.title, stepCount: forA.stepCount })
    expect((await listExamSets(h.db, a, { subjectCode: 'AR', kind: 'TESTS' })).items.find((i) => i.id === set!.id)!.attempts).toBe(1)
  })
})

describe('ttlMemo', () => {
  it('يحفظ نتيجة «thenable» (استعلام drizzle) مرة واحدة ولا يعيد تنفيذه عند كل قراءة', async () => {
    let runs = 0
    const thenable = { then: (ok: (v: number) => void) => ok(++runs) } as unknown as Promise<number>
    const { ttlMemo } = await import('@/server/lib/ttl-cache')
    expect(await ttlMemo('t:thenable', 60_000, () => thenable)).toBe(1)
    expect(await ttlMemo('t:thenable', 60_000, () => thenable)).toBe(1)
    expect(runs).toBe(1)
  })

  it('لا يحفظ الخطأ', async () => {
    const { ttlMemo } = await import('@/server/lib/ttl-cache')
    await expect(ttlMemo('t:err', 60_000, () => Promise.reject(new Error('x')))).rejects.toThrow('x')
    expect(await ttlMemo('t:err', 60_000, async () => 7)).toBe(7)
  })
})
