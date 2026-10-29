/**
 * الأبيات/الجمل المقصودة تحت كل خطوة (قرار المالك 29 أكتوبر 2026): يُستخرج الجزء الذي يحيل إليه السؤال
 * من نصّ الموضوع نفسه — لا شيء من خارج النص ولا من مفتاح الإجابة.
 *
 * المصادر بالترتيب:
 *  1. إحالة صريحة في نصّ الخطوة: (ب13)، البيت 6، البيتين (6–7)، الأبيات من 1 إلى 5، البيت الثالث، البيت الحادي عشر،
 *     البيت الأخير، الأبيات الثلاثة الأولى، الفقرة الثانية (للنثر).
 *  2. اقتباس «…» في نصّ الخطوة يطابق بيتًا واحدًا فقط (أو جملة واحدة في النثر).
 *  3. إحالة صريحة في نصّ السؤال الأصلي (لا الاقتباسات) إن لم تذكر الخطوة شيئًا.
 *
 * لا يُعرض شيء حين يكون السؤال نفسه عن موضع الشاهد («في أيّ بيت…؟») أو حين تذكر الخيارات أرقام الأبيات،
 * حتى لا يكشف المقتطف الجواب. ولا يُعرض أكثر من 6 أبيات (النص كاملًا متاح بزرّ «النصّ»).
 */
import type { OriginalQuestion, SourceDocument, StepPayload } from './types'

export type StepExcerpt = { kind: 'verses'; rows: { n: string; a: string; b: string }[] } | { kind: 'prose'; parts: string[] }

const MAX_VERSES = 6
const MAX_PARAGRAPH = 500
const MAX_SENTENCE = 320

