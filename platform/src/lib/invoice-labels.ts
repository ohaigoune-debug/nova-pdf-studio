/** تسميات الفاتورة (تُستعمل في الخادم والواجهة) */
export const PAYMENT_METHOD_AR: Record<string, string> = {
  COD: 'نقدًا عند الاستلام',
  TRANSFER: 'تحويل',
  FREE: 'مجاني',
  ONLINE: 'بطاقة بنكية (CIB / الذهبية)',
  CASH: 'نقدًا',
  POS: 'نقطة بيع',
  OTHER: 'أخرى'
}

/** طرق الدفع المعروضة في نموذج الفاتورة اليدوية */
export const MANUAL_PAYMENT_METHODS = ['CASH', 'COD', 'ONLINE', 'TRANSFER', 'POS', 'OTHER'] as const
