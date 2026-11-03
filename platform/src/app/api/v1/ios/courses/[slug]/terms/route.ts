import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { resolveActor, SESSION_COOKIE } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { acceptTerms, courseHome } from '@/server/services/courses.service'
import { iosNoStore } from '@/server/services/ios-session.service'
import { iosApiError } from '../../../_respond'

export const dynamic = 'force-dynamic'

const schema = z.object({ version: z.number().int().min(0) })

function safeDecode(value: string): string {
  try { return decodeURIComponent(value) } catch { return value }
}

/**
 * POST /api/v1/ios/courses/:slug/terms — قبول شروط الدورة من التطبيق (نفس acceptTerms في الموقع).
 * يُرسل التطبيق نسخة الشروط التي عرضها؛ إن تغيّرت الشروط بعد عرضها يُرفض القبول ويُعاد عرض الجديدة.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    if (req.headers.get('x-madrasadz-client') !== 'ios') throw new AppError('FORBIDDEN')
    const { slug } = await params
    const db = await getDb()
    const actor = await resolveActor(db, req.cookies.get(SESSION_COOKIE)?.value)
    if (!actor) throw new AppError('AUTH_REQUIRED')
    const parsed = schema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) throw new AppError('VALIDATION')
    const home = await courseHome(db, actor, safeDecode(slug))
    if (home.needsTerms) {
      if (home.course.termsVersion !== parsed.data.version) throw new AppError('VALIDATION', { field: 'version' })
      await acceptTerms(db, actor, home.course.id)
    }
    const res = NextResponse.json({ ok: true, data: { accepted: true } })
    res.headers.set('X-Madrasadz-Account', actor.userId)
    return iosNoStore(res)
  } catch (err) {
    return iosNoStore(iosApiError(err))
  }
}
