/**
 * تخمين حتمي لنوع الوثيقة وتقسيم سلسلة مجمَّعة — بديل الذكاء الاصطناعي (وحين لا مزوّد)،
 * ونقطة انطلاق «كما رفعتها». الأستاذ يراجع كل شيء قبل النشر.
 */
import { normalizeArabic } from '@/server/lib/arabic'

export type GuessType = 'LESSON' | 'SUMMARY' | 'EXERCISE' | 'HOMEWORK' | 'TEST' | 'SOLUTION'

const SOLUTION = /(?:^|\s)(?:ال)?(?:حل|حلول|تصحيح|اجابه|اجابات)(?:\s|$)|corrig|solution|correction/
const HOMEWORK = /(?:^|\s)(?:ال)?فرض|(?:^|\s)(?:ال)?فروض|devoir/
const TEST = /(?:^|\s)(?:ال)?اختبار|(?:^|\s)(?:ال)?امتحان|composition|examen/
const SUMMARY = /(?:^|\s)(?:ال)?ملخص|resume|synthese/
const LESSON = /(?:^|\s)(?:ال)?درس|(?:^|\s)(?:ال)?دروس|cours|lecon/
const EXERCISE = /(?:^|\s)(?:ال)?تمارين|(?:^|\s)سلسله|serie|exercices?/

export function guessDocType(name: string, text = ''): GuessType {
  const n = normalizeArabic(name.replace(/\.[a-z0-9]{2,5}$/i, ''))
  for (const hay of [n, normalizeArabic(text.slice(0, 300))]) {
    if (!hay) continue
    if (SOLUTION.test(hay)) return 'SOLUTION'
    if (HOMEWORK.test(hay)) return 'HOMEWORK'
    if (TEST.test(hay)) return 'TEST'
    if (SUMMARY.test(hay)) return 'SUMMARY'
    if (EXERCISE.test(hay)) return 'EXERCISE'
    if (LESSON.test(hay)) return 'LESSON'
  }
  return 'EXERCISE'
}

/** «حلّ الفرض الأول.pdf» ↔ «الفرض الأول.pdf»: الاسم بلا كلمات الحلّ والامتداد */
export function solutionBaseName(name: string): string {
  return normalizeArabic(name.replace(/\.[a-z0-9]{2,5}$/i, ''))
    .replace(/(?:^|\s)(?:ال)?(?:حل|حلول|تصحيح|اجابه|نموذجيه|النموذجيه)(?=\s|$)/g, ' ')
    .replace(/corrig\w*|solution|correction/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** الفصل من النص: «الفصل الأول/الثاني/الثالث» أو «الفصل 2» */
export function guessTerm(text: string): number | null {
  const n = normalizeArabic(text)
  const m = /الفصل\s*(الاول|الثاني|الثالث|[123])(?=\s|$)/.exec(n)
  if (!m) return null
  return m[1] === 'الاول' || m[1] === '1' ? 1 : m[1] === 'الثاني' || m[1] === '2' ? 2 : 3
}

export interface PageSegment {
  fromPage: number
  toPage: number
  type: GuessType
  title: string
}

const HEAD = /^\s*(?:(?:ال)?(?:حل|تصحيح)\s+)?(?:ال)?(?:فرض|اختبار|امتحان|سلسله)(?=\s|$)[^\n]{0,80}/

/**
 * يقسّم ملفاً مجمَّعاً عند كل صفحة يبدأ أول سطرها بعنوان وثيقة («الفرض الأول…»، «اختبار الفصل…»، «حلّ الفرض…»).
 * بلا عناوين ⇒ قطعة واحدة (الملف كاملاً).
 */
export function splitByHeadings(pages: { n: number; text: string }[]): PageSegment[] {
  const starts: { n: number; head: string }[] = []
  for (const p of pages) {
    const first = normalizeArabic(p.text.split('\n').find((l) => l.trim()) ?? p.text.slice(0, 120)).slice(0, 120)
    const m = HEAD.exec(first)
    if (m) starts.push({ n: p.n, head: (p.text.split('\n').find((l) => l.trim()) ?? '').trim().slice(0, 120) })
  }
  if (starts.length < 2) return []
  const last = pages[pages.length - 1]!.n
  if (starts[0]!.n !== pages[0]!.n) starts.unshift({ n: pages[0]!.n, head: 'مقدّمة السلسلة' })
  return starts.map((s, i) => {
    const to = (starts[i + 1]?.n ?? last + 1) - 1
    return { fromPage: s.n, toPage: to, type: guessDocType(s.head), title: s.head }
  })
}
