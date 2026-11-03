import type { NextRequest } from 'next/server'
import { AppError } from '@/server/lib/errors'
import { iosBacPaper } from '@/server/services/ios-bac.service'
import { iosApiGet } from '../../_respond'

export const dynamic = 'force-dynamic'

/** GET /api/v1/ios/bac/:id — موضوع بكالوريا: ملف الموضوع وملف الحلّ (رابط موقّع داخل التطبيق أو رابط المصدر) */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return iosApiGet(req, async (db, actor) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new AppError('NOT_FOUND')
    return iosBacPaper(db, actor, id)
  })
}
