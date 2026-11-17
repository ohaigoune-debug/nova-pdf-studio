import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/server/db/client'
import { LANDING_COOKIE, LANDING_COOKIE_DAYS, landingBySlug, normalizeSource, recordLandingVisit } from '@/server/services/landing.service'

/**
 * زيارة صفحة هبوط (يرسلها المتصفح بعد فتح الصفحة، فلا تُعدّ زيارات الروبوتات التي لا تشغّل JavaScript).
 * - تُعدّ مرة واحدة لكل متصفح في اليوم لكل صفحة.
 * - تحفظ كعكة النسبة 30 يومًا: الطلب الذي يليه يُنسب إلى الصفحة والمصدر.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { slug?: unknown; src?: unknown } | null
  const slug = typeof body?.slug === 'string' ? body.slug : ''
  const db = await getDb()
  const landing = await landingBySlug(db, slug)
  if (!landing) return NextResponse.json({ ok: false }, { status: 404 })
  const source = normalizeSource(typeof body?.src === 'string' ? body.src : null)
  const day = new Date().toISOString().slice(0, 10)
  const seenKey = `mdz_lv_${landing.id.slice(0, 8)}`
  const res = NextResponse.json({ ok: true })
  const secure = process.env.NODE_ENV === 'production'
  if (req.cookies.get(seenKey)?.value !== `${day}:${source}`) {
    await recordLandingVisit(db, landing.id, source)
    res.cookies.set(seenKey, `${day}:${source}`, { maxAge: 86_400, sameSite: 'lax', secure, path: '/', httpOnly: true })
  }
  // مصدر محدّد يغلب «مباشر»: من فتح رابط إنستغرام ثم عاد مباشرة يبقى منسوبًا لإنستغرام
  const prev = req.cookies.get(LANDING_COOKIE)?.value ?? ''
  const keepPrev = source === 'direct' && prev.startsWith(`${landing.id}:`)
  if (!keepPrev) res.cookies.set(LANDING_COOKIE, `${landing.id}:${source}`, { maxAge: LANDING_COOKIE_DAYS * 86_400, sameSite: 'lax', secure, path: '/', httpOnly: true })
  return res
}
