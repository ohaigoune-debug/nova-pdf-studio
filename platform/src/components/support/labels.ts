import type { SupportKind, SupportStatus } from '@/server/db/schema/enums'

export const KIND_AR: Record<SupportKind, string> = { ORDER: 'طلب شراء', DELIVERY: 'التوصيل', ACCESS: 'الوصول إلى دورة', CONTENT: 'المحتوى', TEACHER: 'شكوى عن أستاذ', TECHNICAL: 'مشكلة تقنية', OTHER: 'أخرى' }
export const STATUS_AR: Record<SupportStatus, string> = { OPEN: 'مفتوحة', IN_PROGRESS: 'قيد المعالجة', WAITING_USER: 'بانتظار ردّك', RESOLVED: 'حُلّت', CLOSED: 'مغلقة' }
export const STATUS_VARIANT: Record<SupportStatus, 'secondary' | 'success' | 'warning' | 'muted' | 'default'> = { OPEN: 'warning', IN_PROGRESS: 'default', WAITING_USER: 'secondary', RESOLVED: 'success', CLOSED: 'muted' }
