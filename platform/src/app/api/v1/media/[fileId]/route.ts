import { getCurrentActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { etagMatches, getOrCreateStamped, stampCacheKey } from '@/server/lib/pdf-stamp-cache'
import { storage } from '@/server/lib/storage'
import { ANON_VIEWER, PDF_STAMP_VERSION, pdfPrivateRevalidateEnabled, resolveMediaAccess, stampPdf, verifyMediaSignature } from '@/server/services/media.service'
import { jsonError } from '../../_lib'

export const dynamic = 'force-dynamic'

const MAX_CHUNK = 4 * 1024 * 1024

/**
 * GET /api/v1/media/:fileId?c=<contentId>&exp&sig
 * بثّ الوسائط الخاصة: التوقيع مرتبط بهوية المشاهد الحالية (من الجلسة) فلا يعمل الرابط لغيره.
 * - فيديو/صوت/صورة: Range (206) بمقاطع بلا تحميل الملف كله في الذاكرة.
 * - PDF بلا سماح تنزيل: نسخة مختومة باسم/بريد المشاهد على كل صفحة، عرض داخلي فقط.
 *   الختم يُحفظ في كاش على القرص بمفتاح (الملف ونسخته + المشاهد + نص الختم)، ولا يُسأل الكاش إلا بعد
 *   اكتمال التحقق من الصلاحية أدناه — الكاش لا يمنح وصولاً.
 * - لا كاش في المتصفح (private, no-store) ولا Content-Disposition: attachment.
 *   استثناء اختياري مُطفأ افتراضياً (PDF_PRIVATE_REVALIDATE=1): PDF المختوم بـ private, no-cache + ETag و304.
 */
export async function GET(req: Request, ctx: { params: Promise<{ fileId: string }> }) {
  try {
    const { fileId } = await ctx.params
    const url = new URL(req.url)
    const contentId = url.searchParams.get('c')
    const actor = await getCurrentActor()
    const viewerId = actor?.userId ?? ANON_VIEWER
    if (!verifyMediaSignature(fileId, contentId, viewerId, url.searchParams.get('exp'), url.searchParams.get('sig'))) throw new AppError('FILE_NOT_FOUND')
    const db = await getDb()
    const access = await resolveMediaAccess(db, actor, contentId!)
    const file = access.file
    if (!file || file.id !== fileId) throw new AppError('FILE_NOT_FOUND')
    if (file.status !== 'READY') throw new AppError('MEDIA_NOT_READY')

    const baseHeaders: Record<string, string> = {
      'Content-Type': file.mimeType,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      // عارض PDF داخل الدرس (iframe نفس الأصل): frame-ancestors يغلب X-Frame-Options العام (DENY)
      'Content-Security-Policy': "frame-ancestors 'self'",
      'X-Frame-Options': 'SAMEORIGIN'
    }

    if (file.mimeType === 'application/pdf' && !access.content.allowDownload) {
      // كل ما سبق (التوقيع، الجلسة، الصلاحية، حالة الملف) اكتمل؛ الآن فقط يُحسب المفتاح ويُسأل الكاش
      const s = storage()
      const key = stampCacheKey({
        fileId: file.id,
        storageKey: file.storageKey,
        checksum: file.checksum,
        sizeBytes: file.sizeBytes,
        updatedAt: file.updatedAt,
        storedSize: await s.size(file.storageKey),
        viewerId: access.viewerId,
        watermark: access.watermark,
        stampVersion: PDF_STAMP_VERSION
      })
      const headers = { ...baseHeaders }
      if (pdfPrivateRevalidateEnabled()) {
        const etag = `"${key}"`
        headers['Cache-Control'] = 'private, no-cache'
        headers.ETag = etag
        if (etagMatches(req.headers.get('if-none-match'), etag)) return new Response(null, { status: 304, headers })
      }
      const stamped = await getOrCreateStamped(key, async () => stampPdf(await s.get(file.storageKey), access.watermark))
      return new Response(stamped.body as BodyInit, { headers: { ...headers, 'Content-Length': String(stamped.size) } })
    }

    const range = req.headers.get('range')
    const s = storage()
    if (range) {
      const m = range.match(/bytes=(\d*)-(\d*)/)
      const size = (await s.size(file.storageKey)) ?? file.sizeBytes
      let start = m?.[1] ? Number(m[1]) : 0
      let end = m?.[2] ? Number(m[2]) : Math.min(start + MAX_CHUNK - 1, size - 1)
      if (m && !m[1] && m[2]) {
        start = Math.max(0, size - Number(m[2]))
        end = size - 1
      }
      if (!Number.isFinite(start) || start >= size) {
        return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}`, 'Cache-Control': 'private, no-store' } })
      }
      end = Math.min(end, start + MAX_CHUNK - 1, size - 1)
      const r = await s.getRange(file.storageKey, start, end)
      return new Response(r.stream, {
        status: 206,
        headers: { ...baseHeaders, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${r.start}-${r.end}/${r.size}`, 'Content-Length': String(r.end - r.start + 1) }
      })
    }
    const r = await s.getRange(file.storageKey, 0)
    return new Response(r.stream, { headers: { ...baseHeaders, 'Accept-Ranges': 'bytes', 'Content-Length': String(r.size) } })
  } catch (err) {
    return jsonError(err)
  }
}
