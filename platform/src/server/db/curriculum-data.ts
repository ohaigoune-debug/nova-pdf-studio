/**
 * بيانات المنهاج الجزائري المرجعية — المصدر الوحيد للتسميات في المنصة.
 * تُزرع (أو تُحدَّث) عند كل bootstrap بلا تكرار. المعاملات لا تُخمَّن: تبقى فارغة حتى تُدخل من مصدر رسمي.
 */
import type { ContentSourceType, EducationStage } from './schema/enums'

export const CURRICULUM_VERSION = { code: 'DZ-2016', nameAr: 'منهاج الجيل الثاني (إصلاح 2016)', startYear: 2016, isCurrent: true }

export const STAGES: { code: EducationStage; ar: string; fr: string; exam: string | null; order: number }[] = [
  { code: 'PRIMARY', ar: 'التعليم الابتدائي', fr: 'Primaire', exam: null, order: 1 },
  { code: 'MIDDLE', ar: 'التعليم المتوسط', fr: 'Moyen', exam: 'BEM', order: 2 },
  { code: 'SECONDARY', ar: 'التعليم الثانوي', fr: 'Secondaire', exam: 'BAC', order: 3 }
]

/** الصفوف بترتيب عام واحد. أسماء 1AS…3AS موجودة سلفاً ولا تُستبدل */
export const GRADES: { code: string; slug: string; ar: string; stage: EducationStage; order: number }[] = [
  { code: '1AP', slug: '1ap', ar: 'السنة الأولى ابتدائي', stage: 'PRIMARY', order: 1 },
  { code: '2AP', slug: '2ap', ar: 'السنة الثانية ابتدائي', stage: 'PRIMARY', order: 2 },
  { code: '3AP', slug: '3ap', ar: 'السنة الثالثة ابتدائي', stage: 'PRIMARY', order: 3 },
  { code: '4AP', slug: '4ap', ar: 'السنة الرابعة ابتدائي', stage: 'PRIMARY', order: 4 },
  { code: '5AP', slug: '5ap', ar: 'السنة الخامسة ابتدائي', stage: 'PRIMARY', order: 5 },
  { code: '1AM', slug: '1am', ar: 'السنة الأولى متوسط', stage: 'MIDDLE', order: 6 },
  { code: '2AM', slug: '2am', ar: 'السنة الثانية متوسط', stage: 'MIDDLE', order: 7 },
  { code: '3AM', slug: '3am', ar: 'السنة الثالثة متوسط', stage: 'MIDDLE', order: 8 },
  { code: '4AM', slug: '4am', ar: 'السنة الرابعة متوسط (شهادة التعليم المتوسط)', stage: 'MIDDLE', order: 9 },
  { code: '1AS', slug: '1as', ar: 'السنة الأولى ثانوي', stage: 'SECONDARY', order: 10 },
  { code: '2AS', slug: '2as', ar: 'السنة الثانية ثانوي', stage: 'SECONDARY', order: 11 },
  { code: '3AS', slug: '3as', ar: 'السنة الثالثة ثانوي (بكالوريا)', stage: 'SECONDARY', order: 12 }
]

/** الشعب (الثمانية الأولى موجودة سلفاً) وخيارات تقني رياضي تحت أمّها */
export const STREAM_DATA: { code: string; slug: string; ar: string; parent?: string; order: number }[] = [
  { code: 'TC_SCI', slug: 'tc-sciences', ar: 'جذع مشترك علوم وتكنولوجيا', order: 1 },
  { code: 'TC_LIT', slug: 'tc-lettres', ar: 'جذع مشترك آداب', order: 2 },
  { code: 'SCI', slug: 'sciences', ar: 'علوم تجريبية', order: 3 },
  { code: 'MATH', slug: 'math', ar: 'رياضيات', order: 4 },
  { code: 'TM', slug: 'tech-math', ar: 'تقني رياضي', order: 5 },
  { code: 'GE', slug: 'gestion', ar: 'تسيير واقتصاد', order: 6 },
  { code: 'LIT', slug: 'lettres-philo', ar: 'آداب وفلسفة', order: 7 },
  { code: 'LANG', slug: 'langues', ar: 'لغات أجنبية', order: 8 },
  { code: 'TM_CIVIL', slug: 'tm-genie-civil', ar: 'تقني رياضي — هندسة مدنية', parent: 'TM', order: 9 },
  { code: 'TM_MECA', slug: 'tm-genie-mecanique', ar: 'تقني رياضي — هندسة ميكانيكية', parent: 'TM', order: 10 },
  { code: 'TM_ELEC', slug: 'tm-genie-electrique', ar: 'تقني رياضي — هندسة كهربائية', parent: 'TM', order: 11 },
  { code: 'TM_PROC', slug: 'tm-genie-procedes', ar: 'تقني رياضي — هندسة الطرائق', parent: 'TM', order: 12 }
]

