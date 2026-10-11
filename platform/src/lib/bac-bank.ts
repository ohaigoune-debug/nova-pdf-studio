/** بنك البكالوريا — دوال خالصة مشتركة بين الخادم والمتصفح: رقم الموضوع من العنوان، لغة المادة، التسميات */
import { normalizeArabic } from '@/server/lib/arabic'

/** «الموضوع الأول/الثاني»، «موضوع 1/2»، «Sujet 1/2» → 1 | 2 (null إن لم يُذكر) */
export function topicNumberOf(title: string | null | undefined): number | null {
  if (!title) return null
  const n = normalizeArabic(title).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  const m = /الموضوع\s*(الاول|الثاني|1|2|01|02)(?=\s|$)|(?:^|\s)موضوع\s*(1|2|01|02)(?=\s|$)|sujet\s*(1|2)(?=\s|$)|topic\s*(1|2)(?=\s|$)/i.exec(n)
  if (!m) return null
  const v = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? '').toLowerCase()
  if (v === 'الاول' || v === '1' || v === '01') return 1
  if (v === 'الثاني' || v === '2' || v === '02') return 2
  return null
}

/** لغة الوثيقة بحسب المادة (المواد الأجنبية تُكتب بلغتها) */
export function languageOfSubject(subjectCode: string | null | undefined): string {
  switch (subjectCode) {
    case 'FRENCH':
      return 'fr'
    case 'ENGLISH':
      return 'en'
    case 'GERMAN':
      return 'de'
    case 'SPANISH':
      return 'es'
    case 'ITALIAN':
      return 'it'
    case 'AMAZIGH':
      return 'ber'
    default:
      return 'ar'
  }
}

/** المواد التي تُراجَع حلولها حسابياً (self-check) */
export const SCIENTIFIC_SUBJECTS = new Set(['MATH', 'PHYSICS', 'SCIENCES', 'TECH_CIVIL', 'TECH_MECA', 'TECH_ELEC', 'TECH_PROC', 'ACCOUNTING', 'ECONOMICS'])

export const TOPIC_AR = (n: number | null | undefined): string => (n === 1 ? 'الموضوع الأول' : n === 2 ? 'الموضوع الثاني' : n ? `الموضوع ${n}` : '')
export const SESSION_AR: Record<string, string> = { NORMAL: 'الدورة الرئيسية', MAKEUP: 'الدورة الاستدراكية', MOCK: 'تجريبية' }

/* ───────────── تخمين بيانات ملف بكالوريا من اسمه وبداية نصّه (حتمي؛ الذكاء الاصطناعي يكمل الناقص فقط) ───────────── */

export interface BacFileGuess {
  year: number | null
  session: 'NORMAL' | 'MAKEUP' | null
  streamCode: string | null
  subjectCode: string | null
  topicNumber: number | null
  correction: boolean
}

/** الترتيب مهم: «sciences physiques» فيزياء لا علوم طبيعية، و«هندسة» قبل الرياضيات */
const SUBJECT_PATTERNS: [string, RegExp][] = [
  ['TECH_CIVIL', /genie[\s_-]?civil|هندسه مدنيه/],
  ['TECH_MECA', /genie[\s_-]?mecanique|mecanique|هندسه ميكانيكيه|ميكانيك/],
  ['TECH_ELEC', /genie[\s_-]?electrique|electrique|هندسه كهربائيه|كهربائي/],
  ['TECH_PROC', /genie[\s_-]?des[\s_-]?procedes|procedes|هندسه الطرائق|طرائق/],
  ['PHYSICS', /physi|فيزيا/],
  ['SCIENCES', /sciences?[\s_-]?(?:nat|de la nature)|svt|علوم طبيعيه|علوم الطبيعه|الطبيعه والحياه/],
  ['MATH', /math|رياضيات/],
  ['ACCOUNTING', /compta|محاسب|تسيير محاسبي/],
  ['ECONOMICS', /econo|اقتصاد ومناجمنت|مناجمنت/],
  ['LAW', /droit|قانون/],
  ['PHILO', /philo|فلسفه/],
  ['HISTGEO', /hist|geo|تاريخ|جغرافيا/],
  ['ISLAMIC', /islam|شرعيه|اسلاميه/],
  ['FRENCH', /fran[cç]ais|french|فرنسيه/],
  ['ENGLISH', /anglais|english|انجليزيه|انكليزيه/],
  ['GERMAN', /allemand|german|المانيه/],
  ['SPANISH', /espagnol|spanish|اسبانيه/],
  ['ITALIAN', /italien|italian|ايطاليه/],
  ['AMAZIGH', /amazigh|tamazight|امازيغيه/],
  ['ARABIC', /arabe|arabic|عربيه|ادب عربي/]
]

