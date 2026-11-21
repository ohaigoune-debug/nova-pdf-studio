import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { courseRosterCsv, parseRosterFilters } from '@/server/services/course-roster.service'

export const dynamic = 'force-dynamic'

/** GET /admin/students/roster.csv?course=…&status=…&source=…&month=…&q=… — تلاميذ دورة بالتصفية نفسها، يفتحه Excel */
export async function GET(req: Request) {
  const actor = await requireRole('SUPER_ADMIN')
  const sp = Object.fromEntries(new URL(req.url).searchParams) as Record<string, string | undefined>
  try {
    const { filename, csv } = await courseRosterCsv(await getDb(), actor, { courseId: sp.course ?? '', ...parseRosterFilters(sp) })
    return new Response(csv, {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`, 'Cache-Control': 'private, no-store' }
    })
  } catch (e) {
    if (isAppError(e)) return new Response('الدورة غير موجودة', { status: 404 })
    throw e
  }
}
