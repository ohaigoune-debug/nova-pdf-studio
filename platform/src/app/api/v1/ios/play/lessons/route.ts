import type { NextRequest } from 'next/server'
import { AppError } from '@/server/lib/errors'
import { lessonCards } from '@/server/services/play-cards.service'
import { iosApiGet } from '../../_respond'

export const dynamic = 'force-dynamic'

/** GET /api/v1/ios/play/lessons?subject=AR — دروس المادة بوحداتها وتقدّم التلميذ (لعبة البطاقات) */
export function GET(req: NextRequest) {
  return iosApiGet(req, async (db, actor) => {
    if (!actor) throw new AppError('AUTH_REQUIRED')
    const subject = (req.nextUrl.searchParams.get('subject') ?? '').trim().toUpperCase()
    if (!/^[A-Z0-9_]{2,12}$/.test(subject)) throw new AppError('VALIDATION', { field: 'subject' })
    return lessonCards(db, actor, subject)
  })
}
