/**
 * MADRASA PLAY — محرك مجموعات الفروض والاختبارات والبكالوريا: التدقيق، التصحيح، والتنقيط (06_SCORING_AND_QA).
 *
 * التنقيط: لكل عنصر أصلي وزن R يُقسَّم على خطواته (Σw = R)، ومجموع العناصر = score_total (20 للبكالوريا).
 * لكل خطوة درجة s بين 0 و1، والنتيجة Σ(w × s) — التقريب للعرض فقط.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { normalizeArabic } from '@/server/lib/arabic'
import { PLAY_EXAM_KINDS, PLAY_EXAM_PUBLISHED_STATUSES, PLAY_EXAM_SET_STATUSES, PLAY_GRADES, PLAY_STREAMS, PLAY_SUBJECTS } from '../constants'
import { stepExcerpt } from './excerpt'
import { QUEUED_STEP_TYPES, SUPPORTED_STEP_TYPES, type ExamSetDocument, type MediaRef, type PublicStep, type StepAnswer, type StepAnswerKey, type StepPayload, type TrainingStep } from './types'

/** هامش المقارنة العددية للأوزان */
export const WEIGHT_EPSILON = 1e-6

const isSupported = (t: string): boolean => (SUPPORTED_STEP_TYPES as readonly string[]).includes(t)
const isQueued = (t: string): boolean => (QUEUED_STEP_TYPES as readonly string[]).includes(t)

/* ─────────────────────────────── التصحيح ─────────────────────────────── */

const norm = (s: string) => normalizeArabic(s).replace(/\s+/g, ' ').trim()
/** مقارنة حرفية (مع التشكيل والرموز): الإعراب والعروض يختلفان بالحركات وحدها */
const exact = (s: string) => s.normalize('NFC').replace(/\s+/g, ' ').trim()

/** هل ينطبق عنصر السلّم على شعبة التلميذ؟ (null = كل الشعب) */
export function elementApplies(el: { streams?: string[] } | undefined, stream: string | null | undefined): boolean {
  return !el?.streams?.length || !stream || el.streams.includes(stream)
}

/** الشعب التي تختلف فيها الورقة (عناصر خاصة بشعبة)، وإلا ['*'] */
export function streamVariants(doc: ExamSetDocument): string[] {
  const special = doc.original_questions.some((q) => q.rubric_elements.some((e) => e.streams?.length))
  return special && doc.source.streams.length ? [...doc.source.streams] : ['*']
}

/** الشعبة المعتمدة لعرض الورقة: شعبة التلميذ إن كانت من شعب الموضوع، وإلا الأولى */
export function effectiveStream(doc: ExamSetDocument, stream: string | null | undefined): string | null {
  const v = streamVariants(doc)
  if (v[0] === '*') return null
  return stream && v.includes(stream) ? stream : v[0]!
}

/** الخطوات المنطبقة على شعبة (بعناصرها) */
export function stepsFor(doc: ExamSetDocument, stream: string | null | undefined): TrainingStep[] {
  const s = effectiveStream(doc, stream)
  const els = new Map(doc.original_questions.flatMap((q) => q.rubric_elements.map((e) => [e.id, e] as const)))
  return doc.steps.filter((st) => elementApplies(els.get(st.rubric_element_id), s))
}

/** النقاط التفاعلية والمؤجلة لشعبة */
export function pointsFor(doc: ExamSetDocument, stream: string | null | undefined): { interactive: number; deferred: number } {
  let interactive = 0
  let deferred = 0
  for (const st of stepsFor(doc, stream)) {
    if (isQueued(st.type)) deferred += st.points
    else if (isSupported(st.type)) interactive += st.points
  }
  return { interactive, deferred }
}

