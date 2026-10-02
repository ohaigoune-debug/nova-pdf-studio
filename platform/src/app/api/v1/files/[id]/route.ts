import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { verifyFileSignature } from '@/server/lib/storage'
import { readFileForDownload } from '@/server/services/files.service'
import { jsonError } from '../../_lib'

export const dynamic = 'force-dynamic'

/** GET /api/v1/files/:id?exp=&sig= — تنزيل ملف خاص عبر رابط موقّع قصير العمر فقط */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const url = new URL(req.url)
    if (!verifyFileSignature(id, url.searchParams.get('exp'), url.searchParams.get('sig'))) throw new AppError('FILE_NOT_FOUND')
    const { file, bytes } = await readFileForDownload(await getDb(), id)
    const inline = file.mimeType.startsWith('image/') || file.mimeType === 'application/pdf' || file.mimeType.startsWith('text/plain')
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': file.mimeType,
        'Content-Length': String(bytes.length),
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        // المعاينة داخل الموقع (iframe نفس الأصل) لملفات العرض: frame-ancestors يغلب X-Frame-Options العام (DENY)
        ...(inline ? { 'Content-Security-Policy': "frame-ancestors 'self'", 'X-Frame-Options': 'SAMEORIGIN' } : {})
      }
    })
  } catch (err) {
    return jsonError(err)
  }
}
