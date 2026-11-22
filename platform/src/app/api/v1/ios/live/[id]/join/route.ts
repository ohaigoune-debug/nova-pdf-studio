import { NextResponse, type NextRequest } from 'next/server'
import { resolveActor, SESSION_COOKIE } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import { AppError, assertUuid } from '@/server/lib/errors'
import { iosNoStore } from '@/server/services/ios-session.service'
import { joinLiveIos } from '@/server/services/live.service'
import { iosApiError } from '../../../_respond'

export const dynamic = 'force-dynamic'

/**
 * POST /api/v1/ios/live/:id/join — رابط الانضمام إلى الحصة المباشرة من التطبيق (21 نوفمبر 2026).
 * القواعد نفسها لزر «انضم» في الموقع (joinInfo): مشترك نشط، قبل الشروط، داخل النافذة (15 دقيقة قبل الموعد).
 * يفتح التطبيق appUrl (تطبيق Zoom باسم التلميذ ورمز الاجتماع) وإلا url (يوتيوب أو المتصفح)، ويُسجَّل الحضور.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (req.headers.get('x-madrasadz-client') !== 'ios') throw new AppError('FORBIDDEN')
    const { id } = await params
    assertUuid(id, 'LIVE_NOT_FOUND')
    const db = await getDb()
    const actor = await resolveActor(db, req.cookies.get(SESSION_COOKIE)?.value)
    if (!actor) throw new AppError('AUTH_REQUIRED')
    const info = await joinLiveIos(db, actor, id)
    const res = NextResponse.json({ ok: true, data: info })
    res.headers.set('X-Madrasadz-Account', actor.userId)
    return iosNoStore(res)
  } catch (err) {
    return iosNoStore(iosApiError(err))
  }
}
