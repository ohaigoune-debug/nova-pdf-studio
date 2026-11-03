import type { NextRequest } from 'next/server'
import { AppError } from '@/server/lib/errors'
import { lessonPack } from '@/server/services/play-cards.service'
import { iosApiGet } from '../../../_respond'

export const dynamic = 'force-dynamic'

/** GET /api/v1/ios/play/lessons/:id — حزمة أسئلة الدرس كاملة للتخزين والتصحيح دون إنترنت */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return iosApiGet(req, async (db, actor) => {
    if (!actor) throw new AppError('AUTH_REQUIRED')
    return lessonPack(db, actor, id)
  })
}
