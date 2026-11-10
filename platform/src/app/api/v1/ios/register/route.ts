import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { sha256 } from '@/server/lib/codes'
import { checkRegisterLimits } from '@/server/lib/rate-limit'
import { registerStudent } from '@/server/services/auth.service'
import { iosNoStore } from '@/server/services/ios-session.service'
import { listLevels, listStreams, listWilayas } from '@/server/services/reference.service'
import { iosApiError, iosApiGet } from '../_respond'
import { clientIp } from '@/server/lib/client-ip'

export const dynamic = 'force-dynamic'

/** خيارات نموذج التسجيل في التطبيق: الولايات والمستويات والشعب (نفس قوائم /register) */
export function GET(req: NextRequest) {
  return iosApiGet(req, async (db) => {
    const [wilayas, levels, streams] = await Promise.all([listWilayas(db), listLevels(db), listStreams(db)])
    return {
      wilayas: wilayas.map((w) => ({ id: w.id, name: `${w.code} — ${w.nameAr}` })),
      levels: levels.map((l) => ({ id: l.id, name: l.nameAr, secondary: /AS$/i.test(l.code) })),
      streams: streams.map((s) => ({ id: s.id, name: s.nameAr }))
    }
  })
}

const DZ_MOBILE = /^0[5-7]\d{8}$/
const dzPhone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[\s\-().]/g, '').replace(/^\+?213/, '0'))
  .refine((v) => DZ_MOBILE.test(v))

/** نفس قواعد التسجيل في الموقع (auth.actions: registerSchema)، دون كود الدعوة (يخصّ الرصيد والشراء، ولا شيء منهما في التطبيق) */
const schema = z.object({
  fullName: z.string().trim().min(3).max(120),
  email: z.string().trim().email().max(200),
  phone: dzPhone,
  guardianPhone: dzPhone,
  password: z.string().min(8).max(200),
  wilayaId: z.string().uuid(),
  levelId: z.string().uuid(),
  streamId: z.string().uuid().optional().or(z.literal('')).or(z.null())
})

const FIELD_MESSAGES: Record<string, string> = {
  fullName: 'أدخل الاسم الكامل',
  email: 'أدخل بريدًا صحيحًا',
  phone: 'أدخل رقم هاتفك (05 / 06 / 07 — 10 أرقام)',
  guardianPhone: 'أدخل رقم هاتف الولي (05 / 06 / 07 — 10 أرقام)',
  password: 'كلمة السر 8 أحرف على الأقل',
  wilayaId: 'اختر الولاية',
  levelId: 'اختر المستوى',
  streamId: 'اختر الشعبة'
}

function fieldError(field: string) {
  return iosNoStore(NextResponse.json({ ok: false, error: { code: 'VALIDATION', message: FIELD_MESSAGES[field] ?? 'تحقّق من البيانات', field } }, { status: 422 }))
}

/**
 * POST /api/v1/ios/register — إنشاء حساب تلميذ من داخل التطبيق (3 نوفمبر 2026)، ثم يرجع رمز الجلسة كالدخول.
 * يشترط ترويسة X-Madrasadz-Client: ios. بعده يطلب التطبيق تأكيد الهاتف (رمز SMS) كما في الموقع.
 */
export async function POST(req: NextRequest) {
  try {
    if (req.headers.get('x-madrasadz-client') !== 'ios') throw new AppError('FORBIDDEN')
    const parsed = schema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return fieldError(String(parsed.error.issues[0]?.path[0] ?? ''))
    const d = parsed.data
    const db = await getDb()
    const ip = clientIp(req.headers)
    await checkRegisterLimits(db, { ip, phoneKey: sha256(d.phone) })
    try {
      const r = await registerStudent(
        db,
        { email: d.email, password: d.password, fullName: d.fullName, phone: d.phone, guardianPhone: d.guardianPhone, wilayaId: d.wilayaId, levelId: d.levelId, streamId: d.streamId || null },
        { userAgent: req.headers.get('user-agent'), ip }
      )
      return iosNoStore(NextResponse.json({ ok: true, data: { token: r.session.token, expiresAt: r.session.expiresAt.toISOString(), role: 'STUDENT' } }))
    } catch (err) {
      if (err instanceof AppError && err.code === 'VALIDATION' && typeof err.details?.field === 'string') return fieldError(err.details.field)
      throw err
    }
  } catch (err) {
    return iosNoStore(iosApiError(err))
  }
}