export const GRADE_STREAMS: Record<string, string[]> = {
  '1AS': ['TC_SCI', 'TC_LIT'],
  '2AS': ['SCI', 'MATH', 'TM', 'GE', 'LIT', 'LANG', 'TM_CIVIL', 'TM_MECA', 'TM_ELEC', 'TM_PROC'],
  '3AS': ['SCI', 'MATH', 'TM', 'GE', 'LIT', 'LANG', 'TM_CIVIL', 'TM_MECA', 'TM_ELEC', 'TM_PROC']
}

export const SUBJECTS: { code: string; slug: string; ar: string; fr: string; order: number }[] = [
  { code: 'ARABIC', slug: 'arabic', ar: 'اللغة العربية', fr: 'Langue arabe', order: 1 },
  { code: 'MATH', slug: 'math', ar: 'الرياضيات', fr: 'Mathématiques', order: 2 },
  { code: 'PHYSICS', slug: 'physics', ar: 'العلوم الفيزيائية', fr: 'Sciences physiques', order: 3 },
  { code: 'SCIENCES', slug: 'sciences', ar: 'علوم الطبيعة والحياة', fr: 'Sciences naturelles', order: 4 },
  { code: 'SCI_TECH', slug: 'science-tech', ar: 'التربية العلمية والتكنولوجية', fr: 'Éducation scientifique et technologique', order: 5 },
  { code: 'FRENCH', slug: 'french', ar: 'اللغة الفرنسية', fr: 'Langue française', order: 6 },
  { code: 'ENGLISH', slug: 'english', ar: 'اللغة الإنجليزية', fr: 'Langue anglaise', order: 7 },
  { code: 'HISTGEO', slug: 'history-geography', ar: 'التاريخ والجغرافيا', fr: 'Histoire et géographie', order: 8 },
  { code: 'PHILO', slug: 'philosophy', ar: 'الفلسفة', fr: 'Philosophie', order: 9 },
  { code: 'ISLAMIC', slug: 'islamic', ar: 'العلوم الإسلامية', fr: 'Sciences islamiques', order: 10 },
  { code: 'CIVIC', slug: 'civic', ar: 'التربية المدنية', fr: 'Éducation civique', order: 11 },
  { code: 'AMAZIGH', slug: 'amazigh', ar: 'اللغة الأمازيغية', fr: 'Tamazight', order: 12 },
  { code: 'ACCOUNTING', slug: 'accounting', ar: 'التسيير المحاسبي والمالي', fr: 'Gestion comptable et financière', order: 13 },
  { code: 'ECONOMICS', slug: 'economics', ar: 'الاقتصاد والمناجمنت', fr: 'Économie et management', order: 14 },
  { code: 'LAW', slug: 'law', ar: 'القانون', fr: 'Droit', order: 15 },
  { code: 'TECHNOLOGY', slug: 'technology', ar: 'التكنولوجيا', fr: 'Technologie', order: 16 },
  { code: 'TECH_CIVIL', slug: 'civil-engineering', ar: 'الهندسة المدنية', fr: 'Génie civil', order: 17 },
  { code: 'TECH_MECA', slug: 'mechanical-engineering', ar: 'الهندسة الميكانيكية', fr: 'Génie mécanique', order: 18 },
  { code: 'TECH_ELEC', slug: 'electrical-engineering', ar: 'الهندسة الكهربائية', fr: 'Génie électrique', order: 19 },
  { code: 'TECH_PROC', slug: 'process-engineering', ar: 'هندسة الطرائق', fr: 'Génie des procédés', order: 20 },
  { code: 'GERMAN', slug: 'german', ar: 'اللغة الألمانية', fr: 'Allemand', order: 21 },
  { code: 'SPANISH', slug: 'spanish', ar: 'اللغة الإسبانية', fr: 'Espagnol', order: 22 },
  { code: 'ITALIAN', slug: 'italian', ar: 'اللغة الإيطالية', fr: 'Italien', order: 23 },
  { code: 'COMPUTING', slug: 'computing', ar: 'المعلوماتية', fr: 'Informatique', order: 24 },
  { code: 'ARTS', slug: 'arts', ar: 'التربية الفنية', fr: 'Éducation artistique', order: 25 },
  { code: 'SPORT', slug: 'sport', ar: 'التربية البدنية والرياضية', fr: 'Éducation physique', order: 26 }
]

