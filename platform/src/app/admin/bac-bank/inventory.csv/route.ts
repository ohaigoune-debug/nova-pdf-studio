import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { bacInventory, inventoryCsv } from '@/server/services/bac-bank.service'

export const dynamic = 'force-dynamic'

/** GET /admin/bac-bank/inventory.csv — تقرير الجرد الداخلي (سنة، شعبة، مادة، موضوع، PDF، حلّ، تحليل، تصنيف، معالجة) */
export async function GET() {
  const actor = await requireRole('SUPER_ADMIN')
  const csv = inventoryCsv(await bacInventory(await getDb(), actor))
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('bac-inventory.csv')}`, 'Cache-Control': 'private, no-store' } })
}