/** درجة الخطوة من 0 إلى 1 (جزئية للأنواع المركّبة). إجابة من نوع آخر أو ناقصة = 0. */
export function gradeStep(key: StepAnswerKey, answer: StepAnswer | null | undefined, payload?: StepPayload): number {
  if (!answer || answer.type !== key.type) return 0
  switch (key.type) {
    case 'mcq':
      return answer.type === 'mcq' && answer.choice === key.correct ? 1 : 0
    case 'portrait':
      return answer.type === 'portrait' && answer.choice === key.correct ? 1 : 0
    case 'multi': {
      if (answer.type !== 'multi') return 0
      const want = new Set(key.correct)
      const got = new Set(answer.choices)
      let hit = 0
      let wrong = 0
      for (const c of got) {
        if (want.has(c)) hit++
        else wrong++
      }
      return Math.max(0, Math.min(1, (hit - wrong) / Math.max(1, want.size)))
    }
    case 'fill_blank': {
      if (answer.type !== 'fill_blank') return 0
      // الإجابة من بنك الكلمات: مطابقة حرفية؛ والتسامح (دون تشكيل) فقط إن لم يكن في البنك كلمتان تختلفان بالتشكيل وحده
      const bank = payload?.type === 'fill_blank' ? payload.bank : []
      const strict = new Set(bank.map(norm)).size !== bank.length
      let ok = 0
      key.blanks.forEach((alts, i) => {
        const v = answer.blanks[i]
        if (typeof v === 'string' && alts.some((a) => exact(a) === exact(v) || (!strict && norm(a) === norm(v)))) ok++
      })
      return ok / Math.max(1, key.blanks.length)
    }
    case 'ordering': {
      if (answer.type !== 'ordering' || answer.order.length !== key.order.length) return 0
      let ok = 0
      key.order.forEach((v, i) => {
        if (answer.order[i] === v) ok++
      })
      return ok / Math.max(1, key.order.length)
    }
    case 'matching': {
      if (answer.type !== 'matching' || answer.pairs.length !== key.pairs.length) return 0
      let ok = 0
      key.pairs.forEach((v, i) => {
        if (answer.pairs[i] === v) ok++
      })
      return ok / Math.max(1, key.pairs.length)
    }
    case 'numeric':
      return answer.type === 'numeric' && Number.isFinite(answer.value) && Math.abs(answer.value - key.value) <= key.tolerance + WEIGHT_EPSILON ? 1 : 0
    case 'short_text':
      return answer.type === 'short_text' && key.accepted.some((a) => norm(a) === norm(answer.text)) ? 1 : 0
    default:
      return 0
  }
}

/** Σ(w × s) على الخطوات المجابة؛ غير المجابة = 0 */
export function scoreSteps(steps: (Pick<TrainingStep, 'id' | 'points' | 'answer'> & { payload?: StepPayload })[], answers: Record<string, StepAnswer | null | undefined>): { score: number; max: number; perStep: Record<string, { s: number; w: number }> } {
  let score = 0
  let max = 0
  const perStep: Record<string, { s: number; w: number }> = {}
  for (const st of steps) {
    const s = gradeStep(st.answer, answers[st.id], st.payload)
    perStep[st.id] = { s, w: st.points }
    score += st.points * s
    max += st.points
  }
  return { score, max, perStep }
}

/** نص الإجابة الصحيحة للعرض بعد المحاولة */
export function answerText(step: Pick<TrainingStep, 'payload' | 'answer'>): string {
  const k = step.answer
  const p = step.payload
  switch (k.type) {
    case 'mcq':
    case 'portrait':
      return 'options' in p ? (p.options[k.correct] ?? '') : ''
    case 'multi':
      return 'options' in p ? k.correct.map((i) => p.options[i]).join(' ، ') : ''
    case 'fill_blank':
      return k.blanks.map((b) => b[0]).join(' ، ')
    case 'ordering':
      return 'items' in p ? k.order.map((i) => p.items[i]).join(' ← ') : ''
    case 'matching':
      return 'lefts' in p ? p.lefts.map((l, i) => `${l} ← ${p.rights[k.pairs[i]!] ?? ''}`).join(' | ') : ''
    case 'numeric':
      return `${k.value}${k.unit ? ` ${k.unit}` : ''}`
    case 'short_text':
      return k.accepted[0] ?? ''
    default:
      return ''
  }
}