/** تطبيع للمطابقة: بلا تشكيل ولا تطويل ولا علامات، مع توحيد الهمزات والياء والتاء المربوطة */
export function normalizeAr(s: string): string {
  return s
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\u0621-\u064A0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const ORDINALS: [string, number][] = [
  ['الحادي عشر', 11],
  ['الثاني عشر', 12],
  ['الثالث عشر', 13],
  ['الرابع عشر', 14],
  ['الخامس عشر', 15],
  ['السادس عشر', 16],
  ['السابع عشر', 17],
  ['الثامن عشر', 18],
  ['التاسع عشر', 19],
  ['الاول', 1],
  ['الثاني', 2],
  ['الثالث', 3],
  ['الرابع', 4],
  ['الخامس', 5],
  ['السادس', 6],
  ['السابع', 7],
  ['الثامن', 8],
  ['التاسع', 9],
  ['العاشر', 10],
  ['العشرين', 20]
]
const FEM_ORDINALS: [string, number][] = [
  ['الاولي', 1],
  ['الثانيه', 2],
  ['الثالثه', 3],
  ['الرابعه', 4],
  ['الخامسه', 5],
  ['السادسه', 6],
  ['السابعه', 7]
]
const COUNTS: [string, number][] = [
  ['الثلاثه', 3],
  ['الاربعه', 4],
  ['الخمسه', 5],
  ['السته', 6]
]
const ORD_RE = ORDINALS.map(([w]) => w).join('|')

function range(a: number, b: number): number[] {
  const [lo, hi] = a <= b ? [a, b] : [b, a]
  if (hi - lo > 40) return []
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
}

/** أرقام الأبيات المذكورة صراحة في نصّ مطبَّع؛ `last` = عدد أبيات القصيدة (لـ«الأخير/الأخيرة») */
export function verseRefs(text: string, last: number): number[] {
  const t = normalizeAr(text)
  const out = new Set<number>()
  const add = (ns: number[]) => ns.forEach((n) => out.add(n))
  // (ب13)، (ب 2 3)، (ب6 و7) — بعد التطبيع تصبح الشرطة والقوس مسافات
  for (const m of t.matchAll(/(?:^|\s)ب\s?(\d{1,2})(?:\s(?:و\s?|الي\s)?(\d{1,2}))?(?=\s|$)/g)) add(m[2] ? range(+m[1]!, +m[2]) : [+m[1]!])
  // البيت 6، البيتين 6 7، البيتان 6 و7، الابيات 1 5، الابيات من 1 الي 5
  for (const m of t.matchAll(/(?:البيت|البيتين|البيتان|الابيات|السطر|السطرين|الاسطر)\s(?:من\s)?(\d{1,2})(?:\s(?:و\s?|الي\s)?(\d{1,2}))?(?=\s|$)/g)) add(m[2] ? range(+m[1]!, +m[2]) : [+m[1]!])
  // البيت الثالث، البيتين الاول والثاني، البيت الحادي عشر
  for (const m of t.matchAll(new RegExp(`(?:البيت|البيتين|البيتان|السطر|السطرين)\\s(${ORD_RE})(?:\\sو\\s?(${ORD_RE}))?(?=\\s|$)`, 'g'))) {
    const a = ORDINALS.find(([w]) => w === m[1])![1]
    add(m[2] ? range(a, ORDINALS.find(([w]) => w === m[2])![1]) : [a])
  }
  if (last > 0) {
    if (/(?:^|\s)البيت الاخير(?=\s|$)/.test(t)) add([last])
    for (const [w, n] of COUNTS) {
      if (new RegExp(`(?:^|\\s)الابيات ${w} الاولي(?=\\s|$)`).test(t)) add(range(1, n))
      if (new RegExp(`(?:^|\\s)الابيات ${w} الاخيره(?=\\s|$)`).test(t)) add(range(last - n + 1, last))
    }
  }
  return [...out].filter((n) => n >= 1 && (last <= 0 || n <= last)).sort((a, b) => a - b)
}

/** أرقام الفقرات المذكورة صراحة (النثر): الفقرة الأولى، المقطع الثاني، الفقرة الأخيرة */
export function paragraphRefs(text: string, last: number): number[] {
  const t = normalizeAr(text)
  const out = new Set<number>()
  for (const m of t.matchAll(/(?:^|\s)الفقره\s(\S+)(?=\s|$)/g)) {
    const n = FEM_ORDINALS.find(([w]) => w === m[1])?.[1] ?? (m[1] === 'الاخيره' ? last : 0)
    if (n) out.add(n)
  }
  for (const m of t.matchAll(/(?:^|\s)المقطع\s(\S+)(?=\s|$)/g)) {
    const n = ORDINALS.find(([w]) => w === m[1])?.[1] ?? (m[1] === 'الاخير' ? last : 0)
    if (n) out.add(n)
  }
  return [...out].filter((n) => n >= 1 && n <= last).sort((a, b) => a - b)
}

/**
 * الاقتباسات في نص الخطوة: «…» أو (…) — يُقسم الاقتباس عند «…» إلى أجزاء يجب أن تقع كلها في الموضع نفسه.
 * الأقواس التي فيها أرقام (ب8)، (9–10) أو تعليمات (اختر…) ليست اقتباسات.
 */
export function quotes(text: string): string[][] {
  const guillemets = [...text.matchAll(/«([^»]+)»/g)].map((m) => m[1]!)
  const parens = [...text.matchAll(/\(([^()]{6,})\)/g)].map((m) => m[1]!).filter((x) => !/\d|[٠-٩]/.test(x) && !/^\s*(?:اختر|آداب|علوم|لغات|شعبة|ممّا|مما)/.test(x))
  return [...guillemets, ...parens]
    .map((q) => q.split(/…|\.\.\./).map(normalizeAr).filter((p) => p.length >= 3))
    .filter((parts) => parts.length && parts.join('').replace(/\s/g, '').length >= 4)
}

const PROCLITICS = new Set(['', 'و', 'ف', 'ب', 'ل', 'ك', 'ال', 'وال', 'فال', 'بال', 'لل', 'كال', 'وب', 'ول', 'فل', 'وك', 'فب', 'ولل'])

/** يحتوي النص المطبَّع على الجزء بداية كلمة (مع سابقة قصيرة مثل و، ف، ب، ال) — لا داخل كلمة أخرى */
export function containsPhrase(text: string, part: string): boolean {
  let i = text.indexOf(part)
  while (i >= 0) {
    const start = text.lastIndexOf(' ', i - 1) + 1
    if (PROCLITICS.has(text.slice(start, i))) return true
    i = text.indexOf(part, i + 1)
  }
  return false
}

/** هل السؤال عن موضع الشاهد نفسه؟ — حينها يكشف المقتطفُ الجوابَ */
function asksForLocation(prompt: string, payload: StepPayload): boolean {
  const p = normalizeAr(prompt)
  if (/(?:^|\s)(?:في\s)?(?:اي|ايّ)\s(?:بيت|الابيات|ابيات|فقره|الفقرات|سطر|مقطع|شطر)(?=\s|$)|رقم البيت|حدد البيت|عين البيت|البيت الذي|الفقره التي|الموضع الذي/.test(p)) return true
  const opts = 'options' in payload ? payload.options : 'items' in payload ? payload.items : 'rights' in payload ? [...payload.lefts, ...payload.rights] : []
  return opts.some((o) => {
    const n = normalizeAr(o)
    return /(?:^|\s)(?:البيت|البيتين|الابيات|الفقره|المقطع)(?=\s|$)|(?:^|\s)ب\s?\d/.test(n) || /^\d{1,2}$/.test(n)
  })
}

function poemOf(docs: SourceDocument[]): { n: string; a: string; b: string }[] | null {
  const d = docs.find((x) => x.table && x.table.length && x.table.every((r) => r.length === 3 && /^\d+\s*-?$/.test(r[0]!.trim())))
  return d ? d.table!.map((r) => ({ n: r[0]!.replace(/\D/g, ''), a: r[1]!, b: r[2]! })) : null
}

/** شعر التفعيلة المحفوظ نصًّا بأسطر مرقّمة («1- …»): كل سطر صفّ واحد */
function numberedLinesOf(docs: SourceDocument[]): { n: string; a: string; b: string }[] | null {
  const rows = docs
    .filter((x) => x.kind === 'text' && x.text)
    .flatMap((x) => x.text!.split('\n'))
    .map((l) => /^\s*(\d{1,2})\s*[-–.)]\s*(.+)$/.exec(l))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => ({ n: m[1]!, a: m[2]!.trim(), b: '' }))
  return rows.length >= 5 ? rows : null
}

