import { isIP } from 'node:net'

/**
 * عنوان الزائر الحقيقي من ترويسات الوكيل — مصدر واحد لكل حدود المحاولات والسجلات.
 *
 * الترتيب:
 *   1) X-Real-IP: يكتبه Caddy نفسه (`header_up X-Real-IP …` في Caddyfile و deploy/madrasadz.caddy) فيمحو
 *      أي قيمة أرسلها الزائر. مع وساطة Cloudflare يُضبط على {client_ip} فيحمل عنوان التلميذ لا عنوان Cloudflare.
 *   2) أول X-Forwarded-For: للمنصات التي لا تكتب X-Real-IP.
 *
 * X-Forwarded-For وحده لا يكفي خلف Cloudflare: الزائر يستطيع إرسال قيمة مزوّرة فتبقى هي «الأولى» في السلسلة،
 * فيتجاوز الحدود أو يُحجب غيره بها.
 */
export function clientIp(headers: { get(name: string): string | null }): string | null {
  const real = headers.get('x-real-ip')?.trim()
  if (real && isIP(real)) return real
  const first = (headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim()
  return first || null
}
