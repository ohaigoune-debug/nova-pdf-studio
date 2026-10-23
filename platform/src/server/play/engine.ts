/**
 * MADRASADZ PLAY — المحرك النقي (بلا قاعدة بيانات): تطبيع السؤال، التحقق البنيوي، التصحيح، الخلط الحتمي، التحقق الحسابي.
 * يُستعمل من الخدمات ومن سكربتات مصنع الأسئلة ومن الاختبارات.
 */
import { createHash } from 'node:crypto'
import { normalizeArabic } from '@/server/lib/arabic'
import { PLAY_DIFFICULTIES, PLAY_LANGUAGES, PLAY_QUESTION_TYPES, PLAY_REVIEW_STATUSES, PLAY_SOURCES, gradeByCode, type PlayLanguage } from './constants'
import type { FillSegment, GradeOutcome, NormalizedPlayQuestion, PlayAnswerKey, PlayContentQuestion, PlayPublicPayload, PlayStudentAnswer } from './question-types'

export const OPTION_KEYS = ['a', 'b', 'c', 'd', 'e', 'f'] as const
const BLANK_RE = /_{3,}/g

export interface ValidationResult {
  errors: string[]
  warnings: string[]
}

/** مقارنة دقيقة لكلمات الفراغ: التشكيل مهم (نافعٌ ≠ نافعًا) لذلك لا نستعمل normalizeArabic هنا */
export function exactToken(s: string): string {
  return s.normalize('NFKC').replace(/ـ/g, '').replace(/\s+/g, ' ').trim()
}

/** بصمة المحتوى لكشف التكرار (غير حساسة للتشكيل والترقيم) */
export function contentHash(q: Pick<PlayContentQuestion, 'question' | 'options' | 'blanks' | 'pairs' | 'order'>): string {
  const parts = [normalizeArabic(q.question)]
  if (q.options) parts.push(...q.options.map(normalizeArabic).sort())
  if (q.blanks) parts.push(...q.blanks.map((b) => normalizeArabic(Array.isArray(b) ? (b[0] ?? '') : b)))
  if (q.pairs) parts.push(...q.pairs.map((p) => normalizeArabic(p.left + '=' + p.right)).sort())
  if (q.order) parts.push(...q.order.map(normalizeArabic))
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32)
}

/** بصمة نص السؤال وحده (لكشف الأسئلة المتشابهة بصياغة مختلفة قليلاً) */
export function promptHash(question: string): string {
  return createHash('sha256').update(normalizeArabic(question)).digest('hex').slice(0, 24)
}

export function parseFillText(text: string): { segments: FillSegment[]; blanks: number } {
  const segments: FillSegment[] = []
  let last = 0
  let idx = 0
  for (const m of text.matchAll(BLANK_RE)) {
    const start = m.index ?? 0
    if (start > last) segments.push({ t: text.slice(last, start) })
    segments.push({ b: idx++ })
    last = start + m[0].length
  }
  if (last < text.length) segments.push({ t: text.slice(last) })
  return { segments, blanks: idx }
}