/* ─────────────────────────────── التدقيق ─────────────────────────────── */

export interface ExamIssue {
  level: 'error' | 'warning'
  code: string
  where: string
  message: string
}

export interface ExamValidation {
  setId: string
  errors: ExamIssue[]
  warnings: ExamIssue[]
  /** مجموع أوزان الخطوات */
  totalPoints: number
  /** حالة كل خطوة بعد التدقيق (قد تُخفَّض: وسائط ناقصة، نوع غير مدعوم…) */
  stepStatus: Record<string, TrainingStep['review_status']>
  /** علامات عناصر لا يصححها المحرك بعد (وضعية إدماجية، جدول…): تُعرض «مؤجلة» ولا تُحتسب آليًا */
  deferredPoints: number
  /** يجوز عرضها للتلاميذ: معتمدة، مصدر وتصحيح موثقان، بلا أخطاء، وكل خطواتها المدعومة معتمدة */
  publishable: boolean
  fingerprints: string[]
}

export function stepFingerprint(step: Pick<TrainingStep, 'prompt' | 'answer' | 'payload'>): string {
  return createHash('sha256')
    .update(norm(step.prompt) + '\u0000' + JSON.stringify(step.payload) + '\u0000' + JSON.stringify(step.answer))
    .digest('hex')
    .slice(0, 32)
}

/** الوسائط: ملف محلي موجود + مصدر + ترخيص + إسناد + تاريخ تحقق. لا صور رمادية ولا بدائل. */
export function mediaProblems(media: MediaRef | undefined, publicRoot: string): string[] {
  if (!media) return ['لا وسائط']
  const out: string[] = []
  if (!media.local_path || media.local_path.startsWith('http')) out.push('المسار المحلي مفقود')
  else if (!existsSync(join(publicRoot, media.local_path.replace(/^\/+/, '')))) out.push(`الملف غير موجود: ${media.local_path}`)
  if (!media.source_url) out.push('رابط المصدر مفقود')
  if (!media.license) out.push('الترخيص مفقود')
  if (!media.attribution) out.push('الإسناد مفقود')
  if (!media.image_verified_at) out.push('لم يُتحقق من هوية الصورة')
  if (!media.sha256) out.push('بصمة الملف مفقودة')
  return out
}

function answerShapeProblem(step: TrainingStep): string | null {
  const p = step.payload
  const k = step.answer
  if (p.type !== k.type) return 'نوع الإجابة لا يطابق نوع الخطوة'
  switch (k.type) {
    case 'mcq':
    case 'portrait': {
      const opts = 'options' in p ? p.options : []
      if (opts.length < 2) return 'خياران على الأقل'
      if (new Set(opts.map(exact)).size !== opts.length) return 'خيارات مكررة'
      return Number.isInteger(k.correct) && k.correct >= 0 && k.correct < opts.length ? null : 'رقم الإجابة الصحيحة خارج الخيارات'
    }
    case 'multi': {
      const opts = 'options' in p ? p.options : []
      if (opts.length < 3) return 'ثلاثة خيارات على الأقل'
      if (new Set(opts.map(exact)).size !== opts.length) return 'خيارات مكررة'
      return k.correct.length >= 1 && k.correct.every((i) => Number.isInteger(i) && i >= 0 && i < opts.length) ? null : 'إجابات خارج الخيارات'
    }
    case 'fill_blank': {
      if (p.type !== 'fill_blank') return 'نوع'
      const holes = (p.text.match(/____/g) ?? []).length
      if (holes === 0 || holes !== k.blanks.length) return `عدد الفراغات (${holes}) لا يساوي عدد الإجابات (${k.blanks.length})`
      for (const alts of k.blanks) if (!alts.length || !alts.some((a) => p.bank.some((b) => norm(b) === norm(a)))) return 'إجابة فراغ ليست في بنك الكلمات'
      return null
    }
    case 'ordering': {
      if (p.type !== 'ordering') return 'نوع'
      const n = p.items.length
      return n >= 2 && k.order.length === n && new Set(k.order).size === n && k.order.every((i) => i >= 0 && i < n) ? null : 'ترتيب غير صالح'
    }
    case 'matching': {
      if (p.type !== 'matching') return 'نوع'
      const n = p.lefts.length
      return n >= 2 && p.rights.length >= n && k.pairs.length === n && new Set(k.pairs).size === n && k.pairs.every((i) => i >= 0 && i < p.rights.length) ? null : 'مطابقة غير صالحة'
    }
    case 'numeric':
      return Number.isFinite(k.value) && Number.isFinite(k.tolerance) && k.tolerance >= 0 ? null : 'قيمة أو هامش غير صالح'
    case 'short_text':
      return k.accepted.length ? null : 'لا إجابات مقبولة'
    default:
      return null
  }
}

