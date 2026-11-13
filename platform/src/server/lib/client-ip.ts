import { isIP } from 'node:net'
import { isCloudflareIp } from './cloudflare-ips'

/**
 * عنوان الزائر الحقيقي من ترويسات الوكيل — مصدر واحد لكل حدود المحاولات والسجلات.
 *
 * الترتيب:
 *   1) X-Real-IP: يكتبه Caddy نفسه (`header_up X-Real-IP {remote_host}` في deploy/madrasadz.caddy) فيمحو
 *      أي قيمة أرسلها الزائر. فهو عنوان من اتصل بخادمنا مباشرة.
 *      ↳ إن كان من عناوين Cloudflare (السحابة البرتقالية) فالتلميذ خلفه، وعنوانه في CF-Connecting-IP:
 *        Cloudflare يكتب هذه الترويسة بنفسه ويمحو ما أرسله الزائر، فنثق بها هنا فقط.
 *        ومن يتصل بخادمنا مباشرة ويزوّرها لا يُصدَّق، لأن عنوانه ليس من عناوين Cloudflare.
 *        هكذا تعمل الوساطة دون أن يتقاسم كل التلاميذ حدود المحاولات نفسها، ودون لمس إعداد Caddy المشترك.
 *   2) أول X-Forwarded-For: للمنصات التي لا تكتب X-Real-IP.
 *
 * X-Forwarded-For وحده لا يكفي خلف Cloudflare: الزائر يستطيع إرسال قيمة مزوّرة فتبقى هي «الأولى» في السلسلة،
 * فيتجاوز الحدود أو يُحجب غيره بها.
 */
export function clientIp(headers: { get(name: string): string | null }): string | null {
  const real = headers.get('x-real-ip')?.trim()
  if (real && isIP(real)) {
    if (isCloudflareIp(real)) {
      const cf = headers.get('cf-connecting-ip')?.trim()
      if (cf && isIP(cf)) return cf
    }
    return real
  }
  const first = (headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim()
  return first || null
}

/** للفحص في لوحة الإدارة: هل وصل هذا الطلب عبر Cloudflare؟ ومن أي مركز (رمز المطار في آخر CF-Ray)؟ */
export function cloudflareHop(headers: { get(name: string): string | null }): { via: boolean; pop: string | null; leaked: boolean } {
  const real = headers.get('x-real-ip')?.trim() ?? ''
  const cf = headers.get('cf-connecting-ip')?.trim() ?? ''
  // Cloudflare مباشرة، أو Caddy حوّل العنوان بنفسه ({client_ip} مع trusted_proxies) فصار X-Real-IP عنوان التلميذ
  const via = isIP(real) ? isCloudflareIp(real) || (real === cf && Boolean(headers.get('cf-ray'))) : false
  const pop = via ? (/-([A-Z]{3})$/.exec(headers.get('cf-ray')?.trim() ?? '')?.[1] ?? null) : null
  // عبر Cloudflare لكن العنوان المحسوب بقي عنوان Cloudflare: الإعداد ناقص، وكل التلاميذ سيتقاسمون حدودًا واحدة
  const ip = clientIp(headers)
  return { via, pop, leaked: via && (!ip || isCloudflareIp(ip)) }
}