/** التحقق البنيوي من سؤال في ملف محتوى (لا يصل إلى قاعدة البيانات) */
export function validateContentQuestion(q: PlayContentQuestion): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const str = (v: unknown) => typeof v === 'string' && v.trim().length > 0
  if (!str(q.key)) errors.push('key مفقود')
  else if (!/^[A-Z0-9]+-[A-Z]+-[A-Z0-9]+-[A-Z0-9]+-\d{3,5}$/.test(q.key)) warnings.push('صيغة key غير قياسية (GRADE-SUBJECT-UNIT-LESSON-NNNN)')
  else if (!q.key.startsWith(`${q.grade}-${q.subject}-${q.unit}-${q.lesson}-`)) errors.push('key لا يطابق السنة/المادة/الوحدة/الدرس')
  if (!PLAY_QUESTION_TYPES.includes(q.type)) errors.push(`نوع غير معروف: ${String(q.type)}`)
  if (!gradeByCode(q.grade)) errors.push(`سنة غير معروفة: ${String(q.grade)}`)
  else if (q.streams?.length) {
    const g = gradeByCode(q.grade)!
    for (const s of q.streams) if (!g.streams.includes(s)) errors.push(`الشعبة ${s} ليست من شعب ${q.grade}`)
  }
  if (!str(q.subject)) errors.push('subject مفقود')
  if (!str(q.unit) || !str(q.lesson)) errors.push('unit/lesson مفقود')
  if (!PLAY_DIFFICULTIES.includes(q.difficulty)) errors.push(`صعوبة غير صالحة: ${String(q.difficulty)}`)
  if (q.language && !PLAY_LANGUAGES.includes(q.language)) errors.push(`لغة غير صالحة: ${String(q.language)}`)
  if (q.reviewStatus && !PLAY_REVIEW_STATUSES.includes(q.reviewStatus)) errors.push('reviewStatus غير صالح')
  if (q.source && !PLAY_SOURCES.includes(q.source)) errors.push('source غير صالح')
  if (!str(q.question)) errors.push('نص السؤال مفقود')
  else if (q.question.trim().length < 8) warnings.push('نص السؤال قصير جداً')
  if (!str(q.explanation)) errors.push('التفسير مفقود')
  else if (q.explanation.trim().length < 15) warnings.push('التفسير قصير جداً')
  if (/�/.test(q.question + q.explanation)) errors.push('ترميز تالف في النص')

  switch (q.type) {
    case 'MCQ': {
      const opts = q.options ?? []
      if (opts.length < 3 || opts.length > 6) errors.push(`عدد الاختيارات ${opts.length} (المطلوب 4)`)
      else if (opts.length !== 4) warnings.push(`عدد الاختيارات ${opts.length} بدل 4`)
      if (opts.some((o) => !str(o))) errors.push('اختيار فارغ')
      const norm = opts.map((o) => exactToken(o))
      if (new Set(norm).size !== norm.length) errors.push('اختيارات مكررة')
      const normLoose = opts.map((o) => normalizeArabic(o))
      if (new Set(normLoose).size !== normLoose.length && new Set(norm).size === norm.length) warnings.push('اختيارات متقاربة جداً (تختلف بالتشكيل فقط)')
      if (typeof q.correct !== 'number' || !Number.isInteger(q.correct) || q.correct < 0 || q.correct >= opts.length) errors.push('correct خارج نطاق الاختيارات')
      if (q.blanks || q.pairs || q.order) warnings.push('حقول لا تخص MCQ')
      break
    }
    case 'FILL_BLANK': {
      const { blanks } = parseFillText(q.question)
      if (blanks === 0) errors.push('لا يوجد ____ في نص السؤال')
      const answers = q.blanks ?? []
      if (answers.length !== blanks) errors.push(`عدد إجابات الفراغات ${answers.length} لا يطابق عدد الفراغات ${blanks}`)
      const bank = (q.bank ?? []).map(exactToken)
      if (bank.length < blanks + 1) errors.push('بنك الكلمات يجب أن يحوي مشتتاً واحداً على الأقل')
      if (bank.length > 10) warnings.push('بنك الكلمات كبير (>10)')
      if (new Set(bank).size !== bank.length) errors.push('بنك الكلمات يحوي تكراراً')
      for (const [i, a] of answers.entries()) {
        const alts = (Array.isArray(a) ? a : [a]).map(exactToken)
        if (alts.length === 0 || alts.some((x) => !x)) errors.push(`إجابة الفراغ ${i + 1} فارغة`)
        if (!alts.some((x) => bank.includes(x))) errors.push(`إجابة الفراغ ${i + 1} غير موجودة في بنك الكلمات`)
      }
      // إجابة واحدة لكل فراغ: المشتتات لا يجوز أن تكون إجابات صحيحة لفراغ آخر بشكل يسمح بتبديلها بلا تمييز
      if (blanks === 1 && answers.length === 1) {
        const first = answers[0]
        const alts = (Array.isArray(first) ? first : [first ?? '']).map(exactToken)
        if (alts.length >= bank.length) errors.push('كل كلمات البنك إجابات صحيحة — لا مشتت')
      }
      if (q.options || q.pairs || q.order) warnings.push('حقول لا تخص FILL_BLANK')
      break
    }
    case 'MATCHING': {
      const pairs = q.pairs ?? []
      if (pairs.length < 3 || pairs.length > 6) errors.push(`عدد الأزواج ${pairs.length} (المطلوب 3–6)`)
      if (pairs.some((p) => !str(p?.left) || !str(p?.right))) errors.push('زوج ناقص')
      const lefts = pairs.map((p) => normalizeArabic(p.left))
      const rights = pairs.map((p) => normalizeArabic(p.right))
      if (new Set(lefts).size !== lefts.length || new Set(rights).size !== rights.length) errors.push('عناصر مطابقة مكررة')
      break
    }
    case 'ORDERING': {
      const order = q.order ?? []
      if (order.length < 3 || order.length > 7) errors.push(`عدد العناصر ${order.length} (المطلوب 3–7)`)
      if (order.some((o) => !str(o))) errors.push('عنصر فارغ')
      const norm = order.map(normalizeArabic)
      if (new Set(norm).size !== norm.length) errors.push('عناصر مكررة')
      break
    }
  }

  if (q.verify) {
    const r = runArithmeticVerify(q.verify)
    if (r !== null) errors.push(r)
  }
  return { errors, warnings }
}