export interface ValidateOptions {
  /** جذر public/ للتحقق من وجود الوسائط */
  publicRoot?: string
  /** بصمات خطوات من مجموعات أخرى (منع التكرار عبر الأرشيف) */
  seenFingerprints?: Map<string, string>
}

export function validateExamSet(doc: ExamSetDocument, opts: ValidateOptions = {}): ExamValidation {
  const publicRoot = opts.publicRoot ?? join(process.cwd(), 'public')
  const errors: ExamIssue[] = []
  const warnings: ExamIssue[] = []
  const err = (code: string, where: string, message: string) => errors.push({ level: 'error', code, where, message })
  const warn = (code: string, where: string, message: string) => warnings.push({ level: 'warning', code, where, message })
  const stepStatus: Record<string, TrainingStep['review_status']> = {}
  const fingerprints: string[] = []

  // المصدر
  const src = doc.source
  if (doc.schema_version !== 1) err('SCHEMA', 'schema_version', 'الإصدار المدعوم 1')
  if (!/^[a-z0-9][a-z0-9-]{2,80}$/.test(doc.set_id ?? '')) err('SCHEMA', 'set_id', 'معرّف المجموعة: حروف لاتينية صغيرة وأرقام وشرطات')
  if (!(PLAY_EXAM_SET_STATUSES as readonly string[]).includes(doc.status)) err('SCHEMA', 'status', `حالة غير معروفة: ${doc.status}`)
  if (!src || !(PLAY_EXAM_KINDS as readonly string[]).includes(src.kind)) err('SCHEMA', 'source.kind', 'نوع المصدر BAC أو DEVOIR أو TEST')
  if (src && !PLAY_GRADES.some((g) => g.code === src.level)) err('SCHEMA', 'source.level', `مستوى غير معروف: ${src?.level}`)
  if (src && !PLAY_SUBJECTS.some((s) => s.code === src.subject)) err('SCHEMA', 'source.subject', `مادة غير معروفة: ${src?.subject}`)
  for (const st of src?.streams ?? []) if (!PLAY_STREAMS.some((s) => s.code === st)) err('SCHEMA', 'source.streams', `شعبة غير معروفة: ${st}`)
  if (src?.kind === 'BAC') {
    if (src.level !== '3AS') err('BAC_LEVEL', 'source.level', 'البكالوريا للثالثة ثانوي فقط')
    if (!src.year) err('SCHEMA', 'source.year', 'سنة البكالوريا مطلوبة')
    if (src.paper !== 1 && src.paper !== 2) err('SCHEMA', 'source.paper', 'الموضوع الأول أو الثاني')
    if (Math.abs(doc.score_total - 20) > WEIGHT_EPSILON) err('BAC_TOTAL_NOT_20', 'score_total', `علامة البكالوريا 20 لا ${doc.score_total}`)
  }
  if (src && src.kind !== 'BAC' && (src.term === null || src.term < 1 || src.term > 3)) err('SCHEMA', 'source.term', 'الفصل 1 أو 2 أو 3')
  const sourceTrusted = !!src && src.verified && (!!src.correction_url || !!src.correction_file_ref) && (!!src.original_url || !!src.original_file_ref)
  if (!doc.fixture && !sourceTrusted) warn('SOURCE_UNVERIFIED', 'source', 'الأصل أو التصحيح غير موثّق: لا اعتماد ولا نشر')
  if (doc.fixture && src?.trust !== 'synthetic_fixture') err('FIXTURE', 'source.trust', 'مجموعة الاختبار يجب أن تُعلَن synthetic_fixture')

  // الأسئلة الأصلية وعناصر السلّم
  const questions = new Map<string, ExamSetDocument['original_questions'][number]>()
  const elements = new Map<string, { q: string; max: number; streams?: string[] }>()
  const variants = streamVariants(doc)
  let rubricSum = 0
  for (const q of doc.original_questions ?? []) {
    if (questions.has(q.id)) err('DUPLICATE_ID', `question:${q.id}`, 'معرّف سؤال مكرر')
    questions.set(q.id, q)
    if (!doc.fixture && !q.verbatim_text?.trim()) err('VERBATIM_MISSING', `question:${q.id}`, 'نص السؤال الأصلي مطلوب حرفيًا')
    let sum = 0
    for (const e of q.rubric_elements ?? []) {
      if (elements.has(e.id)) err('DUPLICATE_ID', `element:${e.id}`, 'معرّف عنصر مكرر')
      if (!(e.max_points > 0)) err('RUBRIC', `element:${e.id}`, 'علامة العنصر يجب أن تكون موجبة')
      elements.set(e.id, { q: q.id, max: e.max_points, streams: e.streams })
      for (const st of e.streams ?? []) if (!src?.streams.includes(st)) err('SCHEMA', `element:${e.id}`, `شعبة العنصر ${st} ليست من شعب الموضوع`)
      if (!doc.fixture && !e.verified) warn('RUBRIC_UNVERIFIED', `element:${e.id}`, 'علامة العنصر لم تُطابَق بسلّم التصحيح الرسمي')
    }
    // لكل شعبة: مجموع العناصر المنطبقة = علامة السؤال (الفروع البديلة لا تُجمع معًا)
    for (const v of variants) {
      sum = (q.rubric_elements ?? []).filter((e) => elementApplies(e, v === '*' ? null : v)).reduce((a, e) => a + e.max_points, 0)
      if (Math.abs(sum - q.rubric_total) > WEIGHT_EPSILON) err('RUBRIC_TOTAL_MISMATCH', `question:${q.id}`, `مجموع العناصر ${sum}${v === '*' ? '' : ` (شعبة ${v})`} ≠ علامة السؤال ${q.rubric_total}`)
    }
    rubricSum += q.rubric_total
    for (const d of q.documents ?? []) {
      if ((d.kind === 'image' || d.kind === 'map') && d.media) {
        const probs = mediaProblems(d.media, publicRoot)
        if (probs.length) err('MEDIA', `document:${d.id}`, probs.join('، '))
      }
    }
  }
  if (Math.abs(rubricSum - doc.score_total) > WEIGHT_EPSILON) err('TOTAL_MISMATCH', 'original_questions', `مجموع سلّم الأسئلة ${rubricSum} ≠ ${doc.score_total}`)

  // العناوين التي يضيفها التحويل فوق الوثائق ليست من الورقة: لا يجوز أن تكشف إجابة (مثل «من الطّويل» وسؤال البحر)
  const captions = (doc.original_questions ?? []).flatMap((q) => (q.documents ?? []).map((d) => norm(d.caption ?? ''))).filter(Boolean)
  // ما في الورقة نفسها (نصوص الوثائق وجداولها ونصوص الأسئلة) ليس تسريبًا
  const paper = norm(
    (doc.original_questions ?? [])
      .flatMap((q) => [q.verbatim_text, ...(q.documents ?? []).flatMap((d) => [d.text ?? '', ...(d.table ?? []).flat()])])
      .join(' ')
  )

  // الخطوات
  const ids = new Set<string>()
  const perElement = new Map<string, number>()
  let total = 0
  for (const st of doc.steps ?? []) {
    const where = `step:${st.id}`
    if (ids.has(st.id)) err('DUPLICATE_ID', where, 'معرّف خطوة مكرر')
    ids.add(st.id)
    let status: TrainingStep['review_status'] = st.review_status
    const q = questions.get(st.source_question_id)
    if (!q) err('UNKNOWN_QUESTION', where, `سؤال أصلي غير موجود: ${st.source_question_id}`)
    const el = elements.get(st.rubric_element_id)
    if (!el) err('UNKNOWN_ELEMENT', where, `عنصر سلّم غير موجود: ${st.rubric_element_id}`)
    else if (el.q !== st.source_question_id) err('ELEMENT_QUESTION_MISMATCH', where, 'العنصر لا ينتمي إلى السؤال الأصلي المذكور')
    if (!(st.points > 0)) err('WEIGHT', where, 'وزن الخطوة يجب أن يكون موجبًا')
    perElement.set(st.rubric_element_id, (perElement.get(st.rubric_element_id) ?? 0) + st.points)
    total += st.points
    if (!st.prompt?.trim()) err('SCHEMA', where, 'نص الخطوة فارغ')
    if (!st.explanation?.trim()) warn('EXPLANATION', where, 'لا شرح بعد الإجابة')
    if (st.is_verbatim_original && q && norm(st.prompt) !== norm(q.verbatim_text)) err('VERBATIM_CLAIM', where, 'خطوة معلَّمة «نص أصلي» لكن نصها يختلف عن الأصل')

    if (isSupported(st.type) && captions.length) {
      const k = st.answer
      const keys: string[] =
        k.type === 'mcq' || k.type === 'portrait' ? ['options' in st.payload ? (st.payload.options[k.correct] ?? '') : '']
        : k.type === 'multi' ? ('options' in st.payload ? k.correct.map((i) => (st.payload as { options: string[] }).options[i] ?? '') : [])
        : k.type === 'fill_blank' ? k.blanks.map((b) => b[0] ?? '')
        : k.type === 'short_text' ? k.accepted.slice(0, 1)
        : []
      const leaked = keys.map(norm).find((a) => a.replace(/\s/g, '').length >= 4 && captions.some((c) => c.includes(a)) && !paper.includes(a))
      if (leaked) err('ANSWER_IN_CAPTION', where, `عنوان وثيقة يكشف الإجابة «${leaked}»`)
    }
    if (isQueued(st.type)) {
      status = 'needs_engine_support'
      warn('UNSUPPORTED_TYPE', where, `النوع ${st.type} في طابور العمل؛ لا يُنشر ولا يُحوَّل إلى اختيار من متعدد`)
    } else if (!isSupported(st.type)) {
      err('SCHEMA', where, `نوع غير معروف: ${st.type}`)
    } else {
      const p = answerShapeProblem(st)
      if (p) err('ANSWER_INVALID', where, p)
    }
    if (st.type === 'portrait') {
      const media = st.payload.type === 'portrait' ? st.payload.media : undefined
      const probs = mediaProblems(media, publicRoot)
      if (probs.length) {
        status = status === 'rejected' ? status : 'needs_media_review'
        warn('MEDIA_REVIEW', where, `سؤال الصورة محجوب: ${probs.join('، ')}`)
      }
    }
    const fp = stepFingerprint(st)
    fingerprints.push(fp)
    const seen = opts.seenFingerprints?.get(fp)
    if (seen && seen !== `${doc.set_id}:${st.id}`) err('DUPLICATE_CONTENT', where, `الخطوة مطابقة لـ ${seen}`)
    stepStatus[st.id] = status
  }
  for (const [eid, e] of elements) {
    const w = perElement.get(eid) ?? 0
    if (w === 0) err('ELEMENT_NOT_COVERED', `element:${eid}`, 'عنصر سلّم بلا خطوات تدريبية (أو استثناء موثّق)')
    else if (Math.abs(w - e.max) > WEIGHT_EPSILON) err('WEIGHT_MISMATCH', `element:${eid}`, `مجموع أوزان الخطوات ${round(w)} ≠ علامة العنصر ${e.max}`)
  }
  // لكل شعبة: مجموع أوزان خطواتها = العلامة الكاملة
  for (const v of variants) {
    const t = (doc.steps ?? []).filter((st) => elementApplies(elements.get(st.rubric_element_id), v === '*' ? null : v)).reduce((a, st) => a + st.points, 0)
    if (Math.abs(t - doc.score_total) > WEIGHT_EPSILON) err('TOTAL_MISMATCH', 'steps', `مجموع أوزان الخطوات ${round(t)}${v === '*' ? '' : ` (شعبة ${v})`} ≠ ${doc.score_total}`)
  }
  if (variants[0] !== '*') total = (doc.steps ?? []).filter((st) => elementApplies(elements.get(st.rubric_element_id), variants[0])).reduce((a, st) => a + st.points, 0)

  // الخطوات المدعومة يجب أن تُعتمد كلها؛ أنواع الطابور لا تُعرض وتبقى «مؤجلة» بعلامتها (لا تُحوَّل قسرًا)
  const supported = (doc.steps ?? []).filter((st) => isSupported(st.type))
  const deferredPoints = (doc.steps ?? []).filter((st) => isQueued(st.type) && elementApplies(elements.get(st.rubric_element_id), variants[0] === '*' ? null : variants[0])).reduce((a, st) => a + st.points, 0)
  const allApproved = supported.length > 0 && supported.every((st) => stepStatus[st.id] === 'approved')
  const publishable = !doc.fixture && errors.length === 0 && sourceTrusted && PLAY_EXAM_PUBLISHED_STATUSES.includes(doc.status) && allApproved
  return { setId: doc.set_id, errors, warnings, totalPoints: total, deferredPoints, stepStatus, publishable, fingerprints }
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}

