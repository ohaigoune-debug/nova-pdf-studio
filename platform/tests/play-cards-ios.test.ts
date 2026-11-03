/**
 * بطاقات PLAY في تطبيق الهاتف (3 نوفمبر 2026): الدروس، حزمة الدرس دون إنترنت، ورفع الجولة.
 * الرفع يمرّ بـ submitPlayAnswer نفسها: الخادم يعيد التصحيح ويحسب XP والإتقان، ولا يثق بالتطبيق.
 */
import { eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createSession, SESSION_COOKIE } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import type { DatabaseHandle } from '@/server/db/connect'
import { playAccessTrials, playLessons, playSessions, playStudentStats } from '@/server/db/schema'
import { asIosApp, type Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { PLAY_TRIAL_MS } from '@/server/play/constants'
import { importQuestions, syncCatalog } from '@/server/play/importer'
import type { PlayContentQuestion, PlayStudentAnswer } from '@/server/play/question-types'
import { lessonCards, lessonPack, syncCardRound, type CardQuestion } from '@/server/services/play-cards.service'
import { setPlayProfile } from '@/server/services/play.service'
import { GET as lessonsRoute } from '@/app/api/v1/ios/play/lessons/route'
import { GET as packRoute } from '@/app/api/v1/ios/play/lessons/[id]/route'
import { POST as syncRoute } from '@/app/api/v1/ios/play/cards/sync/route'
import { makeStudent, setupDb } from './helpers'

vi.mock('@/server/db/client', () => ({ getDb: vi.fn() }))

let h: DatabaseHandle
let lessonId: string

const catalog = {
  version: 1,
  grades: [{ grade: '3AS', subjects: [{ subject: 'AR', units: [{ code: 'U1', name: 'البلاغة', verified: true, lessons: [{ code: 'L1', name: 'الصور البيانية', verified: true }, { code: 'L2', name: 'المحسنات', verified: true }] }] }] }]
}

const mcq = (i: number): PlayContentQuestion => ({
  key: `3AS-AR-U1-L1-${String(i).padStart(4, '0')}`, type: 'MCQ', grade: '3AS', subject: 'AR', unit: 'U1', lesson: 'L1', difficulty: i % 3 === 0 ? 'HARD' : 'EASY',
  question: `ما نوع الصورة البيانية رقم ${i}؟`, options: ['تشبيه', 'استعارة', 'كناية', 'مجاز'], correct: 1, explanation: 'حُذف المشبه به وبقي شيء من لوازمه.'
})
const fill: PlayContentQuestion = {
  key: '3AS-AR-U1-L1-0100', type: 'FILL_BLANK', grade: '3AS', subject: 'AR', unit: 'U1', lesson: 'L1', difficulty: 'MEDIUM',
  question: 'الاستعارة ____ يُحذف فيها المشبه ____.', blanks: ['المكنية', 'به'], bank: ['المكنية', 'التصريحية', 'به', 'منه'], explanation: 'في المكنية يُحذف المشبه به ويُرمز إليه بشيء من لوازمه.'
}
const matching: PlayContentQuestion = {
  key: '3AS-AR-U1-L1-0101', type: 'MATCHING', grade: '3AS', subject: 'AR', unit: 'U1', lesson: 'L1', difficulty: 'MEDIUM',
  question: 'صِل كل صورة بنوعها', pairs: [{ left: 'زيد أسد', right: 'تشبيه بليغ' }, { left: 'رأيت أسدًا يخطب', right: 'استعارة تصريحية' }, { left: 'طويل النجاد', right: 'كناية' }], explanation: 'لكل صورة أركانها التي تميّزها عن غيرها.'
}
const ordering: PlayContentQuestion = {
  key: '3AS-AR-U1-L1-0102', type: 'ORDERING', grade: '3AS', subject: 'AR', unit: 'U1', lesson: 'L1', difficulty: 'EASY',
  question: 'رتّب خطوات تحليل الصورة', order: ['تحديد الصورة', 'شرحها', 'بيان نوعها', 'ذكر أثرها'], explanation: 'نحدد الصورة ثم نشرحها ثم نسميها ثم نبيّن أثرها.'
}

/** الإجابة الصحيحة من المفتاح الذي في الحزمة (كما يصحّح التطبيق) */
function right(q: CardQuestion): PlayStudentAnswer {
  const k = q.answerKey
  switch (k.type) {
    case 'MCQ': return { type: 'MCQ', key: k.correct }
    case 'FILL_BLANK': return { type: 'FILL_BLANK', blanks: k.answers.map((a) => a[0]!) }
    case 'MATCHING': return { type: 'MATCHING', matches: k.pairs }
    case 'ORDERING': return { type: 'ORDERING', order: k.order }
  }
}

async function student(): Promise<Actor> {
  const s = await makeStudent(h.db, 'تلميذ البطاقات')
  await setPlayProfile(h.db, s, { gradeCode: '3AS', streamCode: 'LIT' })
  return s
}

beforeAll(async () => {
  h = await setupDb()
  vi.mocked(getDb).mockResolvedValue(h.db)
  await syncCatalog(h.db, catalog)
  await importQuestions(h.db, [...Array.from({ length: 12 }, (_, i) => mcq(i + 1)), fill, matching, ordering])
  const [l] = await h.db.select({ id: playLessons.id }).from(playLessons).where(eq(playLessons.lessonCode, 'L1'))
  lessonId = l!.id
})
afterAll(async () => h.close())

describe('دروس المادة وحزمة الدرس', () => {
  it('الدروس بوحداتها وعدد أسئلتها، والحزمة بكل الأسئلة ومفاتيحها وشرحها', async () => {
    const s = await student()
    const list = await lessonCards(h.db, s, 'AR')
    expect(list.subject.code).toBe('AR')
    expect(list.units[0]!.lessons.map((l) => [l.lessonName, l.questions])).toEqual([['الصور البيانية', 15], ['المحسنات', 0]])
    expect(list.stats.level.title).toBeTruthy()
    const pack = await lessonPack(h.db, s, lessonId)
    expect(pack.questions).toHaveLength(15)
    expect(new Set(pack.questions.map((q) => q.type))).toEqual(new Set(['MCQ', 'FILL_BLANK', 'MATCHING', 'ORDERING']))
    expect(pack.questions.every((q) => q.answerKey && q.explanation && q.correctText)).toBe(true)
    expect(pack.roundSize).toBe(12)
    expect(pack.xp.correct).toBeGreaterThan(0)
    // أول حزمة تبدأ التجربة المجانية (كأول جولة في الموقع)
    const [trial] = await h.db.select().from(playAccessTrials).where(eq(playAccessTrials.studentId, s.studentId!))
    expect(trial).toBeTruthy()
  })

  it('التجربة المنتهية ترفض الحزمة', async () => {
    const s = await student()
    const past = new Date(Date.now() - PLAY_TRIAL_MS - 3_600_000)
    await h.db.insert(playAccessTrials).values({ studentId: s.studentId!, startedAt: past, endsAt: new Date(past.getTime() + PLAY_TRIAL_MS) })
    await expect(lessonPack(h.db, s, lessonId)).rejects.toSatisfy((e) => e instanceof AppError && e.code === 'PLAY_TRIAL_EXPIRED')
  })

  it('تطبيق الآيفون: PLAY مجانية — لا تجربة تبدأ، والتجربة المنتهية في الموقع لا تمنع (3 نوفمبر 2026)', async () => {
    const fresh = await student()
    expect((await lessonPack(h.db, asIosApp(fresh), lessonId)).questions).toHaveLength(15)
    expect(await h.db.select().from(playAccessTrials).where(eq(playAccessTrials.studentId, fresh.studentId!))).toHaveLength(0)

    const expired = await student()
    const past = new Date(Date.now() - PLAY_TRIAL_MS - 3_600_000)
    await h.db.insert(playAccessTrials).values({ studentId: expired.studentId!, startedAt: past, endsAt: new Date(past.getTime() + PLAY_TRIAL_MS) })
    const pack = await lessonPack(h.db, asIosApp(expired), lessonId)
    const q = pack.questions[0]!
    const r = await syncCardRound(h.db, asIosApp(expired), { lessonId, answers: [{ questionId: q.id, answer: right(q), timeMs: 3000 }] })
    expect(r).toMatchObject({ accepted: 1, correctCount: 1 })
    // والموقع يبقى على سياسته
    await expect(lessonPack(h.db, expired, lessonId)).rejects.toSatisfy((e) => e instanceof AppError && e.code === 'PLAY_TRIAL_EXPIRED')

    // عبر مسار التطبيق نفسه بكوكي الجلسة
    const token = (await createSession(h.db, { userId: expired.userId })).token
    const res = await packRoute(new NextRequest(`https://madrasadz.com/api/v1/ios/play/lessons/${lessonId}`, { headers: { cookie: `${SESSION_COOKIE}=${token}` } }), { params: Promise.resolve({ id: lessonId }) })
    expect(res.status).toBe(200)
  })
})

describe('رفع جولة البطاقات', () => {
  it('الخادم يعيد التصحيح بمفاتيحه ويحسب XP والإتقان ويُكمل الجلسة', async () => {
    const s = await student()
    const pack = await lessonPack(h.db, s, lessonId)
    const answers = pack.questions.slice(0, 12).map((q, i) => ({ questionId: q.id, answer: i < 10 ? right(q) : ({ type: 'MCQ', key: 'z' } as PlayStudentAnswer), timeMs: 4000 }))
    const r = await syncCardRound(h.db, s, { lessonId, answers })
    expect(r.accepted).toBe(12)
    expect(r.total).toBe(12)
    expect(r.correctCount).toBe(10)
    expect(r.xpEarned).toBeGreaterThan(0)
    expect(r.xpTotal).toBe(r.xpEarned)
    const [session] = await h.db.select().from(playSessions).where(eq(playSessions.id, r.sessionId!))
    expect(session).toMatchObject({ status: 'COMPLETED', challengeType: 'LESSON_MASTERY', lessonId, answeredCount: 12, correctCount: 10 })
    const [stats] = await h.db.select().from(playStudentStats).where(eq(playStudentStats.studentId, s.studentId!))
    expect(stats!.xpTotal).toBe(r.xpTotal)
    const after = await lessonCards(h.db, s, 'AR')
    expect(after.units[0]!.lessons[0]!.answered).toBe(12)
  })

  it('سؤال من درس آخر أو غير موجود يُتجاهل، والإجابة المزوّرة لا تُحتسب صحيحة', async () => {
    const s = await student()
    const pack = await lessonPack(h.db, s, lessonId)
    const q = pack.questions.find((x) => x.type === 'MCQ')!
    const r = await syncCardRound(h.db, s, { lessonId, answers: [{ questionId: '00000000-0000-4000-8000-000000000000', answer: right(q), timeMs: null }, { questionId: q.id, answer: { type: 'MCQ', key: 'a' }, timeMs: null }] })
    expect(r.accepted).toBe(1)
    expect(r.correctCount).toBe(0)
  })
})

describe('المسارات', () => {
  it('القراءة بالكوكي، والرفع يشترط ترويسة التطبيق', async () => {
    const s = await student()
    const token = (await createSession(h.db, { userId: s.userId })).token
    const cookie = `${SESSION_COOKIE}=${token}`
    const list = await lessonsRoute(new NextRequest('https://madrasadz.com/api/v1/ios/play/lessons?subject=AR', { headers: { cookie } }))
    expect(list.status).toBe(200)
    expect(list.headers.get('x-madrasadz-account')).toBe(s.userId)
    const pack = await packRoute(new NextRequest(`https://madrasadz.com/api/v1/ios/play/lessons/${lessonId}`, { headers: { cookie } }), { params: Promise.resolve({ id: lessonId }) })
    const body = await pack.json()
    expect(body.data.questions).toHaveLength(15)
    const q = body.data.questions[0] as CardQuestion
    const post = (ios: boolean) => syncRoute(new NextRequest('https://madrasadz.com/api/v1/ios/play/cards/sync', { method: 'POST', headers: { cookie, 'content-type': 'application/json', ...(ios ? { 'x-madrasadz-client': 'ios' } : {}) }, body: JSON.stringify({ lessonId, answers: [{ questionId: q.id, answer: right(q), timeMs: 1200 }] }) }))
    expect((await post(false)).status).toBe(403)
    const ok = await post(true)
    expect(ok.status).toBe(200)
    expect((await ok.json()).data).toMatchObject({ accepted: 1, correctCount: 1, total: 1 })
    expect((await lessonsRoute(new NextRequest('https://madrasadz.com/api/v1/ios/play/lessons?subject=a!', { headers: { cookie } }))).status).toBe(422)
  })
})
