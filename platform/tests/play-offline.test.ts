/**
 * تطبيق الهاتف الأصيل: حزمة PLAY دون إنترنت ورفع المحاولة (1 نوفمبر 2026).
 * الحزمة تحمل المفاتيح للتصحيح على الجهاز، والخادم يعيد التصحيح بمفاتيحه عند الرفع ولا يثق بالتطبيق.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { playExamSets } from '@/server/db/schema'
import { readExamSetFile, validateExamSet } from '@/server/play/exams/engine'
import type { ExamSetDocument, StepAnswer, StepAnswerKey } from '@/server/play/exams/types'
import { AppError } from '@/server/lib/errors'
import { offlineExamPackage, syncOfflineAttempt } from '@/server/services/play-exams.service'
import { setPlayProfile } from '@/server/services/play.service'
import { makeStudent, setupDb } from './helpers'

const FILE = 'content/play-exams/sets/2AS/AR/ar-2as-t1-sci-03.json'
let h: DatabaseHandle
let setUuid: string
let hiddenUuid: string

const right = (a: StepAnswerKey): StepAnswer | null =>
  a.type === 'mcq' ? { type: 'mcq', choice: a.correct } : a.type === 'multi' ? { type: 'multi', choices: a.correct } : a.type === 'fill_blank' ? { type: 'fill_blank', blanks: a.blanks.map((b) => b[0]!) } : a.type === 'matching' ? { type: 'matching', pairs: a.pairs } : null

beforeAll(async () => {
  h = await setupDb()
  const { doc: d, checksum } = readExamSetFile(FILE)
  const approved: ExamSetDocument = structuredClone(d)
  approved.set_id = 'offline-test'
  approved.status = 'APPROVED'
  approved.source.verified = true
  for (const s of approved.steps) if (s.type !== 'essay_builder') s.review_status = 'approved'
  expect(validateExamSet(approved).publishable).toBe(true)
  const base = { kind: 'TEST', gradeCode: '2AS', streamCodes: d.source.streams, subjectCode: 'AR', year: d.source.year, term: 1, paper: null, scoreTotal: 20, stepCount: d.steps.length }
  const [a] = await h.db.insert(playExamSets).values({ ...base, setId: approved.set_id, title: approved.source.title, status: 'APPROVED', publishable: true, checksum: 'off-' + checksum, document: approved }).returning()
  const [b] = await h.db.insert(playExamSets).values({ ...base, setId: 'offline-hidden', title: 'مخفي', status: 'NEEDS_HUMAN_REVIEW', publishable: false, checksum: 'hid-' + checksum, document: d }).returning()
  setUuid = a!.id
  hiddenUuid = b!.id
})
afterAll(async () => {
  await h.close()
})

describe('PLAY دون إنترنت', () => {
  it('الحزمة تحمل الخطوات القابلة للحل مع مفاتيحها وشرحها؛ الموضوع غير المنشور لا يُنزَّل', async () => {
    const s = await makeStudent(h.db, 'تلميذ تطبيق')
    await setPlayProfile(h.db, s, { gradeCode: '2AS', streamCode: 'SCI' })
    const pkg = await offlineExamPackage(h.db, s, setUuid)
    expect(pkg.steps.length).toBeGreaterThan(0)
    expect(pkg.steps.every((x) => x.answer && typeof x.explanation === 'string' && x.correctText.length > 0)).toBe(true)
    expect(pkg.steps.some((x) => (x.type as string) === 'essay_builder')).toBe(false)
    await expect(offlineExamPackage(h.db, s, hiddenUuid)).rejects.toSatisfy((e) => e instanceof AppError && e.code === 'PLAY_EXAM_NOT_FOUND')
  })

  it('المحاولة المرفوعة يصحّحها الخادم بمفاتيحه: الإجابات الصحيحة تأخذ العلامة الكاملة، والخطوة المجهولة تُتجاهل', async () => {
    const s = await makeStudent(h.db, 'تلميذ يرفع')
    await setPlayProfile(h.db, s, { gradeCode: '2AS', streamCode: 'SCI' })
    const pkg = await offlineExamPackage(h.db, s, setUuid)
    const answers: Record<string, StepAnswer> = { 'step-does-not-exist': { type: 'mcq', choice: 0 } }
    for (const st of pkg.steps) {
      const a = right(st.answer)
      if (a) answers[st.id] = a
    }
    const r = await syncOfflineAttempt(h.db, s, { setUuid, answers })
    expect(r.accepted).toBe(Object.keys(answers).length - 1)
    expect(r.score).toBeGreaterThan(0)
    expect(r.max).toBeGreaterThan(0)
    expect(r.score).toBeCloseTo(r.max, 1)
  })
})
