/** تسميات بنك الأسئلة بالعربية — وحدة بلا 'use client' لتُستعمل في مكوّنات الخادم والعميل معاً */
export const TYPE_AR: Record<string, string> = { MCQ: 'اختيار متعدد', TRUE_FALSE: 'صح/خطأ', SHORT_ANSWER: 'إجابة قصيرة', LONG_ANSWER: 'إجابة مطوّلة', FILL_BLANK: 'ملء فراغات', MATCHING: 'مطابقة', IMAGE: 'صورة', OPEN: 'سؤال مفتوح' }
export const KIND_AR: Record<string, string> = { QUESTION: 'سؤال', EXERCISE: 'تمرين', PASSAGE: 'نصّ وأسئلة', PROBLEM: 'مسألة', INTEGRATIVE: 'وضعية إدماجية', DOCUMENT: 'وثيقة' }
export const DIFF_AR: Record<number, { label: string; variant: 'success' | 'default' | 'warning' | 'destructive' }> = {
  1: { label: 'سهل', variant: 'success' },
  2: { label: 'متوسط', variant: 'default' },
  3: { label: 'صعب', variant: 'warning' },
  4: { label: 'صعب جداً', variant: 'destructive' }
}
export const EXAM_KIND_AR: Record<string, string> = { BAC: 'بكالوريا', BEM: 'شهادة التعليم المتوسط', TEST: 'اختبار', HOMEWORK: 'فرض', QUIZ: 'اختبار إلكتروني', PRACTICE: 'تدريب', OTHER: 'أخرى' }
export const RIGHTS_AR: Record<string, string> = { OWN: 'من تأليفي', LICENSED: 'مرخَّص لي', PUBLIC_DOMAIN: 'ملك عام (امتحان رسمي)', THIRD_PARTY: 'لطرف آخر (بإذن/اقتباس)', UNKNOWN: 'غير معروف' }