/**
 * تحقق حسابي آمن: تعبير من أرقام وعمليات (+ - * / ^ % ( ) sqrt abs) فقط.
 * يعيد رسالة خطأ أو null عند النجاح.
 */
export function runArithmeticVerify(v: { expression: string; expected: string | number; tolerance?: number }): string | null {
  const value = safeEvalArithmetic(v.expression)
  if (value === null) return `تعذّر تقييم التعبير: ${v.expression}`
  const expected = typeof v.expected === 'number' ? v.expected : safeEvalArithmetic(String(v.expected))
  if (expected === null) return `تعذّر تقييم القيمة المتوقعة: ${String(v.expected)}`
  const tol = v.tolerance ?? 1e-6
  if (Math.abs(value - expected) > tol * Math.max(1, Math.abs(expected))) return `التحقق الحسابي فشل: ${v.expression} = ${value} ≠ ${expected}`
  return null
}

/** مقيّم تعابير حسابية صغير (نزول تكراري) — لا eval ولا Function */
export function safeEvalArithmetic(expr: string): number | null {
  const src = expr
    .replace(/\s+/g, '')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  let i = 0
  const peek = () => src[i] ?? ''
  const fail = (): never => {
    throw new Error('parse')
  }
  const parseNumber = (): number => {
    const m = /^(\d+(\.\d+)?|\.\d+)/.exec(src.slice(i))
    if (!m) fail()
    i += m![0].length
    return Number(m![0])
  }
  const parsePrimary = (): number => {
    const c = peek()
    if (c === '(') {
      i++
      const v = parseExpr()
      if (peek() !== ')') fail()
      i++
      return v
    }
    if (c === '-') {
      i++
      return -parsePrimary()
    }
    if (c === '+') {
      i++
      return parsePrimary()
    }
    if (/[a-z]/i.test(c)) {
      const m = /^[a-z]+/i.exec(src.slice(i))!
      const name = m[0].toLowerCase()
      i += name.length
      if (name === 'pi') return Math.PI
      if (name === 'e') return Math.E
      if (peek() !== '(') fail()
      i++
      const arg = parseExpr()
      if (peek() !== ')') fail()
      i++
      if (name === 'sqrt') return Math.sqrt(arg)
      if (name === 'abs') return Math.abs(arg)
      if (name === 'ln') return Math.log(arg)
      if (name === 'log') return Math.log10(arg)
      if (name === 'exp') return Math.exp(arg)
      if (name === 'sin') return Math.sin(arg)
      if (name === 'cos') return Math.cos(arg)
      if (name === 'tan') return Math.tan(arg)
      return fail()
    }
    return parseNumber()
  }
  const parsePower = (): number => {
    const base = parsePrimary()
    if (peek() === '^') {
      i++
      return Math.pow(base, parsePower())
    }
    return base
  }
  const parseTerm = (): number => {
    let v = parsePower()
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = src[i++]
      const r = parsePower()
      v = op === '*' ? v * r : op === '/' ? v / r : v % r
    }
    return v
  }
  const parseExpr = (): number => {
    let v = parseTerm()
    while (peek() === '+' || peek() === '-') {
      const op = src[i++]
      const r = parseTerm()
      v = op === '+' ? v + r : v - r
    }
    return v
  }
  try {
    if (!src) return null
    const v = parseExpr()
    if (i !== src.length) return null
    return Number.isFinite(v) ? v : null
  } catch {
    return null
  }
}

