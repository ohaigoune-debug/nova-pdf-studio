/**
 * MADRASA PLAY — محرك مجموعات الفروض والاختبارات والبكالوريا (06_SCORING_AND_QA، 12_MANDATORY_ACCEPTANCE_GATES).
 * يُختبر على تحويل حقيقي من أرشيف المالك (اختبار الفصل الأول 2 ثانوي علمي) وعلى نسخ معدّلة منه.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { gradeStep, publicSteps, readExamSetFile, scoreSteps, stepFingerprint, validateExamSet } from '@/server/play/exams/engine'
import type { ExamSetDocument, TrainingStep } from '@/server/play/exams/types'
import { loadAll } from '../scripts/play/exams'

const REAL = join(process.cwd(), 'content/play-exams/sets/2AS/AR/ar-2as-t1-sci-03.json')
const fresh = (): ExamSetDocument => structuredClone(readExamSetFile(REAL).doc)
const codes = (doc: ExamSetDocument, opts = {}) => validateExamSet(doc, opts).errors.map((e) => e.code)

function approve(doc: ExamSetDocument): ExamSetDocument {
  doc.status = 'APPROVED'
  doc.source.verified = true
  doc.source.verified_by = 'owner'
  doc.source.verified_at = '2026-10-29T08:00:00Z'
  for (const q of doc.original_questions) for (const e of q.rubric_elements) e.verified = true
  for (const s of doc.steps) if (s.type !== 'essay_builder') s.review_status = 'approved'
  return doc
}

describe('real converted set: 2AS Arabic term-1 test n°03 (scientific streams)', () => {
  it('validates with no errors: Σ steps = 20, essay deferred, not publishable before human review', () => {
    const v = validateExamSet(fresh())
    expect(v.errors).toEqual([])
    expect(v.totalPoints).toBeCloseTo(20)
    expect(v.deferredPoints).toBe(4)
    expect(v.publishable).toBe(false)
    expect(v.warnings.some((w) => w.code === 'SOURCE_UNVERIFIED')).toBe(true)
    expect(Object.values(v.stepStatus).filter((s) => s === 'needs_engine_support')).toHaveLength(4)
  })

  it('every rubric element is covered with weights equal to its mark', () => {
    const doc = fresh()
    for (const q of doc.original_questions) {
      for (const e of q.rubric_elements) {
        const w = doc.steps.filter((s) => s.rubric_element_id === e.id).reduce((a, s) => a + s.points, 0)
        expect(w, e.id).toBeCloseTo(e.max_points)
      }
    }
  })

  it('correct options are shuffled, not always first', () => {
    const idx = fresh().steps.filter((s) => s.answer.type === 'mcq').map((s) => (s.answer.type === 'mcq' ? s.answer.correct : -1))
    expect(new Set(idx).size).toBeGreaterThan(2)
  })

  it('becomes publishable only after the owner approves source, rubric and every interactive step', () => {
    expect(validateExamSet(approve(fresh())).publishable).toBe(true)
    const oneLeft = approve(fresh())
    oneLeft.steps[0]!.review_status = 'needs_human_review'
    expect(validateExamSet(oneLeft).publishable).toBe(false)
    const noCorrection = approve(fresh())
    noCorrection.source.correction_file_ref = null
    noCorrection.source.correction_url = null
    expect(validateExamSet(noCorrection).publishable).toBe(false)
  })
})

describe('scoring rules', () => {
  it('detects weight drift, uncovered elements and total mismatch', () => {
    const drift = fresh()
    drift.steps[0]!.points += 0.25
    expect(codes(drift)).toEqual(expect.arrayContaining(['WEIGHT_MISMATCH', 'TOTAL_MISMATCH']))
    const uncovered = fresh()
    uncovered.steps = uncovered.steps.filter((s) => s.rubric_element_id !== 'q2-e1')
    expect(codes(uncovered)).toEqual(expect.arrayContaining(['ELEMENT_NOT_COVERED', 'TOTAL_MISMATCH']))
    const rubric = fresh()
    rubric.original_questions[0]!.rubric_elements[0]!.max_points = 2
    expect(codes(rubric)).toContain('RUBRIC_TOTAL_MISMATCH')
  })

  it('BAC sets must be 3AS, have a year and paper 1|2, and total 20', () => {
    const bac = fresh()
    bac.source.kind = 'BAC'
    bac.source.term = null
    bac.source.year = null
    bac.source.paper = null
    expect(codes(bac)).toEqual(expect.arrayContaining(['BAC_LEVEL', 'SCHEMA']))
    bac.source.level = '3AS'
    bac.source.year = 2019
    bac.source.paper = 1
    expect(codes(bac)).toEqual([])
    bac.score_total = 40
    expect(codes(bac)).toContain('BAC_TOTAL_NOT_20')
  })

  it('a step marked verbatim must equal the original question text', () => {
    const doc = fresh()
    doc.steps[0]!.is_verbatim_original = true
    expect(codes(doc)).toContain('VERBATIM_CLAIM')
    doc.steps[0]!.prompt = doc.original_questions[0]!.verbatim_text
    expect(codes(doc)).not.toContain('VERBATIM_CLAIM')
  })

  it('invalid answer keys are rejected', () => {
    const doc = fresh()
    const mcq = doc.steps.find((s) => s.answer.type === 'mcq')!
    if (mcq.answer.type === 'mcq') mcq.answer.correct = 9
    expect(codes(doc)).toContain('ANSWER_INVALID')
  })

  it('identical steps across sets are flagged as duplicates', () => {
    const doc = fresh()
    const seen = new Map<string, string>([[stepFingerprint(doc.steps[3]!), 'other-set:s1']])
    expect(codes(doc, { seenFingerprints: seen })).toContain('DUPLICATE_CONTENT')
  })

  it('fixtures are never publishable and must declare synthetic_fixture', () => {
    const fx = approve(fresh())
    fx.fixture = true
    expect(codes(fx)).toContain('FIXTURE')
    fx.source.trust = 'synthetic_fixture'
    const v = validateExamSet(fx)
    expect(v.errors).toEqual([])
    expect(v.publishable).toBe(false)
  })
})

describe('portraits: real local image with source, licence and attribution, or blocked', () => {
  const portrait = (localPath: string): TrainingStep => ({
    id: 'p1',
    source_question_id: 'q2',
    rubric_element_id: 'q2-e1',
    variant: 'p',
    type: 'portrait',
    prompt: 'من صاحب هذه الصورة؟',
    payload: {
      type: 'portrait',
      options: ['الأمير عبد القادر', 'ابن باديس', 'مصالي الحاج', 'فرحات عباس'],
      media: { local_path: localPath, source_url: 'https://commons.wikimedia.org/wiki/File:Example.jpg', attribution: 'Unknown photographer', license: 'Public domain', image_verified_at: '2026-10-29', sha256: 'abc', width: 400, height: 500, depicts: 'الشخصية', alt: 'صورة' }
    },
    answer: { type: 'portrait', correct: 0 },
    explanation: 'شرح',
    points: 0.5,
    skill_id: null,
    lesson_ref: null,
    is_verbatim_original: false,
    review_status: 'approved'
  })

  it('missing file ⇒ needs_media_review and the set cannot be published', () => {
    // يحلّ سؤال الصورة (0.5) محلّ الخطوة s05 (0.5) من العنصر نفسه فتبقى الأوزان سليمة
    const doc = approve(fresh())
    doc.steps = doc.steps.filter((s) => s.id !== 's05').concat(portrait('/play/portraits/missing.jpg'))
    const v = validateExamSet(doc)
    expect(v.errors).toEqual([])
    expect(v.stepStatus.p1).toBe('needs_media_review')
    expect(v.publishable).toBe(false)
  })

  it('an existing local file with full attribution passes the media gate', () => {
    const root = mkdtempSync(join(tmpdir(), 'play-public-'))
    mkdirSync(join(root, 'play/portraits'), { recursive: true })
    writeFileSync(join(root, 'play/portraits/ok.jpg'), Buffer.from([0xff, 0xd8, 0xff]))
    const doc = approve(fresh())
    doc.steps = doc.steps.filter((s) => s.id !== 's05').concat(portrait('/play/portraits/ok.jpg'))
    const v = validateExamSet(doc, { publicRoot: root })
    expect(v.errors).toEqual([])
    expect(v.stepStatus.p1).toBe('approved')
    expect(v.publishable).toBe(true)
  })
})

describe('grading every interaction on the server', () => {
  it('mcq / multi / fill_blank / ordering / matching / numeric / short_text', () => {
    expect(gradeStep({ type: 'mcq', correct: 2 }, { type: 'mcq', choice: 2 })).toBe(1)
    expect(gradeStep({ type: 'mcq', correct: 2 }, { type: 'mcq', choice: 1 })).toBe(0)
    expect(gradeStep({ type: 'multi', correct: [0, 1] }, { type: 'multi', choices: [0, 1] })).toBe(1)
    expect(gradeStep({ type: 'multi', correct: [0, 1] }, { type: 'multi', choices: [0] })).toBe(0.5)
    expect(gradeStep({ type: 'multi', correct: [0, 1] }, { type: 'multi', choices: [0, 2] })).toBe(0)
    expect(gradeStep({ type: 'multi', correct: [0, 1, 2, 3] }, { type: 'multi', choices: [0, 1, 2, 3, 4, 5] })).toBe(0.5)
    expect(gradeStep({ type: 'fill_blank', blanks: [['الفتحة'], ['الكسرة']] }, { type: 'fill_blank', blanks: ['الفَتْحة', 'الضمة'] })).toBe(0.5)
    expect(gradeStep({ type: 'ordering', order: [2, 0, 1] }, { type: 'ordering', order: [2, 0, 1] })).toBe(1)
    expect(gradeStep({ type: 'ordering', order: [2, 0, 1] }, { type: 'ordering', order: [2, 1, 0] })).toBeCloseTo(1 / 3)
    expect(gradeStep({ type: 'matching', pairs: [1, 0, 2] }, { type: 'matching', pairs: [1, 0, 2] })).toBe(1)
    expect(gradeStep({ type: 'numeric', value: 1954, tolerance: 0, unit: null }, { type: 'numeric', value: 1954 })).toBe(1)
    expect(gradeStep({ type: 'numeric', value: 3.5, tolerance: 0.1, unit: 'كم' }, { type: 'numeric', value: 3.58 })).toBe(1)
    expect(gradeStep({ type: 'short_text', accepted: ['استعارة مكنية'] }, { type: 'short_text', text: 'استعارةٌ مكنيّة' })).toBe(1)
    expect(gradeStep({ type: 'mcq', correct: 0 }, { type: 'multi', choices: [0] })).toBe(0)
    expect(gradeStep({ type: 'mcq', correct: 0 }, null)).toBe(0)
  })

  it('score = Σ(w × s) with the original weights; perfect answers give 16/16 interactive points', () => {
    const doc = fresh()
    const interactive = doc.steps.filter((s) => s.type !== 'essay_builder')
    const perfect: Record<string, never> = {}
    for (const s of interactive) {
      const a = s.answer
      ;(perfect as Record<string, unknown>)[s.id] =
        a.type === 'mcq' ? { type: 'mcq', choice: a.correct }
        : a.type === 'multi' ? { type: 'multi', choices: a.correct }
        : a.type === 'fill_blank' ? { type: 'fill_blank', blanks: a.blanks.map((b) => b[0]) }
        : a.type === 'matching' ? { type: 'matching', pairs: a.pairs }
        : null
    }
    const r = scoreSteps(interactive, perfect)
    expect(r.max).toBeCloseTo(16)
    expect(r.score).toBeCloseTo(16)
    const half = scoreSteps(interactive, {})
    expect(half.score).toBe(0)
  })

  it('public steps carry no answer key and hide deferred types', () => {
    const pub = publicSteps(fresh())
    expect(pub).toHaveLength(35)
    const json = JSON.stringify(pub)
    expect(json).not.toContain('"answer"')
    expect(json).not.toContain('"correct"')
    expect(json).not.toContain('"pairs"')
    expect(pub.every((s) => s.type !== 'essay_builder')).toBe(true)
  })
})

describe('pipeline', () => {
  it('loads every content file, each with a checksum, and no set has errors', () => {
    const { sets, failures } = loadAll()
    expect(failures).toEqual([])
    expect(sets.length).toBeGreaterThan(0)
    for (const s of sets) {
      expect(s.checksum).toMatch(/^[0-9a-f]{64}$/)
      expect(s.validation.errors, s.doc.set_id).toEqual([])
    }
  })
})
