/**
 * تقسيم الميزات بين NOVA Free و NOVA Pro (شراء لمرة واحدة عبر Apple).
 * مصدر واحد للحقيقة تستعمله كل الشاشات؛ الشراء نفسه وحالة الاستحقاق تأتي من StoreKit فقط.
 */
export const PRO_PRODUCT_ID = 'nova.docs.pro.lifetime'

export type Feature =
  // NOVA Free
  | 'view' | 'search' | 'share' | 'print' | 'signature' | 'merge' | 'rotate' | 'imagesToPdf' | 'scan' | 'files'
  // NOVA Pro
  | 'editText' | 'editImage' | 'shapes' | 'highlight' | 'comments' | 'ink' | 'whiteout'
  | 'split' | 'extract' | 'deletePages' | 'reorder' | 'watermark' | 'pageNumbers' | 'compress' | 'toText'
  | 'ocr' | 'scanFilters' | 'invoices' | 'spreadsheets' | 'backup'

export const FREE_FEATURES: ReadonlySet<Feature> = new Set<Feature>([
  'view', 'search', 'share', 'print', 'signature', 'merge', 'rotate', 'imagesToPdf', 'scan', 'files'
])

export const PRO_FEATURES: readonly Feature[] = [
  'editText', 'editImage', 'shapes', 'highlight', 'comments', 'ink', 'whiteout',
  'split', 'extract', 'deletePages', 'reorder', 'watermark', 'pageNumbers', 'compress', 'toText',
  'ocr', 'scanFilters', 'invoices', 'spreadsheets', 'backup'
]

export function isFeatureAllowed(feature: Feature, isPro: boolean): boolean {
  return isPro || FREE_FEATURES.has(feature)
}
