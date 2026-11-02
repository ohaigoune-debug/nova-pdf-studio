import { NextResponse, type NextRequest } from 'next/server'
import { REF_COOKIE, REF_COOKIE_DAYS } from '@/lib/referral'
import { safeNextPath } from '@/server/lib/safe-next'
import { normalizePromoCode } from '@/server/services/referrals.service'

/**
 * رابط الدعوة: madrasadz.com/r/CODE (أو ?to=/مسار للصفحة المقصودة).
 * يحفظ الكود 30 يومًا في كعكة فيُملأ تلقائيًّا عند التسجيل، ثم يحوّل إلى التسجيل أو الصفحة المطلوبة.
 * لا يكتب شيئًا في القاعدة: النسبة تُثبَّت عند إنشاء الحساب فقط.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code: raw } = await ctx.params
  const code = normalizePromoCode(decodeURIComponent(raw))
  const to = safeNextPath(req.nextUrl.searchParams.get('to'))
  const target = new URL(to ?? (code ? `/register?ref=${code}` : '/register'), req.url)
  const res = NextResponse.redirect(target)
  if (code) res.cookies.set(REF_COOKIE, code, { maxAge: REF_COOKIE_DAYS * 86_400, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', httpOnly: true })
  return res
}
