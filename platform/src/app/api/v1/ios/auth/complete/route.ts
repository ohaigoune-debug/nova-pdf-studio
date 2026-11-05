import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { RATE_LIMITS, checkRateLimit } from '@/server/lib/rate-limit'
import { completeOAuthSignup } from '@/server/services/oauth.service'
import { iosNoStore } from '@/server/services/ios-session.service'
import { iosApiError } from '../../_respond'
import { iosMeta, signedIn } from '../_shared'

export const dynamic = 'force-dynamic'

const DZ_MOBILE = /^0[5-7]\d{8}$/
const dzPhone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[\s\-().]/g, '').replace(/^\+?213/, '0'))
  .refine((v) => DZ_MOBILE.test(v))

/** نفس حقول /api/v1/ios/register دون البريد وكلمة السر (يأتيان من Google أو Apple) */
const schema = z.object({
  signupToken: z.string().min(20).max(200),
  fullName: z.string().trim().min(3).max(120),
  phone: dzPhone,
  guardianPhone: dzPhone,
  wilayaId: z.string().uuid(),
  levelId: z.string().uuid(),
  streamId: z.string().uuid().optional().or(z.literal('')).or(z.null())
})

const FIELD_MESSAGES: Record<string, string> = {
  fullName: 'أدخل الاسم الكامل',
  phone: 'أدخل رقم هاتفك (05 / 06 / 07 — 10 أرقام)',
  guardianPhone: 'أدخل رقم هاتف الولي (05 / 06 / 07 — 10 أرقام)',
  wilayaId: 'اختر الولاية',
  levelId: 'اختر المستوى',
  streamId: 'اختر الشعبة'
}

function fieldError(field: string) {
  return iosNoStore(NextResponse.json({ ok: false, error: { code: 'VALIDATION', message: FIELD_MESSAGES[field] ?? 'تحقّق من البيانات', field } }, { status: 422 }))
}

/**
 * POST /api/v1/ios/auth/complete — إكمال حساب بدأ بـ Google أو Apple، ثم يطلب التطبيق تأكيد الهاتف برمز
 * كما بعد /api/v1/ios/register.
 */
export async function POST(req: NextRequest) {
  try {
    if (req.headers.get('x-madrasadz-client') !== 'ios') throw new AppError('FORBIDDEN')
    const parsed = schema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return fieldError(String(parsed.error.issues[0]?.path[0] ?? ''))
    const d = parsed.data
    const db = await getDb()
    const meta = iosMeta(req)
    await checkRateLimit(db, { scope: 'register-ip', subject: meta.ip ?? 'unknown', ...RATE_LIMITS.registerIp })
    try {
      const r = await completeOAuthSignup(
        db,
        d.signupToken,
        { fullName: d.fullName, phone: d.phone, guardianPhone: d.guardianPhone, wilayaId: d.wilayaId, levelId: d.levelId, streamId: d.streamId || null },
        meta
      )
      return signedIn(r.session, 'STUDENT')
    } catch (err) {
      if (err instanceof AppError && err.code === 'VALIDATION' && typeof err.details?.field === 'string') return fieldError(err.details.field)
      throw err
    }
  } catch (err) {
    return iosNoStore(iosApiError(err))
  }
}