/** المواد المقرّرة: [صف، شعبة (أو null لكل الصف)، مواد، مواد الامتحان الوطني] */
const P12 = ['ARABIC', 'MATH', 'ISLAMIC', 'CIVIC', 'SCI_TECH', 'ARTS', 'SPORT', 'AMAZIGH']
const P35 = [...P12, 'FRENCH', 'ENGLISH', 'HISTGEO']
const MIDDLE = ['ARABIC', 'MATH', 'PHYSICS', 'SCIENCES', 'FRENCH', 'ENGLISH', 'HISTGEO', 'ISLAMIC', 'CIVIC', 'COMPUTING', 'ARTS', 'SPORT', 'AMAZIGH']
const BEM = ['ARABIC', 'MATH', 'PHYSICS', 'SCIENCES', 'FRENCH', 'ENGLISH', 'HISTGEO', 'ISLAMIC', 'CIVIC']
const COMMON_AS = ['ARABIC', 'FRENCH', 'ENGLISH', 'HISTGEO', 'ISLAMIC', 'AMAZIGH', 'SPORT']
const BY_STREAM: Record<string, string[]> = {
  SCI: [...COMMON_AS, 'SCIENCES', 'PHYSICS', 'MATH', 'PHILO'],
  MATH: [...COMMON_AS, 'MATH', 'PHYSICS', 'SCIENCES', 'PHILO'],
  TM: [...COMMON_AS, 'MATH', 'PHYSICS', 'PHILO'],
  TM_CIVIL: ['TECH_CIVIL'],
  TM_MECA: ['TECH_MECA'],
  TM_ELEC: ['TECH_ELEC'],
  TM_PROC: ['TECH_PROC'],
  GE: [...COMMON_AS, 'ACCOUNTING', 'ECONOMICS', 'MATH', 'LAW', 'PHILO'],
  LIT: [...COMMON_AS, 'PHILO', 'MATH'],
  LANG: [...COMMON_AS, 'GERMAN', 'SPANISH', 'ITALIAN', 'PHILO', 'MATH']
}
/** في البكالوريا تُمتحن كل مواد الشعبة عدا التربية البدنية (امتحانها تطبيقي خارج الأرشيف) */
const notExam = new Set(['SPORT'])

export const OFFERINGS: { grade: string; stream: string | null; subjects: string[]; exam: string[] }[] = [
  ...['1AP', '2AP'].map((grade) => ({ grade, stream: null, subjects: P12, exam: [] })),
  ...['3AP', '4AP', '5AP'].map((grade) => ({ grade, stream: null, subjects: P35, exam: [] })),
  ...['1AM', '2AM', '3AM'].map((grade) => ({ grade, stream: null, subjects: MIDDLE, exam: [] })),
  { grade: '4AM', stream: null, subjects: MIDDLE, exam: BEM },
  { grade: '1AS', stream: 'TC_SCI', subjects: [...COMMON_AS, 'MATH', 'PHYSICS', 'SCIENCES', 'TECHNOLOGY', 'COMPUTING'], exam: [] },
  { grade: '1AS', stream: 'TC_LIT', subjects: [...COMMON_AS, 'MATH', 'PHYSICS', 'SCIENCES', 'COMPUTING'], exam: [] },
  ...Object.entries(BY_STREAM).map(([stream, subjects]) => ({ grade: '2AS', stream, subjects, exam: [] as string[] })),
  ...Object.entries(BY_STREAM).map(([stream, subjects]) => ({ grade: '3AS', stream, subjects, exam: subjects.filter((s) => !notExam.has(s)) }))
]

export const SOURCES: { code: string; type: ContentSourceType; name: string; baseUrl: string | null; attribution: string }[] = [
  { code: 'dzexams', type: 'DZEXAMS', name: 'DzExams', baseUrl: 'https://www.dzexams.com', attribution: 'المصدر: DzExams' },
  { code: 'youtube', type: 'YOUTUBE', name: 'YouTube', baseUrl: 'https://www.youtube.com', attribution: 'المصدر: YouTube' },
  { code: 'haigoun', type: 'HAIGOUN', name: 'الأستاذ الدكتور حيقون أسامة', baseUrl: null, attribution: 'المصدر: الأستاذ حيقون أسامة' },
  { code: 'madrasadz', type: 'MADRASADZ', name: 'منصة مدرسة', baseUrl: 'https://madrasadz.com', attribution: 'المصدر: منصة مدرسة' },
  { code: 'onec', type: 'OFFICIAL_EXAM', name: 'الديوان الوطني للامتحانات والمسابقات', baseUrl: 'https://www.onec.dz', attribution: 'المصدر: امتحان رسمي — الديوان الوطني للامتحانات والمسابقات' }
]