const STREAM_PATTERNS: [string, RegExp][] = [
  ['TM', /(?:^|[\s_-])(?:mt|tm)(?:$|[\s_-])|tech(?:nique)?[\s_-]?math|تقني رياضي|تقني/],
  ['GE', /(?:^|[\s_-])ge(?:$|[\s_-])|gestion|تسيير/],
  ['LANG', /(?:^|[\s_-])le(?:$|[\s_-])|langues|لغات/],
  ['LIT', /(?:^|[\s_-])lp(?:$|[\s_-])|lettres|اداب/],
  ['SCI', /(?:^|[\s_-])(?:se|sc[\s_-]?exp)(?:$|[\s_-])|sciences?[\s_-]?exp|experimentales|علوم تجريبيه|(?:^|\s)ع ت(?:$|\s)/],
  ['MATH', /(?:^|[\s_-])(?:sm|m)(?:$|[\s_-])|sc[\s_-]?math|sciences?[\s_-]?math|شعبه (?:ال)?رياضيات|شعبه رياضي/]
]

/**
 * أسماء المجلدات والملفات المنظّمة (أرشيف «BAC 2008-2026»): «المادة / الشعبة / السنة / الدورة / 2022 - القانون - تسيير واقتصاد - الدورة العادية - الموضوع.pdf».
 * كل مقطع يُطابَق كاملاً بأسماء المواد والشعب الرسمية — أدقّ من البحث عن كلمة داخل الاسم.
 */
const SEGMENT_SUBJECTS: [string, string[]][] = [
  ['ARABIC', ['اللغة العربية وآدابها', 'اللغة العربية', 'الأدب العربي']],
  ['MATH', ['الرياضيات']],
  ['PHYSICS', ['العلوم الفيزيائية', 'الفيزياء']],
  ['SCIENCES', ['علوم الطبيعة والحياة', 'العلوم الطبيعية']],
  ['FRENCH', ['اللغة الفرنسية']],
  ['ENGLISH', ['اللغة الإنجليزية']],
  ['HISTGEO', ['التاريخ والجغرافيا']],
  ['PHILO', ['الفلسفة']],
  ['ISLAMIC', ['العلوم الإسلامية', 'التربية الإسلامية']],
  ['AMAZIGH', ['اللغة الأمازيغية']],
  ['ACCOUNTING', ['التسيير المحاسبي والمالي']],
  ['ECONOMICS', ['الاقتصاد والمناجمنت']],
  ['LAW', ['القانون']],
  ['TECH_CIVIL', ['الهندسة المدنية']],
  ['TECH_MECA', ['الهندسة الميكانيكية']],
  ['TECH_ELEC', ['الهندسة الكهربائية']],
  ['TECH_PROC', ['هندسة الطرائق']],
  ['GERMAN', ['اللغة الألمانية']],
  ['SPANISH', ['اللغة الإسبانية']],
  ['ITALIAN', ['اللغة الإيطالية']]
]
const SEGMENT_STREAMS: [string, string[]][] = [
  ['SCI', ['علوم تجريبية']],
  ['MATH', ['رياضيات', 'شعبة الرياضيات']],
  ['TM', ['تقني رياضي']],
  ['GE', ['تسيير واقتصاد', 'تسيير و اقتصاد', 'اقتصاد وتسيير']],
  ['LIT', ['آداب وفلسفة', 'آداب و فلسفة']],
  ['LANG', ['لغات أجنبية']]
]
const segKey = (s: string) => normalizeArabic(s).replace(/\s+/g, '')
const SUBJECT_BY_SEGMENT = new Map(SEGMENT_SUBJECTS.flatMap(([code, names]) => names.map((n) => [segKey(n), code] as const)))
const STREAM_BY_SEGMENT = new Map(SEGMENT_STREAMS.flatMap(([code, names]) => names.map((n) => [segKey(n), code] as const)))

/** مقاطع الاسم: مسار المجلدات (/) وأجزاء اسم الملف المفصولة بشرطة محاطة بمسافتين */
export function nameSegments(name: string): string[] {
  return name
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .split(/\s*\/\s*|\s+[-–—]\s+/)
    .map((x) => x.trim())
    .filter(Boolean)
}