function proseOf(docs: SourceDocument[]): string[] | null {
  // نص الموضوع: أطول وثيقة نصية (التقديم والتوثيق والشرح أقصر منها)
  const d = [...docs].filter((x) => x.kind === 'text' && x.text).sort((a, b) => b.text!.length - a.text!.length)[0]
  if (!d || d.text!.length < 200) return null
  return d.text!.split('\n').map((p) => p.trim()).filter(Boolean)
}

function sentences(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[.!؟?؛])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** جملة طويلة: نافذة حول موضع الاقتباس، مقطوعة عند المسافات */
function window(sentence: string, part: string): string {
  if (sentence.length <= MAX_SENTENCE) return sentence
  const words = sentence.split(/\s+/)
  const norm = words.map(normalizeAr)
  const first = part.split(' ')[0]!
  const at = Math.max(0, norm.findIndex((w) => w.includes(first)))
  let lo = at
  let hi = at
  let len = words[at]!.length
  while (len < MAX_SENTENCE && (lo > 0 || hi < words.length - 1)) {
    if (hi < words.length - 1) len += words[++hi]!.length + 1
    if (lo > 0 && len < MAX_SENTENCE) len += words[--lo]!.length + 1
  }
  return `${lo > 0 ? '… ' : ''}${words.slice(lo, hi + 1).join(' ')}${hi < words.length - 1 ? ' …' : ''}`
}

/**
 * ملء فراغ منقول من النص نفسه («أكمل … من البيتين»): عرض الأبيات فوقه ينسخ الجواب للتلميذ، فلا يُعرض.
 * يكفي أن يقع ما حول الفراغات (6 أحرف فأكثر) أو ثلاث كلمات متتالية منه حرفيًا في المقتطف.
 */
function copiesExcerpt(payload: StepPayload, excerpt: StepExcerpt): boolean {
  if (payload.type !== 'fill_blank') return false
  const text = normalizeAr(excerpt.kind === 'verses' ? excerpt.rows.map((r) => `${r.a} ${r.b}`).join(' ') : excerpt.parts.join(' '))
  return payload.text
    .split(/_{2,}/)
    .map(normalizeAr)
    .filter((seg) => seg.replace(/\s/g, '').length >= 6)
    .some((seg) => {
      if (text.includes(seg)) return true
      // نافذة من 3 كلمات متتالية منقولة من النص (8 أحرف فأكثر) تكفي: «رمت ____ الأيام فهو لهيد (ب10)»
      const w = seg.split(' ')
      for (let i = 0; i + 3 <= w.length; i++) {
        const win = w.slice(i, i + 3).join(' ')
        if (win.replace(/\s/g, '').length >= 8 && text.includes(win)) return true
      }
      return false
    })
}

export function stepExcerpt(step: { prompt: string; payload: StepPayload }, question: Pick<OriginalQuestion, 'verbatim_text' | 'documents'>): StepExcerpt | null {
  const ex = findExcerpt(step, question)
  return ex && !copiesExcerpt(step.payload, ex) ? ex : null
}

/* ── الإنجليزية والفرنسية: الفقرة المذكورة صراحة (§2، paragraph 3، le deuxième paragraphe) ── */
const LATIN_ORD: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, premier: 1, première: 1, deuxième: 2, troisième: 3, quatrième: 4, cinquième: 5, sixième: 6 }

