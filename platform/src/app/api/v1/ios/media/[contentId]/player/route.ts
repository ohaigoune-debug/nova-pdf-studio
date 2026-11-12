import type { NextRequest } from 'next/server'
import { BUNNY_EMBED_APP_TTL_SECONDS } from '@/lib/media-embed'
import { AppError } from '@/server/lib/errors'
import { bunnyEmbedForViewer } from '@/server/services/media.service'
import { iosApiGet } from '../../../_respond'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * GET /api/v1/ios/media/:contentId/player — رابط مشغّل Bunny الموقّع لفيديو الدرس في التطبيق الأصيل،
 * بعد التحقق من الأحقية نفسها التي في الموقع (resolveMediaAccess)، مع سطور العلامة المائية فوق الإطار.
 * ساعتان لا خمس دقائق: التطبيق المنشور يطلب الرابط مرة ولا يجدّده (BUNNY_EMBED_APP_TTL_SECONDS).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ contentId: string }> }) {
  const { contentId } = await params
  return iosApiGet(req, async (db, actor) => {
    if (!actor) throw new AppError('AUTH_REQUIRED')
    if (!UUID_RE.test(contentId)) throw new AppError('CONTENT_NOT_FOUND')
    const embed = await bunnyEmbedForViewer(db, actor, contentId, Date.now(), { ttlSeconds: BUNNY_EMBED_APP_TTL_SECONDS })
    return { provider: 'bunny' as const, url: embed.url, expires: embed.expires, watermark: embed.watermark, contentId: embed.contentId, title: embed.title }
  })
}
