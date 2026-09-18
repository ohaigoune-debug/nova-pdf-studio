import { z } from 'zod'
import { getDb } from '@/server/db/client'
import { sha256 } from '@/server/lib/codes'
import { AppError } from '@/server/lib/errors'
import { RATE_LIMITS, checkRateLimit, resetRateLimit } from '@/server/lib/rate-limit'
import { login } from '@/server/services/auth.service'
import { jsonError, jsonOk } from '../../_lib'

export const dynamic = 'force-dynamic'

const schema = z.object({ email: z.string().email(), password: z.string().min(1), deviceName: z.string().optional() })

/** POST /api/v1/auth/login — يرجع Bearer token لتطبيقات الجوال */
export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) throw new AppError('VALIDATION')
    const db = await getDb()
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'unknown'
    const emailKey = sha256(parsed.data.email.trim().toLowerCase())
    await checkRateLimit(db, { scope: 'login-ip', subject: ip, ...RATE_LIMITS.loginIp })
    await checkRateLimit(db, { scope: 'login-email', subject: emailKey, ...RATE_LIMITS.loginEmail })
    const r = await login(db, { email: parsed.data.email, password: parsed.data.password }, { userAgent: req.headers.get('user-agent'), ip })
    await resetRateLimit(db, 'login-email', emailKey)
    return jsonOk({ token: r.session.token, expiresAt: r.session.expiresAt.toISOString(), role: r.role })
  } catch (err) {
    return jsonError(err)
  }
}
