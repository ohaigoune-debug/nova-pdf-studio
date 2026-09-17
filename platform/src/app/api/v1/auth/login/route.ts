import { z } from 'zod'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { login } from '@/server/services/auth.service'
import { jsonError, jsonOk } from '../../_lib'

export const dynamic = 'force-dynamic'

const schema = z.object({ email: z.string().email(), password: z.string().min(1), deviceName: z.string().optional() })

/** POST /api/v1/auth/login — يرجع Bearer token لتطبيقات الجوال */
export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) throw new AppError('VALIDATION')
    const r = await login(
      await getDb(),
      { email: parsed.data.email, password: parsed.data.password },
      { userAgent: req.headers.get('user-agent'), ip: req.headers.get('x-forwarded-for') }
    )
    return jsonOk({ token: r.session.token, expiresAt: r.session.expiresAt.toISOString(), role: r.role })
  } catch (err) {
    return jsonError(err)
  }
}
