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