/** يحوّل سؤال ملف المحتوى إلى الصف المطبّع (بلا lessonId — يحلّه المستورد) */
export function normalizeContentQuestion(q: PlayContentQuestion): Omit<NormalizedPlayQuestion, 'lessonId'> {
  const language: PlayLanguage = q.language ?? 'ar'
  let payload: PlayPublicPayload
  let answerKey: PlayAnswerKey
  switch (q.type) {
    case 'MCQ': {
      const options = (q.options ?? []).map((text, i) => ({ key: OPTION_KEYS[i]!, text: text.trim() }))
      payload = { type: 'MCQ', options }
      answerKey = { type: 'MCQ', correct: OPTION_KEYS[q.correct ?? 0]! }
      break
    }
    case 'FILL_BLANK': {
      const { segments, blanks } = parseFillText(q.question)
      payload = { type: 'FILL_BLANK', segments, blanks, bank: (q.bank ?? []).map(exactToken) }
      answerKey = { type: 'FILL_BLANK', answers: (q.blanks ?? []).map((a) => (Array.isArray(a) ? a : [a]).map(exactToken)) }
      break
    }
    case 'MATCHING': {
      const pairs = q.pairs ?? []
      const lefts = pairs.map((p, i) => ({ key: `l${i}`, text: p.left.trim() }))
      const rights = pairs.map((p, i) => ({ key: `r${i}`, text: p.right.trim() }))
      payload = { type: 'MATCHING', lefts, rights }
      answerKey = { type: 'MATCHING', pairs: Object.fromEntries(pairs.map((_, i) => [`l${i}`, `r${i}`])) }
      break
    }
    case 'ORDERING': {
      const items = (q.order ?? []).map((text, i) => ({ key: `o${i}`, text: text.trim() }))
      payload = { type: 'ORDERING', items }
      answerKey = { type: 'ORDERING', order: items.map((it) => it.key) }
      break
    }
  }
  return {
    key: q.key.trim(),
    type: q.type,
    gradeCode: q.grade,
    streamCodes: q.streams ?? [],
    subjectCode: q.subject,
    unitCode: q.unit,
    lessonCode: q.lesson,
    objective: q.objective?.trim() || null,
    difficulty: q.difficulty,
    language,
    questionText: q.question.trim(),
    payload,
    answerKey,
    explanation: q.explanation.trim(),
    tags: q.tags ?? [],
    contentHash: contentHash(q),
    source: q.source ?? 'AI_AUTHORED',
    reviewStatus: q.reviewStatus ?? 'DRAFT',
    qualityFlags: [],
    note: q.note?.trim() || null
  }
}

