/**
 * بديل وحدات Node (fs/path/crypto) داخل التطبيق. بعض مستودعات نسخة Windows تستوردها لوظائف ملفات خاصة بالحاسوب
 * (تصدير إلى مسار، شعار من القرص...) لا يستدعيها تطبيق iOS؛ أي استدعاء غير متوقع يرمي خطأً واضحًا بدل سلوك صامت.
 */
const fail = (name: string) => () => {
  throw new Error(`Node API "${name}" is not available in NOVA Docs for iOS`)
}
const handler: ProxyHandler<Record<string, unknown>> = {
  get: (_t, prop) => (prop === '__esModule' ? false : prop === 'sep' ? '/' : fail(String(prop)))
}
const shim = new Proxy({}, handler)
export default shim
export const existsSync = () => false
export const join = (...parts: string[]) => parts.join('/')
export const extname = (p: string) => (p.includes('.') ? p.slice(p.lastIndexOf('.')) : '')
export const basename = (p: string) => p.split('/').pop() ?? p
export const dirname = (p: string) => p.split('/').slice(0, -1).join('/')
export const randomBytes = fail('randomBytes')
export const scryptSync = fail('scryptSync')
export const timingSafeEqual = fail('timingSafeEqual')
