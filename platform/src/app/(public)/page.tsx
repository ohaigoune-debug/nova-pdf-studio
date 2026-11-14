import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlgeriaMap } from '@/components/domain/algeria-map'
import { HomeHero } from '@/components/marketing/home-hero'
import { ContentGrid } from '@/components/domain/content-cards'
import { Button } from '@/components/ui/button'
import { getT } from '@/i18n/server'
import { homeFor } from '@/lib/role-home'
import { getCurrentActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { apkSizeMb, appDownload } from '@/server/lib/android-apk'
import { latestPublicContent } from '@/server/queries/content.queries'
import { publicStudentsPerWilaya } from '@/server/queries/map.queries'

export const dynamic = 'force-dynamic'

/** أرقام صغيرة في بداية المنصة تُضعف الواجهة: تظهر العدّادات من هذا الحدّ، وقبله جملة الخريطة */
const MAP_COUNTS_FROM = 50

export default async function HomePage() {
  const actor = await getCurrentActor()
  // قرار المالك (2026-10-28): الموظف والمشرف والأستاذ والمساعد يدخلون لوحتهم مباشرة، لا الصفحة التسويقية.
  if (actor && ['SUPER_ADMIN', 'CONFIRMER', 'CONTENT_UPLOADER', 'TEACHER', 'ASSISTANT'].includes(actor.role)) redirect(homeFor(actor.role))
  const student = actor?.role === 'STUDENT'
  const db = await getDb()
  const [latest, map, apk, { t, locale }] = await Promise.all([latestPublicContent(db), publicStudentsPerWilaya(db), appDownload(), getT()])
  const reached = map.filter((w) => w.students > 0).length
  const totalStudents = map.reduce((sum, w) => sum + w.students, 0)
  const steps = [
    { title: t('public.step1'), text: t('public.step1d') },
    { title: t('public.step2'), text: t('public.step2d') },
    { title: t('public.step3'), text: t('public.step3d') }
  ]

  return (
    <>
      {/* أعلى الصفحة (قرار المالك 14 نوفمبر 2026): صورة الأستاذ وأرقامه وتكريماته، ثم الأبواب الخمسة */}
      <HomeHero
        ctaHref={student ? '/student' : '/register'}
        ctaLabel={student ? t('nav.dashboard') : 'أنا طالب — ابدأ الآن'}
        loginLine={actor ? null : { prompt: t('auth.haveAccount'), label: t('nav.login') }}
        android={apk ? { title: t('public.androidApp'), detail: t('public.androidAppD', { size: apkSizeMb(apk.size) }) } : null}
      />

      {/* بيت شعر: اللغة العربية تتكلّم */}
      <section className="border-y bg-card">
        <div className="container py-14 text-center">
          {/* صدر وعجز: على الحاسوب متقابلان، وعلى الهاتف الواحد تحت الآخر */}
          <p className="flex flex-col items-center justify-center gap-x-12 gap-y-2 font-ruqaa text-3xl leading-[1.9] text-primary sm:text-4xl md:flex-row lg:text-5xl dark:text-accent" dir="rtl" lang="ar">
            {t('public.verse')
              .split('۞')
              .map((half) => (
                <span key={half}>{half.trim()}</span>
              ))}
          </p>
          <p className="mt-4 text-sm text-muted-foreground">{t('public.verseAuthor')}</p>
        </div>
      </section>

      {/* خريطة الجزائر: الطلاب عبر الولايات */}
      <section className="bg-ink relative overflow-hidden text-white">
        <div className="container grid items-center gap-10 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:py-20">
          <div className="space-y-5">
            <p className="inline-flex rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">{t('public.mapEyebrow')}</p>
            <h2 className="font-heading text-[32px] font-bold leading-snug sm:text-5xl">{t('public.mapTitle')}</h2>
            <p className="max-w-md text-lg leading-relaxed text-white/85">{t('public.mapBody')}</p>
            {totalStudents >= MAP_COUNTS_FROM ? (
              <dl className="flex gap-10 pt-2">
                <div>
                  <dt className="text-sm text-white/85">{t('public.mapWilayas')}</dt>
                  <dd className="font-heading text-5xl font-bold tabular">{reached}</dd>
                </div>
                <div>
                  <dt className="text-sm text-white/85">{t('public.mapStudents')}</dt>
                  <dd className="font-heading text-5xl font-bold tabular">{totalStudents}</dd>
                </div>
              </dl>
            ) : (
              <p className="font-heading text-2xl font-semibold">{t('public.mapEmpty')}</p>
            )}
          </div>
          <div className="mx-auto w-full max-w-xl">
            <AlgeriaMap data={map} />
          </div>
        </div>
      </section>

      {/* كيف تبدأ */}
      <section className="border-y bg-card/40">
        <div className="container py-16 lg:py-20">
          <div className="mb-10 text-center">
            <h2 className="font-heading text-[28px] font-bold sm:text-4xl">{t('public.howTitle')}</h2>
            <p className="mt-2 text-muted-foreground">{t('public.howSubtitle')}</p>
          </div>
          <ol className="relative grid gap-6 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="relative rounded-lg border border-border bg-card p-6 shadow-soft">
                <span className="flex size-10 items-center justify-center rounded-full bg-accent text-base font-bold text-accent-foreground tabular">{i + 1}</span>
                <p className="mt-4 font-heading text-lg font-semibold">{s.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
                <CheckCircle2 className="absolute end-5 top-6 size-5 text-success/60" aria-hidden />
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* أحدث الدروس */}
      <section className="container py-16">
        <div className="mb-8 flex items-end justify-between">
          <h2 className="font-heading text-[28px] font-bold sm:text-4xl">{t('public.latestLessons')}</h2>
          <Button asChild variant="link">
            <Link href="/lessons">{t('common.viewAll')}</Link>
          </Button>
        </div>
        <ContentGrid items={latest} locale={locale} />
      </section>

      {/* نداء الأستاذ */}
      <section className="container pb-20">
        <div className="bg-ink relative overflow-hidden rounded-xl p-8 text-white shadow-lift sm:p-12">
          <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <p className="inline-flex rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">{t('public.teacherCta')}</p>
              <p className="mt-3 font-heading text-[28px] font-bold leading-snug sm:text-4xl">{t('public.teacherCtaD')}</p>
            </div>
            <Button asChild size="lg" variant="gold" className="shrink-0">
              <Link href="/login">{t('public.teacherCtaBtn')}</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
