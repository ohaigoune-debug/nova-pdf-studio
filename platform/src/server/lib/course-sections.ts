/**
 * أقسام محتوى الدورة (قرار المالك 2026-10-27/28): الدروس بأرقام الحصص، الفيديوهات، الفروض،
 * الاختبارات، الملفات. عرض فقط: يُبنى من العناصر التي سمح بها الخادم أصلًا، فلا يضيف عنصرًا
 * ولا يخفيه، ولا يغيّر العنوان في القاعدة. دوال نقية تُختبر وحدها.
 */
import { normalizeArabic } from './arabic'

export const COURSE_SECTION_IDS = ['lessons', 'videos', 'homework', 'tests', 'files'] as const
export type CourseSectionId = (typeof COURSE_SECTION_IDS)[number]

export const COURSE_SECTION_LABELS_AR: Record<CourseSectionId, string> = {
  lessons: 'الدروس والحصص',
  videos: 'الفيديوهات',
  homework: 'الفروض',
  tests: 'الاختبارات',
  files: 'الملفات'
}

const LESSON_TYPES = new Set(['LESSON', 'ARTICLE', 'EXERCISE', 'QUIZ'])
const HOMEWORK_WORDS = new Set(['فرض', 'فروض', 'فرضان', 'فرضين', 'فرضا', 'devoir', 'devoirs'])
const TEST_WORDS = new Set(['اختبار', 'اختبارات', 'اختباران', 'اختبارين', 'امتحان', 'امتحانات', 'امتحانين', 'examen', 'examens', 'test', 'tests'])
const PREFIXES = ['وال', 'بال', 'فال', 'كال', 'لل', 'ال', 'و', 'ف', 'ب', 'ل']

/** الكلمة وجذورها بعد نزع سوابق العطف والجر والتعريف (فلا تُطابَق «فرضية» مثلًا) */
function wordForms(word: string): string[] {
  const forms = [word]
  for (const p of PREFIXES) if (word.startsWith(p) && word.length - p.length >= 3) forms.push(word.slice(p.length))
  return forms
}

/** أول كلمة فرض/اختبار في العنوان تحكم؛ null إن لم توجد */
export function assessmentKind(title: string): 'homework' | 'tests' | null {
  for (const word of normalizeArabic(title).split(' ')) {
    const forms = wordForms(word)
    if (forms.some((f) => HOMEWORK_WORDS.has(f))) return 'homework'
    if (forms.some((f) => TEST_WORDS.has(f))) return 'tests'
  }
  return null
}

const ORDINALS: Array<[RegExp, number]> = [
  [/^[أاإآ]ول[ىي]?$/u, 1], [/^ثاني[ةه]?$/u, 2], [/^ثالث[ةه]?$/u, 3], [/^رابع[ةه]?$/u, 4], [/^خامس[ةه]?$/u, 5],
  [/^سادس[ةه]?$/u, 6], [/^سابع[ةه]?$/u, 7], [/^ثامن[ةه]?$/u, 8], [/^تاسع[ةه]?$/u, 9], [/^عاشر[ةه]?$/u, 10],
  [/^حادي[ةه]?$/u, 1], [/^عشر(?:ون|ين)$/u, 20]
]
const ORDINAL = 'ال(?:[أاإآ]ول[ىي]?|ثاني[ةه]?|ثالث[ةه]?|رابع[ةه]?|خامس[ةه]?|سادس[ةه]?|سابع[ةه]?|ثامن[ةه]?|تاسع[ةه]?|عاشر[ةه]?|حادي[ةه]?|عشر(?:ون|ين))(?:\\s+عشر[ةه]?)?'
const SEP = '\\s()\\[\\]«»"\'—–\\-|:،,.'
const SESSION = new RegExp(`(^|[${SEP}])((?:ال)?(?:حص[ةه]|درس)|s[ée]ance)\\s*(?:رقم\\s*)?(?:(\\d{1,3})|(${ORDINAL}))(?=$|[${SEP}])`, 'iu')

function westernDigits(text: string): string {
  return text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0))
}

/** يزيل التشكيل والتطويل ويوحّد الأرقام، دون تغيير بقية الحروف (للمطابقة والعرض) */
function prepared(title: string): string {
  return westernDigits(title.normalize('NFKC').replace(/[ً-ْٰـ]/g, ''))
}

