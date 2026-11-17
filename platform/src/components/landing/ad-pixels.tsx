import { headers } from 'next/headers'
import { IOS_PRESENTATION_HEADER } from '@/lib/ios-presentation'
import { getDb } from '@/server/db/client'
import { pixelScript, type AdEvent } from '@/lib/ad-pixels'
import { adPixels } from '@/server/services/ad-pixels.service'

/**
 * بكسلات Meta و TikTok (معطّلة ما لم يُحفظ معرّف): سكربت واحد بـ nonce الطلب.
 * لا شيء في المعاينة ولا داخل تطبيقَي مدرسة.
 */
export async function AdPixels({ events, off }: { events: AdEvent[]; off?: boolean }) {
  if (off) return null
  const h = await headers()
  if (h.get('x-madrasa-app') === '1' || h.get(IOS_PRESENTATION_HEADER)) return null
  const script = pixelScript(await adPixels(await getDb()), events)
  if (!script) return null
  return <script nonce={h.get('x-nonce') ?? undefined} dangerouslySetInnerHTML={{ __html: script }} />
}
