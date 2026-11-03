import type { NextRequest } from 'next/server'
import { iosPaper } from '@/server/services/ios-tests.service'
import { iosApiGet } from '../../_respond'

export const dynamic = 'force-dynamic'

/** GET /api/v1/ios/papers/:id — موضوع فرض أو اختبار أو بكالوريا: الموضوع والحلّ والنسخة التفاعلية في PLAY */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return iosApiGet(req, async (db, actor) => iosPaper(db, actor, id))
}
