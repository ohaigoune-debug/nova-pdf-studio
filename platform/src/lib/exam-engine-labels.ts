/** تسميات محرّك الامتحانات بالعربية — وحدة بلا تبعيات خادمية لتُستعمل في مكوّنات الخادم والعميل معاً */
import type { ExamDocStatus, ExamDocType } from '@/server/db/schema/enums'

export const DOC_STATUS_AR: Record<ExamDocStatus, string> = { PENDING: 'معلّقة', PROCESSING: 'قيد المعالجة', NEEDS_REVIEW: 'بانتظار المراجعة', VERIFIED: 'موثَّقة', PUBLISHED: 'منشورة', FAILED: 'فشلت' }
export const DOC_TYPE_AR: Record<ExamDocType, string> = { BAC: 'بكالوريا', BEM: 'شهادة التعليم المتوسط', TEST: 'اختبار', HOMEWORK: 'فرض', EXERCISE_SET: 'سلسلة تمارين', OTHER: 'أخرى' }
export const ORIGIN_AR: Record<string, string> = { ORIGINAL: 'من تأليف الأستاذ', SOURCED: 'من وثيقة أصلية', AI_GENERATED: 'مولَّد بالذكاء الاصطناعي', ADAPTED: 'معدَّل عن أصل' }
