import { getCurrentActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { storage } from '@/server/lib/storage'
import { ANON_VIEWER, resolveMediaAccess, stampPdf, verifyMediaSignature } from '@/server/services/media.service'
import { jsonError } from '../../_lib'

export const dynamic = 'force-dynamic'

const MAX_CHUNK = 4 * 1024 * 1024

/**
 * GET /api/v1/media/:fileId?c=<contentId>&exp&sig
 * بثّ الوسائط الخاصة: التوقيع مرتبط بهوية المشاهد الحالية (من الجلسة) فلا يعمل الرابط لغيره.
 * - فيديو/صوت/صورة: Range (206) بمقاطع بلا تحميل الملف كله في الذاكرة.
 * - PDF بلا سماح تنزيل: نسخة مختومة باسم/بريد المشاهد على كل صفحة، عرض داخلي فقط.
 * - لا كاش أبداً (private, no-store) ولا Content-Disposition: attachment.
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
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`
    }

    if (file.mimeType === 'application/pdf' && !access.content.allowDownload) {
      const original = await storage().get(file.storageKey)
      const stamped = await stampPdf(original, access.watermark)
      return new Response(new Uint8Array(stamped), { headers: { ...baseHeaders, 'Content-Length': String(stamped.length) } })
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
