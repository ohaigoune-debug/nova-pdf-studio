import type { NextRequest } from 'next/server'
import { AppError } from '@/server/lib/errors'
import { offlineExamPackage } from '@/server/services/play-exams.service'
import { iosApiGet } from '../../../_respond'

export const dynamic = 'force-dynamic'

/** GET /api/v1/ios/play/sets/:id — حزمة الموضوع كاملة للتخزين والتصحيح دون إنترنت */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return iosApiGet(req, async (db, actor) => {
    if (!actor) throw new AppError('AUTH_REQUIRED')
    return offlineExamPackage(db, actor, id)
  })
}
