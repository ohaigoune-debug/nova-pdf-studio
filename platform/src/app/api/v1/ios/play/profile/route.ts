import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { resolveActor, SESSION_COOKIE } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { setPlayProfile } from '@/server/services/play.service'
import { iosNoStore } from '@/server/services/ios-session.service'
import { iosApiError } from '../../_respond'

export const dynamic = 'force-dynamic'

const schema = z.object({ gradeCode: z.string().min(2).max(8), streamCode: z.string().min(2).max(12).nullable() })

/** POST /api/v1/ios/play/profile — اختيار السنة والشعبة في PLAY من التطبيق (نفس setPlayProfile في الموقع) */
export async function POST(req: NextRequest) {
  try {
    if (req.headers.get('x-madrasadz-client') !== 'ios') throw new AppError('FORBIDDEN')
    const db = await getDb()
    const actor = await resolveActor(db, req.cookies.get(SESSION_COOKIE)?.value)
    if (!actor) throw new AppError('AUTH_REQUIRED')
    const parsed = schema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) throw new AppError('VALIDATION')
    const data = await setPlayProfile(db, actor, parsed.data)
    const res = NextResponse.json({ ok: true, data })
    res.headers.set('X-Madrasadz-Account', actor.userId)
    return iosNoStore(res)
  } catch (err) {
    return iosNoStore(iosApiError(err))
  }
}
