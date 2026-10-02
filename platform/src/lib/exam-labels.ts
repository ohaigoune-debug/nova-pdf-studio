/** تسميات أنواع الامتحان بالعربية — وحدة خالصة تُستعمل في الخادم والمتصفح معاً */
import type { ExamKind } from '@/server/db/schema/enums'

export const EXAM_KIND_AR: Record<ExamKind, string> = { TEST: 'اختبار', HOMEWORK: 'فرض', BAC_MOCK: 'بكالوريا تجريبية', BEM_MOCK: 'شهادة تعليم متوسط تجريبية', QUIZ: 'استجواب', PRACTICE: 'تدريب' }
