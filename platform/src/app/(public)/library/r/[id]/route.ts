import { getDb } from '@/server/db/client'
import { signFileUrl } from '@/server/lib/storage'
import { publicResourceFile } from '@/server/services/library.service'

export const dynamic = 'force-dynamic'

/**
 * GET /library/r/:id[?part=solution] — رابط ثابت لملف مورد عام (موضوع، فرض، تصحيح…).
 * الملف المخزَّن عندنا يُفتح عبر رابط موقّع قصير العمر يُولَّد عند كل نقرة (فلا تنتهي صلاحية الروابط في الصفحات)،
 * وما لم يُخزَّن يُحوَّل إلى ملفه أو صفحته عند المصدر.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const part = new URL(req.url).searchParams.get('part') === 'solution' ? 'solution' : 'file'
  try {
    const f = await publicResourceFile(await getDb(), id, part)
    // مسار نسبي: خلف الوكيل (Caddy) قد لا يعكس req.url النطاق الحقيقي
    const target = f.fileId ? signFileUrl(f.fileId, 1800) : f.url!
    return new Response(null, { status: 302, headers: { Location: target, 'Cache-Control': 'no-store' } })
  } catch {
    return new Response('الملف غير متاح', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } })
  }
}
