/**
 * وجهة ما بعد الدخول (?next=): مسار داخلي فقط.
 * «//موقع» و«/\\موقع» يفهمهما المتصفّح عنواناً خارجياً — فتحُ تحويلٍ لصفحة تصيّد باسم المنصة.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  return next && /^\/(?![/\\])/.test(next) ? next : null
}