function ordinalValue(phrase: string): number | null {
  const [first, teen] = phrase.trim().replace(/^ال/u, '').split(/\s+/u)
  const hit = ORDINALS.find(([re]) => re.test(first ?? ''))
  if (!hit) return null
  if (hit[1] === 20) return 20
  return teen ? hit[1] + 10 : /^حادي/u.test(first ?? '') ? null : hit[1]
}

/** رقم الحصة من العنوان: «الحصة 3»، «حصة رقم ٣»، «الدرس الثالث»، «الحصة الحادية عشرة»، «Séance 3» */
export function parseSessionNumber(title: string): number | null {
  const m = SESSION.exec(prepared(title))
  if (!m) return null
  const value = m[3] ? Number(m[3]) : m[4] ? ordinalValue(m[4]) : null
  return value && value > 0 && value <= 999 ? value : null
}

/** العنوان دون عبارة الحصة التي تظهر في الشارة؛ لا يعيد نصًّا فارغًا أبدًا */
export function displayTitle(title: string): string {
  const text = prepared(title)
  const m = SESSION.exec(text)
  if (!m) return title.trim()
  const start = m.index + m[1]!.length
  const before = text.slice(0, start)
  const after = text.slice(m.index + m[0].length)
  // تُحذف العبارة حين تكون وسمًا: في أول العنوان أو آخره، أو مقطعًا بين فاصلين («أ | الحصة 2 | ب»).
  // في وسط جملة («شرح الحصة 1 بالفيديو») يبقى العنوان كما هو، والرقم يظهر في الشارة.
  const b = before.trim()
  const a = after.trim()
  const sepBefore = /[—–\-|:،,]$/u.test(b)
  const sepAfter = /^[—–\-|:،,.]/u.test(a)
  // في الأول: وسم دائمًا. في الآخر: بعد فاصل فقط («مدخل — الحصة 3» لا «شرح الحصة 1»). في الوسط: بين فاصلين.
  const tag = b === '' || (a === '' && sepBefore) || (sepBefore && sepAfter)
  if (!tag) return title.trim()
  const rest = (before + ' ' + after)
    .replace(/\s*([—–\-|:،,])\s*([—–\-|:،,]\s*)+/gu, ' $1 ')
    .replace(/^[\s—–\-|:،,.]+|[\s—–\-|:،,]+$/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
  return rest || title.trim()
}

export function classifyContent(item: { title: string; type: string }): CourseSectionId {
  const assessment = assessmentKind(item.title)
  if (assessment) return assessment
  if (item.type === 'VIDEO') return 'videos'
  if (parseSessionNumber(item.title) !== null || LESSON_TYPES.has(item.type)) return 'lessons'
  return 'files'
}

export type SectionItem<T> = T & { section: CourseSectionId; session: number | null; displayTitle: string }
export interface CourseSection<T> { id: CourseSectionId; label: string; items: SectionItem<T>[] }

/** الأقسام بالترتيب الثابت، والفارغ يُحذف؛ داخل القسم: رقم الحصة، ثم تاريخ النشر تصاعديًا، ثم العنوان */
export function buildCourseSections<T extends { title: string; type: string; publishedAt: Date | null }>(items: readonly T[]): CourseSection<T>[] {
  const enriched: SectionItem<T>[] = items.map((item) => {
    const session = parseSessionNumber(item.title)
    return { ...item, section: classifyContent(item), session, displayTitle: session === null ? item.title.trim() : displayTitle(item.title) }
  })
  const time = (d: Date | null) => (d ? d.getTime() : Number.POSITIVE_INFINITY)
  enriched.sort((a, b) =>
    (a.session ?? Number.POSITIVE_INFINITY) - (b.session ?? Number.POSITIVE_INFINITY) ||
    time(a.publishedAt) - time(b.publishedAt) ||
    a.title.localeCompare(b.title, 'ar'))
  return COURSE_SECTION_IDS
    .map((id) => ({ id, label: COURSE_SECTION_LABELS_AR[id], items: enriched.filter((i) => i.section === id) }))
    .filter((s) => s.items.length > 0)
}
