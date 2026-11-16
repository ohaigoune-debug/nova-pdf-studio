/**
 * واجهات الإضافات الأصلية (Swift) المسجّلة في NovaBridgeViewController.
 * على iOS تعمل الشيفرة الأصلية؛ في المتصفح (التطوير واللقطات) تُستعمل بدائل ويب صريحة ومحدودة.
 */
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import type { OcrLine } from '@shared/ocr'

export const isNative = (): boolean => Capacitor.isNativePlatform()
export const platformName = (): string => Capacitor.getPlatform()

// ------------------------------------------------------------------ StoreKit 2
export interface StoreProduct {
  id: string
  displayName: string
  description: string
  displayPrice: string
  price: number
  currencyCode: string
  type: string
}

export interface StoreEntitlement {
  productId: string
  transactionId: string
  originalTransactionId: string
  purchaseDate: string | null
  revocationDate: string | null
  ownershipType: 'purchased' | 'familyShared'
  environment?: string
}

export interface EntitlementsPayload {
  isPro: boolean
  entitlements: StoreEntitlement[]
  checkedAt: string | null
  syncError?: string
  reason?: string
}

export type PurchaseStatus = 'purchased' | 'pending' | 'cancelled' | 'unverified' | 'unknown'

export interface NovaStorePlugin {
  canMakePayments(): Promise<{ canMakePayments: boolean }>
  getProducts(options: { productIds: string[] }): Promise<{ products: StoreProduct[] }>
  purchase(options: { productId: string }): Promise<{ status: PurchaseStatus; isPro: boolean; message?: string; transaction?: StoreEntitlement }>
  restore(): Promise<EntitlementsPayload>
  getEntitlements(): Promise<EntitlementsPayload>
  requestRefund(): Promise<{ status: 'submitted' | 'cancelled' }>
  addListener(event: 'entitlementsChanged', cb: (data: EntitlementsPayload) => void): Promise<PluginListenerHandle>
  addListener(event: 'storeWarning', cb: (data: { message: string }) => void): Promise<PluginListenerHandle>
}

// ------------------------------------------------------------------ VisionKit scanner
export interface ScannedPage {
  path: string
  webPath?: string
  width: number
  height: number
}
export interface NovaScannerPlugin {
  isSupported(): Promise<{ supported: boolean }>
  scan(options?: { quality?: number }): Promise<{ pages: ScannedPage[]; cancelled: boolean; title?: string }>
}

// ------------------------------------------------------------------ Vision OCR
export interface NativeOcrResult {
  engine: 'vision'
  text: string
  confidence: number
  lines: OcrLine[]
  widthPx: number
  heightPx: number
  durationMs: number
  languages: string[]
  unsupportedLanguages: string[]
}
export interface NovaOcrPlugin {
  supportedLanguages(): Promise<{ languages: string[]; revision: number }>
  recognize(options: { path?: string; base64?: string; languages: string[] }): Promise<NativeOcrResult>
}

// ------------------------------------------------------------------ Files / print / HTML→PDF
export interface NativeFile {
  path: string
  webPath?: string
  name: string
  size: number
  mimeType: string
  pages?: number
}
export interface NovaDocumentsPlugin {
  pickFiles(options: { types: ('pdf' | 'image' | 'spreadsheet' | 'backup')[]; multiple?: boolean }): Promise<{ files: NativeFile[]; cancelled: boolean }>
  exportFile(options: { path: string }): Promise<{ saved: boolean }>
  importUrl(options: { url: string }): Promise<NativeFile>
  printPdf(options: { path: string; jobName?: string }): Promise<{ completed: boolean }>
  htmlToPdf(options: { html: string; fileName: string; widthPt: number; heightPt: number; marginPt?: number }): Promise<NativeFile>
}

export const NovaStore = registerPlugin<NovaStorePlugin>('NovaStore', {
  web: () => import('./web/store').then((m) => new m.WebStore())
})
export const NovaScanner = registerPlugin<NovaScannerPlugin>('NovaScanner', {
  web: () => import('./web/scanner').then((m) => new m.WebScanner())
})
export const NovaOcr = registerPlugin<NovaOcrPlugin>('NovaOcr', {
  web: () => import('./web/ocr').then((m) => new m.WebOcr())
})
export const NovaDocuments = registerPlugin<NovaDocumentsPlugin>('NovaDocuments', {
  web: () => import('./web/documents').then((m) => new m.WebDocuments())
})

/** يقرأ ملفًا محليًا أعادته إضافة أصلية (مسار في صندوق التطبيق) كبايتات. */
export async function readNativeFile(file: { path: string; webPath?: string }): Promise<Uint8Array> {
  const url = file.webPath ?? (isNative() ? Capacitor.convertFileSrc(file.path) : file.path)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`cannot read ${file.path}: ${res.status}`)
  return new Uint8Array(await res.arrayBuffer())
}