/* ─────────────────────────────── العرض ─────────────────────────────── */

/** الخطوات المعروضة للتلميذ (بلا مفاتيح الإجابة)، حسب شعبته عند وجود فروع خاصة بالشعب */
export function publicSteps(doc: ExamSetDocument, stream: string | null = null): PublicStep[] {
  const qs = new Map(doc.original_questions.map((q) => [q.id, q]))
  const labels = new Map(doc.original_questions.flatMap((q) => q.rubric_elements.map((e) => [e.id, e.label] as const)))
  return stepsFor(doc, stream)
    .filter((s) => isSupported(s.type))
    .map((s, index) => {
      const q = qs.get(s.source_question_id)!
      return {
        id: s.id,
        index,
        type: s.type,
        prompt: s.prompt,
        payload: s.payload,
        points: s.points,
        source_question: { id: q.id, number: q.number, part: q.part, verbatim_text: q.verbatim_text, documents: q.documents },
        rubric_label: labels.get(s.rubric_element_id) ?? '',
        is_verbatim_original: s.is_verbatim_original,
        excerpt: stepExcerpt(s, q)
      }
    })
}

/** قراءة مجموعة من ملف JSON مع بصمة المحتوى (لنقاط الاستئناف ومنع إعادة المعالجة) */
export function readExamSetFile(path: string): { doc: ExamSetDocument; checksum: string } {
  const raw = readFileSync(path, 'utf-8')
  return { doc: JSON.parse(raw) as ExamSetDocument, checksum: createHash('sha256').update(raw).digest('hex') }
}