/** ما يُستخرج حتمياً من المقاطع؛ الحقل المجهول يبقى null */
export function guessFromSegments(name: string): Partial<BacFileGuess> {
  const out: Partial<BacFileGuess> = {}
  for (const seg of nameSegments(name)) {
    const k = segKey(seg)
    if (!out.subjectCode && SUBJECT_BY_SEGMENT.has(k)) out.subjectCode = SUBJECT_BY_SEGMENT.get(k)!
    else if (!out.streamCode && STREAM_BY_SEGMENT.has(k)) out.streamCode = STREAM_BY_SEGMENT.get(k)!
    else if (!out.year && /^(19[89]\d|20\d\d)$/.test(seg)) out.year = Number(seg)
    else if (/^الدورهالعاديه$|^الدورهالرييسيه$/.test(k)) out.session = 'NORMAL'
    else if (/^الدوره(الاستدراكيه|الاستثناييه|الثانيه)$/.test(k)) out.session = 'MAKEUP'
    else if (/^(الحل|حل|التصحيح|تصحيح|الحلالنموذجي|الاجابهالنموذجيه|الاجابه|الحلول)$/.test(k)) out.correction = true
    else if (k === 'الموضوع') out.correction = out.correction ?? false
  }
  return out
}

export function guessBacFile(name: string, text = ''): BacFileGuess {
  const seg = guessFromSegments(name)
  const base = name.replace(/\.[a-z0-9]{2,5}$/i, '')
  const n = normalizeArabic(base).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  const head = normalizeArabic(text.slice(0, 1500)).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  const both = `${n} \n ${head}`
  const pick = (patterns: [string, RegExp][], hay: string): string | null => patterns.find(([, re]) => re.test(hay))?.[0] ?? null
  const years = [...both.matchAll(/(?:^|\D)((?:19[89]|20[0-9])\d)(?=\D|$)/g)].map((m) => Number(m[1])).filter((y) => y >= 1990 && y <= 2100)
  // السنة من اسم الملف أولاً؛ وإلا أحدث سنة مذكورة في رأس النص (العنوان الرسمي)
  const fromName = [...n.matchAll(/(?:^|\D)((?:19[89]|20[0-9])\d)(?=\D|$)/g)].map((m) => Number(m[1]))
  const year = fromName[0] ?? (years.length ? Math.max(...years) : null)
  const session: BacFileGuess['session'] = /rattrapage|session[\s_-]?2|استدراكيه|الدوره الثانيه|الدوره الاستدراكيه/.test(both) ? 'MAKEUP' : year ? 'NORMAL' : null
  // أسماء الشعب تحوي أسماء مواد («آداب وفلسفة»، «تسيير واقتصاد»): تُحذف قبل البحث عن المادة
  const stripStreams = (s: string) => s.replace(/اداب و ?فلسفه|lettres[\s_-]*(?:et[\s_-]*)?philo\w*|تسيير و ?اقتصاد|اقتصاد و ?تسيير|gestion[\s_-]*(?:et[\s_-]*)?econ\w*|لغات اجنبيه|langues[\s_-]*etrangeres/g, ' ')
  const subjectCode = pick(SUBJECT_PATTERNS, stripStreams(n)) ?? pick(SUBJECT_PATTERNS, stripStreams(head))
  const streamCode = pick(STREAM_PATTERNS, n) ?? pick(STREAM_PATTERNS, head)
  const t = /(?:^|[\s_-])(?:s|sujet|t|topic)[\s_-]?0?([12])(?:$|[\s_-])/.exec(n)
  const topicNumber = topicNumberOf(base) ?? (t ? Number(t[1]) : null) ?? topicNumberOf(text.slice(0, 400))
  const correction = /corrig|correction|solution|bareme|تصحيح|الاجابه النموذجيه|(?:^|[\s_-])(?:ال)?حل(?:$|[\s_-])/.test(n)
  // المقاطع المطابقة كاملاً أدقّ من البحث داخل الاسم: تغلب عند وجودها
  return {
    year: seg.year ?? year,
    session: seg.session ?? session,
    streamCode: seg.streamCode ?? streamCode,
    subjectCode: seg.subjectCode ?? subjectCode,
    topicNumber,
    correction: seg.correction ?? correction
  }
}