export function latinParagraphRefs(text: string, last: number): number[] {
  const t = text.toLowerCase()
  const out = new Set<number>()
  for (const m of t.matchAll(/§\s?(\d{1,2})/g)) out.add(+m[1]!)
  for (const m of t.matchAll(/\bparagraph(?:e)?\s+(\d{1,2})\b/g)) out.add(+m[1]!)
  for (const m of t.matchAll(/\b(first|second|third|fourth|fifth|sixth|last)\s+paragraph\b/g)) out.add(m[1] === 'last' ? last : LATIN_ORD[m[1]!]!)
  for (const m of t.matchAll(/\b(premier|première|deuxième|second|seconde|troisième|quatrième|cinquième|sixième|dernier)\s+paragraphe\b/g)) out.add(m[1] === 'dernier' ? last : m[1]!.startsWith('second') ? 2 : LATIN_ORD[m[1]!]!)
  return [...out].filter((n) => n >= 1 && n <= last).sort((a, b) => a - b)
}

function latinExcerpt(step: { prompt: string; payload: StepPayload }, question: Pick<OriginalQuestion, 'verbatim_text' | 'documents'>): StepExcerpt | null {
  // سؤال عن موضع الفقرة نفسه: لا مقتطف
  if (/\bwhich paragraph\b|\bin which §|\bquel paragraphe\b|\bdans quel paragraphe\b|\bwhich §/i.test(step.prompt)) return null
  const opts = 'options' in step.payload ? step.payload.options : 'items' in step.payload ? step.payload.items : 'rights' in step.payload ? [...step.payload.lefts, ...step.payload.rights] : []
  if (opts.some((o) => /§|\bparagraph/i.test(o))) return null
  const paras = proseOf(question.documents)
  if (!paras) return null
  let refs = latinParagraphRefs(step.prompt, paras.length)
  if (!refs.length) refs = latinParagraphRefs(question.verbatim_text, paras.length)
  if (refs.length !== 1) return null
  const para = paras[refs[0]! - 1]!
  return para.length <= MAX_PARAGRAPH * 2 ? { kind: 'prose', parts: [para] } : null
}

const isLatin = (s: string) => (s.match(/[A-Za-zÀ-ÿ]/g) ?? []).length > (s.match(/[\u0600-\u06FF]/g) ?? []).length

function findExcerpt(step: { prompt: string; payload: StepPayload }, question: Pick<OriginalQuestion, 'verbatim_text' | 'documents'>): StepExcerpt | null {
  if (isLatin(step.prompt)) return latinExcerpt(step, question)
  if (asksForLocation(step.prompt, step.payload)) return null
  const poem = poemOf(question.documents) ?? numberedLinesOf(question.documents)
  if (poem) {
    const byNum = new Map(poem.map((r) => [Number(r.n), r]))
    const last = Math.max(...poem.map((r) => Number(r.n)))
    let nums = verseRefs(step.prompt, last)
    if (!nums.length) {
      const hits = new Set<number>()
      for (const parts of quotes(step.prompt)) {
        const found = poem.filter((r) => {
          const v = normalizeAr(`${r.a} ${r.b}`)
          return parts.every((p) => containsPhrase(v, p))
        })
        if (found.length === 1) hits.add(Number(found[0]!.n))
        else if (!found.length) {
          // اقتباس يمتدّ على بيتين متتاليين
          const pairs = poem.slice(0, -1).filter((r, i) => {
            const v = normalizeAr(`${r.a} ${r.b} ${poem[i + 1]!.a} ${poem[i + 1]!.b}`)
            return parts.every((p) => containsPhrase(v, p))
          })
          if (pairs.length === 1) {
            hits.add(Number(pairs[0]!.n))
            hits.add(Number(pairs[0]!.n) + 1)
          }
        }
      }
      nums = [...hits].sort((a, b) => a - b).slice(0, 3)
    }
    if (!nums.length) {
      const q = verseRefs(question.verbatim_text, last)
      if (q.length <= 4) nums = q
    }
    const rows = nums.map((n) => byNum.get(n)).filter((r): r is NonNullable<typeof r> => !!r)
    return rows.length && rows.length <= MAX_VERSES ? { kind: 'verses', rows } : null
  }
  const paras = proseOf(question.documents)
  if (!paras) return null
  const refs = paragraphRefs(step.prompt, paras.length)
  if (refs.length === 1 && paras[refs[0]! - 1]!.length <= MAX_PARAGRAPH) return { kind: 'prose', parts: [paras[refs[0]! - 1]!] }
  const parts: string[] = []
  for (const qs of quotes(step.prompt)) {
    const found = paras.flatMap(sentences).filter((s) => {
      const n = normalizeAr(s)
      return qs.every((p) => containsPhrase(n, p))
    })
    if (found.length === 1 && !parts.includes(found[0]!)) parts.push(window(found[0]!, qs[0]!))
  }
  if (parts.length) return { kind: 'prose', parts: parts.slice(0, 2) }
  const q = paragraphRefs(question.verbatim_text, paras.length)
  if (q.length === 1 && paras[q[0]! - 1]!.length <= MAX_PARAGRAPH) return { kind: 'prose', parts: [paras[q[0]! - 1]!] }
  return null
}
