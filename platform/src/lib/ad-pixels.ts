/**
 * بكسلات الإعلانات الممولة (قرار المالك 17 نوفمبر 2026: حملات على مواقع التواصل وتيك توك).
 * معطّلة ما دام المعرّف فارغًا. تعمل على صفحات الهبوط (/go) وعلى صفحة الطلب بعد إرساله فقط،
 * ولا تُرسل أي بيان شخصي (لا هاتف ولا اسم ولا بريد): الصفحة، والمبلغ، ورقم الطلب لمنع التكرار.
 * المعرّفات تُفحص بتعبير صارم قبل إدراجها في السكربت، والقيم تمرّ عبر JSON.stringify.
 */

export interface AdPixelIds {
  meta: string
  tiktok: string
}

export type AdEvent =
  | { name: 'ViewContent'; contentName: string }
  | { name: 'Purchase'; valueDzd: number; orderNumber: string }

const META_RE = /^\d{15,16}$/
const TIKTOK_RE = /^[A-Z0-9]{16,24}$/

export function cleanMetaPixel(raw: string | null | undefined): string | null {
  const v = (raw ?? '').replace(/\s/g, '')
  return META_RE.test(v) ? v : null
}

export function cleanTiktokPixel(raw: string | null | undefined): string | null {
  const v = (raw ?? '').replace(/\s/g, '').toUpperCase()
  return TIKTOK_RE.test(v) ? v : null
}

export function pixelsEnabled(ids: AdPixelIds | null | undefined): boolean {
  return Boolean(ids && (cleanMetaPixel(ids.meta) || cleanTiktokPixel(ids.tiktok)))
}

const META_BOOT =
  "!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');"

const TIKTOK_BOOT =
  '!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=d.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=d.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)}}(window,document,"ttq");'

const j = (v: unknown) => JSON.stringify(v)

/**
 * سكربت واحد: يُحمّل البكسلات المضبوطة، ويسجّل زيارة الصفحة والأحداث،
 * ويعدّ «بدء الطلب» عند الضغط على أي عنصر يحمل data-ad-cta. يعيد null حين لا بكسل.
 */
export function pixelScript(ids: AdPixelIds, events: AdEvent[]): string | null {
  const meta = cleanMetaPixel(ids.meta)
  const tiktok = cleanTiktokPixel(ids.tiktok)
  if (!meta && !tiktok) return null
  const out: string[] = []
  if (meta) out.push(META_BOOT, `fbq('init',${j(meta)});fbq('track','PageView');`)
  if (tiktok) out.push(TIKTOK_BOOT, `ttq.load(${j(tiktok)});ttq.page();`)
  for (const e of events) {
    if (e.name === 'ViewContent') {
      if (meta) out.push(`fbq('track','ViewContent',${j({ content_name: e.contentName })});`)
      if (tiktok) out.push(`ttq.track('ViewContent',${j({ content_id: e.contentName, content_type: 'product' })});`)
    } else {
      const value = Math.max(0, Math.round(e.valueDzd))
      if (meta) out.push(`fbq('track','Purchase',${j({ value, currency: 'DZD' })},${j({ eventID: e.orderNumber })});`)
      if (tiktok) out.push(`ttq.track('PlaceAnOrder',${j({ value, currency: 'DZD', content_type: 'product' })},${j({ event_id: e.orderNumber })});`)
    }
  }
  const cta: string[] = []
  if (meta) cta.push("window.fbq&&fbq('track','InitiateCheckout');")
  if (tiktok) cta.push("window.ttq&&ttq.track('InitiateCheckout');")
  out.push(`document.addEventListener('click',function(ev){var el=ev.target&&ev.target.closest&&ev.target.closest('[data-ad-cta]');if(!el)return;${cta.join('')}},true);`)
  return out.join('\n')
}

/** أصول البكسلات في سياسة أمن المحتوى — تُضاف لصفحات الهبوط وصفحتَي ما بعد الطلب فقط */
export const PIXEL_CONNECT_ORIGINS = ['https://connect.facebook.net', 'https://www.facebook.com', 'https://analytics.tiktok.com', 'https://analytics-ipv6.tiktokw.us']
export const PIXEL_IMG_ORIGINS = ['https://www.facebook.com', 'https://analytics.tiktok.com']

export function isPixelPath(pathname: string): boolean {
  return pathname.startsWith('/go/') || pathname === '/student/courses/orders' || pathname === '/student/payments/return'
}
