import type { NextRequest } from 'next/server'
import { parseFilter, type RawQuery } from '@/components/play-admin/filter-params'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { exportQuestions } from '@/server/services/play-admin.service'

export const dynamic = 'force-dynamic'

/** GET /admin/play/questions/export?grade=…&status=… — تصدير الأسئلة المطابقة بصيغة ملف المحتوى (JSON) */
export async function GET(req: NextRequest) {
  const actor = await requireRole('SUPER_ADMIN')
  const raw: RawQuery = Object.fromEntries(req.nextUrl.searchParams.entries())
  const filter = parseFilter(raw)
  const rows = await exportQuestions(await getDb(), actor, filter)
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), filter, count: rows.length, questions: rows }, null, 2)
  const stamp = new Date().toISOString().slice(0, 10)
  return new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`play-questions-${stamp}.json`)}`,
      'Cache-Control': 'private, no-store'
    }
  })
}
