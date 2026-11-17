import { CheckCircle2, ChevronDown, LogIn, ShoppingBag } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Logo } from '@/components/brand/logo'
import { priceLabel } from '@/components/academy/course-catalog-card'
import { AdPixels } from '@/components/landing/ad-pixels'
import { LandingBeacon } from '@/components/landing/landing-beacon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SHIPPING_INCLUDED_BADGES } from '@/lib/course-shipping'
import { getCurrentActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { onlinePaymentEnabled } from '@/server/lib/guiddini'
import { isAppError } from '@/server/lib/errors'
import { courseLanding } from '@/server/services/academy-catalog.service'
import { landingBySlug, videoEmbedUrl } from '@/server/services/landing.service'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ src?: string; preview?: string }> }

async function load(slug: string, wantPreview: boolean) {
  const db = await getDb()
  const actor = await getCurrentActor()
  const preview = wantPreview && actor?.role === 'SUPER_ADMIN'
  const landing = await landingBySlug(db, slug, { preview })
  if (!landing) return null
  try {
    const [{ course }, onlinePay] = await Promise.all([courseLanding(db, actor, landing.courseSlug), onlinePaymentEnabled(db)])
    return { landing, course, onlinePay, preview, loggedIn: Boolean(actor) }
  } catch (err) {
    if (isAppError(err) && err.code === 'COURSE_NOT_FOUND') return null
    throw err
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const db = await getDb()
  const landing = await landingBySlug(db, slug)
  if (!landing) return { title: 'مدرسة' }
  return { title: landing.headline, description: landing.subheadline ?? undefined, openGraph: { title: landing.headline, description: landing.subheadline ?? undefined, siteName: 'مدرسة' } }
}

/**
 * /go/<slug> — صفحة هبوط عامة لدورة (17 نوفمبر 2026): فيديو، ما يحصل عليه التلميذ، الأستاذ، العرضان، أسئلة، وزر ثابت.
 * السعر والعرضان والتوصيل من الدورة نفسها (لا تُكتب مرتين). الطلب في صفحة الطلب المعتادة (يسجّل الزائر أولًا).
 */
export default async function LandingPage({ params, searchParams }: Props) {
  const { slug } = await params
  const sp = await searchParams
  const data = await load(slug, sp.preview === '1')
  if (!data) notFound()
  const { landing, course: c, onlinePay, preview, loggedIn } = data
  const embed = videoEmbedUrl(landing.videoUrl)
  const active = c.enrollment === 'ACTIVE'
  // الزائر الجديد يسجّل أولًا (صفحة واحدة + رمز SMS)، ثم يجد «أكمل طلب دورتك» في صفحته — والمسجَّل يذهب للطلب مباشرة
  const go = (href: string) => (loggedIn ? href : '/register?from=go')
  const bookHref = go(`${c.href}/order`)
  const digital = onlinePay && c.digitalPriceDzd !== null
  const digitalHref = go(`${c.href}/digital`)
  const mainHref = active ? c.href : c.bookOffer ? bookHref : digital ? digitalHref : go(c.href)
  const mainPrice = c.bookOffer ? c.priceDzd : digital ? c.digitalPriceDzd! : c.priceDzd
  const freeShipping = c.bookOffer ? SHIPPING_INCLUDED_BADGES[c.shippingIncluded] : null
  const cta = active ? 'دخول الدورة' : 'اطلب الآن'

  return (
    <div className="min-h-dvh bg-background" dir="rtl">
      <LandingBeacon slug={landing.slug} src={sp.src ?? null} preview={preview} />
      <AdPixels off={preview} events={[{ name: 'ViewContent', contentName: landing.slug }]} />
      {preview ? <div className="bg-warning/15 px-4 py-2 text-center text-sm font-semibold text-warning">معاينة — {landing.active ? 'الصفحة مشغّلة' : 'الصفحة متوقفة ولا يراها الزوار'}</div> : null}

      <header className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <Logo />
        {loggedIn ? null : (
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">
              <LogIn className="size-4" aria-hidden /> دخول
            </Link>
          </Button>
        )}
      </header>

      <main className="mx-auto max-w-2xl space-y-10 px-4 pb-28">
        <section className="space-y-4 pt-2 text-center">
          <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{landing.headline}</h1>
          {landing.subheadline ? <p className="text-lg text-muted-foreground">{landing.subheadline}</p> : null}
          {embed ? (
            <div className="overflow-hidden rounded-xl border bg-muted">
              <iframe src={embed} title={landing.headline} className="aspect-video w-full" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
            </div>
          ) : c.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.coverUrl} alt={c.title} className="mx-auto max-h-80 rounded-xl border object-contain" />
          ) : null}
          <Button asChild size="lg" className="w-full text-lg sm:w-auto sm:px-12">
            <Link data-ad-cta href={mainHref}>
              <ShoppingBag className="size-5" aria-hidden /> {cta}
            </Link>
          </Button>
        </section>

        {landing.bullets.length ? (
          <section className="space-y-3">
            <h2 className="text-xl font-bold">ماذا تحصل عليه</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {landing.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2 rounded-lg border bg-card p-3">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                  <span className="font-semibold">{b}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {landing.about ? (
          <section className="space-y-2">
            <h2 className="text-xl font-bold">عن الأستاذ</h2>
            <p className="whitespace-pre-line leading-relaxed text-muted-foreground">{landing.about}</p>
          </section>
        ) : null}

        {!active ? (
          <section className="space-y-3">
            <h2 className="text-xl font-bold">اختر عرضك</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {c.bookOffer ? (
                <Link data-ad-cta href={bookHref} className="block rounded-xl border-2 border-primary bg-card p-4 transition-colors hover:bg-primary/5">
                  <span className="block font-bold">الدورة مع الكتب</span>
                  <span className="block text-2xl font-extrabold tabular-nums">{priceLabel(c.priceDzd)}</span>
                  {freeShipping ? <Badge variant="success" className="mt-1">{freeShipping}</Badge> : <span className="block text-xs text-muted-foreground">+ التوصيل حسب ولايتك</span>}
                  <span className="mt-2 block text-xs text-muted-foreground">الدفع عند الاستلام أو بالبطاقة</span>
                </Link>
              ) : null}
              {digital ? (
                <Link data-ad-cta href={digitalHref} className="block rounded-xl border bg-card p-4 transition-colors hover:bg-muted/60">
                  <span className="block font-bold">النسخة الرقمية</span>
                  <span className="block text-2xl font-extrabold tabular-nums">{priceLabel(c.digitalPriceDzd!)}</span>
                  <span className="mt-2 block text-xs text-muted-foreground">بالبطاقة (CIB أو الذهبية)، تُفتح فورًا، دون كتاب</span>
                </Link>
              ) : null}
            </div>
            {!loggedIn ? (
              <p className="text-center text-xs text-muted-foreground">
                أول مرة؟ سجّل برقم هاتفك ثم اطلب مباشرة. لديك حساب؟{' '}
                <Link href={`/login?next=${encodeURIComponent(c.bookOffer ? `${c.href}/order` : c.href)}`} className="font-semibold text-primary underline underline-offset-4">
                  ادخل
                </Link>
              </p>
            ) : null}
          </section>
        ) : null}

        {landing.faq.length ? (
          <section className="space-y-2">
            <h2 className="text-xl font-bold">أسئلة شائعة</h2>
            <div className="divide-y rounded-xl border bg-card">
              {landing.faq.map((f) => (
                <details key={f.q} className="group p-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold">
                    {f.q}
                    <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <p className="mt-2 whitespace-pre-line leading-relaxed text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        ) : null}
      </main>

      <div className="sticky bottom-0 z-10 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0 leading-tight">
            <span className="block truncate text-xs text-muted-foreground">{c.title}</span>
            {active ? <span className="block font-bold text-success">أنت مشترك</span> : <span className="block text-lg font-extrabold tabular-nums">{priceLabel(mainPrice)}</span>}
          </div>
          <Button asChild size="lg">
            <Link data-ad-cta href={mainHref}>{cta}</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