/** التصحيح على الخادم */
export function gradePlayAnswer(key: PlayAnswerKey, answer: PlayStudentAnswer | null | undefined): GradeOutcome {
  if (!answer || answer.type !== key.type) return { isCorrect: false, score: 0 }
  switch (key.type) {
    case 'MCQ': {
      const ok = (answer as { key: string }).key === key.correct
      return { isCorrect: ok, score: ok ? 1 : 0 }
    }
    case 'FILL_BLANK': {
      const given = (answer as { blanks: string[] }).blanks ?? []
      let hit = 0
      key.answers.forEach((alts, i) => {
        const g = exactToken(given[i] ?? '')
        if (g && alts.includes(g)) hit++
      })
      const score = key.answers.length ? hit / key.answers.length : 0
      return { isCorrect: hit === key.answers.length && key.answers.length > 0, score }
    }
    case 'MATCHING': {
      const m = (answer as { matches: Record<string, string> }).matches ?? {}
      const entries = Object.entries(key.pairs)
      const hit = entries.filter(([l, r]) => m[l] === r).length
      return { isCorrect: hit === entries.length, score: entries.length ? hit / entries.length : 0 }
    }
    case 'ORDERING': {
      const o = (answer as { order: string[] }).order ?? []
      const ok = o.length === key.order.length && o.every((k, i) => k === key.order[i])
      // درجة جزئية: نسبة العناصر في موضعها الصحيح
      const hit = key.order.filter((k, i) => o[i] === k).length
      return { isCorrect: ok, score: key.order.length ? hit / key.order.length : 0 }
    }
  }
}

/** مولّد أرقام حتمي (mulberry32) لخلط ثابت داخل الجلسة */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seededShuffle<T>(arr: readonly T[], seed: number): T[] {
  const out = [...arr]
  const rnd = seededRandom(seed)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

export function hashToSeed(...parts: string[]): number {
  const h = createHash('sha256').update(parts.join(':')).digest()
  return h.readUInt32BE(0) & 0x7fffffff
}

/** يخلط ما يُعرض للطالب (الاختيارات/البنك/العناصر) بحيث لا تكون الإجابة في الموضع نفسه دائماً */
export function shufflePayloadForSession(payload: PlayPublicPayload, seed: number): PlayPublicPayload {
  switch (payload.type) {
    case 'MCQ':
      return { type: 'MCQ', options: seededShuffle(payload.options, seed) }
    case 'FILL_BLANK':
      return { ...payload, bank: seededShuffle(payload.bank, seed) }
    case 'MATCHING':
      return { type: 'MATCHING', lefts: payload.lefts, rights: seededShuffle(payload.rights, seed) }
    case 'ORDERING': {
      let items = seededShuffle(payload.items, seed)
      // تجنّب أن يظهر الترتيب الصحيح جاهزاً
      if (items.every((it, i) => it.key === payload.items[i]?.key) && items.length > 1) items = [...items.slice(1), items[0]!]
      return { type: 'ORDERING', items }
    }
  }
}

/** نص الإجابة الصحيحة للعرض بعد التصحيح */
export function correctAnswerText(payload: PlayPublicPayload, key: PlayAnswerKey): string {
  switch (key.type) {
    case 'MCQ':
      return payload.type === 'MCQ' ? (payload.options.find((o) => o.key === key.correct)?.text ?? '') : ''
    case 'FILL_BLANK':
      return key.answers.map((a) => a[0] ?? '').join(' ، ')
    case 'MATCHING':
      return payload.type === 'MATCHING' ? Object.entries(key.pairs).map(([l, r]) => `${payload.lefts.find((x) => x.key === l)?.text ?? ''} ← ${payload.rights.find((x) => x.key === r)?.text ?? ''}`).join(' | ') : ''
    case 'ORDERING':
      return payload.type === 'ORDERING' ? key.order.map((k, i) => `${i + 1}. ${payload.items.find((x) => x.key === k)?.text ?? ''}`).join(' ') : ''
  }
}
