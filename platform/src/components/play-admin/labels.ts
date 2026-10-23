/** تسميات عربية مشتركة بين صفحات إدارة MADRASADZ PLAY (خادم وعميل) */
import type { PlayDifficulty, PlayQuestionType, PlayReportReason, PlayReportStatus, PlayReviewStatus } from '@/server/play/constants'

export const STATUS_AR: Record<PlayReviewStatus, string> = {
  DRAFT: 'مسودة',
  AUTO_VALIDATED: 'مدقَّق آلياً',
  NEEDS_REVIEW: 'يحتاج مراجعة',
  APPROVED: 'معتمد',
  PUBLISHED: 'منشور',
  REJECTED: 'مرفوض'
}

export const STATUS_VARIANT: Record<PlayReviewStatus, 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'gold' | 'muted'> = {
  DRAFT: 'muted',
  AUTO_VALIDATED: 'secondary',
  NEEDS_REVIEW: 'warning',
  APPROVED: 'success',
  PUBLISHED: 'gold',
  REJECTED: 'destructive'
}

export const TYPE_AR: Record<PlayQuestionType, string> = {
  MCQ: 'اختيار من متعدد',
  FILL_BLANK: 'ملء الفراغات',
  MATCHING: 'مطابقة',
  ORDERING: 'ترتيب'
}

export const DIFFICULTY_AR: Record<PlayDifficulty, string> = { EASY: 'سهل', MEDIUM: 'متوسط', HARD: 'صعب' }

export const REASON_AR: Record<PlayReportReason, string> = {
  WRONG_ANSWER: 'الإجابة المعتمدة خاطئة',
  AMBIGUOUS: 'السؤال غامض أو له أكثر من إجابة',
  TYPO: 'خطأ إملائي أو مطبعي',
  OFF_LESSON: 'لا يخص الدرس',
  OTHER: 'سبب آخر'
}

export const REPORT_STATUS_AR: Record<PlayReportStatus, string> = { OPEN: 'مفتوحة', RESOLVED: 'مُعالَجة', DISMISSED: 'مرفوضة' }

export const SOURCE_AR: Record<string, string> = { AI_AUTHORED: 'مولَّد بالذكاء الاصطناعي', TEACHER: 'أستاذ', IMPORT: 'استيراد', LEGACY_QCM: 'بنك QCM القديم' }

export function statusAr(s: string): string {
  return (STATUS_AR as Record<string, string>)[s] ?? s
}
export function typeAr(s: string): string {
  return (TYPE_AR as Record<string, string>)[s] ?? s
}
export function difficultyAr(s: string): string {
  return (DIFFICULTY_AR as Record<string, string>)[s] ?? s
}
