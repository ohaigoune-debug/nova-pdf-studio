import { ArrowLeft, BookOpen, Brain, CheckCircle2, GraduationCap, QrCode, ShieldCheck, Smartphone, Sparkles, WifiOff, Youtube } from 'lucide-react'
import Link from 'next/link'
import { AlgeriaMap } from '@/components/domain/algeria-map'
import { ContentGrid } from '@/components/domain/content-cards'
import { Button } from '@/components/ui/button'
import { getT } from '@/i18n/server'
import { getCurrentActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { apkSizeMb, appDownload } from '@/server/lib/android-apk'
import { listPublicContent } from '@/server/queries/content.queries'
import { studentsPerWilaya } from '@/server/queries/map.queries'

export const dynamic = 'force-dynamic'

/** معاينة ثابتة لثلاث شاشات من المنصة — تُظهر ما سيجده الطالب دون صور خارجية */
function Preview({ t }: { t: (k: never) => string }) {
  const tt = t as unknown as (k: string) => string
  return (
    <div className="bg-ink relative mx-auto w-full max-w-md overflow-hidden rounded-xl p-5 shadow-lift sm:p-6 lg:max-w-none" aria-hidden>
      <div className="relative grid gap-4">
        <div className="glass animate-float rounded-lg p-5 shadow-lift" style={{ animationDelay: '0s' }}>
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-md bg-gradient-to-br from-accent to-accent/70 text-accent-foreground">
              <QrCode className="size-5" />
            </span>
            <div>
              <p className="font-bold text-white">{tt('public.previewAttendance')}</p>
              <p className="text-xs text-white/60">{tt('public.previewAttendanceD')}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-8 gap-1">
            {Array.from({ length: 24 }).map((_, i) => (
              <span key={i} className={i % 3 === 0 || i % 7 === 0 ? 'h-2 rounded-sm bg-white/80' : 'h-2 rounded-sm bg-white/15'} />
            ))}
          </div>
        </div>

        <div className="glass animate-float rounded-lg p-5 shadow-lift lg:ms-10" style={{ animationDelay: '1.2s' }}>
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary/70 text-white">
              <Sparkles className="size-5" />
            </span>
            <div>
              <p className="font-bold text-white">{tt('public.previewSkills')}</p>
              <p className="text-xs text-white/60">{tt('public.previewSkillsD')}</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {[82, 64, 91].map((v, i) => (
              <div key={i} className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-l from-accent to-primary" style={{ width: `${v}%` }} />
              </div>
            ))}
          </div>
        </div>

        <div className="glass animate-float rounded-lg p-5 shadow-lift" style={{ animationDelay: '2.4s' }}>
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-md bg-white/10 text-accent">
              <Brain className="size-5" />
            </span>
            <div>
              <p className="font-bold text-white">{tt('public.previewAi')}</p>
              <p className="text-xs text-white/60">{tt('public.previewAiD')}</p>
            </div>
            <span className="ms-auto rounded-full bg-success/20 px-2.5 py-1 text-[11px] font-bold text-emerald-300">14.5 / 20</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/** أرقام صغيرة في بداية المنصة تُضعف الواجهة: تظهر العدّادات من هذا الحدّ، وقبله جملة الخريطة */
const MAP_COUNTS_FROM = 50

export default async function HomePage() {
  const actor = await getCurrentActor()
  const student = actor?.role === 'STUDENT'
  const db = await getDb()
  const [latest, map, apk, { t, locale }] = await Promise.all([listPublicContent(db, { limit: 6 }), studentsPerWilaya(db), appDownload(), getT()])
  const reached = map.filter((w) => w.students > 0).length
  const totalStudents = map.reduce((sum, w) => sum + w.students, 0)
  const features = [
    { icon: BookOpen, title: t('public.f1'), text: t('public.f1d') },
    { icon: GraduationCap, title: t('public.f2'), text: t('public.f2d') },
    { icon: QrCode, title: t('public.f3'), text: t('public.f3d') },
    { icon: Brain, title: t('public.f4'), text: t('public.f4d') }
  ]
  const trust = [
    { icon: ShieldCheck, text: t('public.trust1') },
    { icon: WifiOff, text: t('public.trust2') },
    { icon: Youtube, text: t('public.trust3') }
  ]
  const steps = [
    { title: t('public.step1'), text: t('public.step1d') },
    { title: t('public.step2'), text: t('public.step2d') },
    { title: t('public.step3'), text: t('public.step3d') }
  ]
  const title = t('public.heroTitle')
  const highlight = t('public.heroHighlight')
  const [before, after] = title.includes(highlight) ? title.split(highlight) : [title, '']

  return (
    <>
      {/* البطل: سطح فاتح، عنوان كحلي بكلمة زرقاء، إجراء أزرق واحد، والعبارة؛ المساحة الزرقاء للمعاينة */}
      <section className="relative overflow-hidden border-b bg-background">
        <div className="container grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 lg:py-24">
          <div className="space-y-6 animate-rise-in">
            <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3.5 py-1.5 text-xs font-semibold text-secondary-foreground">
              <Sparkles className="size-3.5" /> {t('public.heroEyebrow')}
            </span>
            <h1 className="font-heading text-balance text-[34px] font-bold leading-[1.35] sm:text-5xl lg:text-6xl">
              {before}
              {after !== '' || title.includes(highlight) ? <span className="text-primary">{highlight}</span> : null}
              {after}
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">{t('public.heroSubtitle')}</p>
            <p className="font-heading text-xl font-semibold text-foreground">نفهم. نتقدّم. نتفوّق.</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href={student ? '/student' : '/register'}>{student ? t('nav.dashboard') : t('public.ctaStudent')}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/lessons">
                  {t('public.browseLessons')} <ArrowLeft className="size-4 rtl:rotate-0 ltr:rotate-180" />
                </Link>
              </Button>
            </div>
            {/* يظهر ما دام التطبيق مبنياً ومنشوراً على الخادم (scripts/build-android.sh) */}
            {apk ? (
              <a
                href="/download/android"
                className="inline-flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 transition-colors hover:border-primary/50"
              >
                <Smartphone className="size-6 text-primary" />
                <span className="leading-tight">
                  <span className="block font-bold">{t('public.androidApp')}</span>
                  <span className="block text-xs text-muted-foreground">{t('public.androidAppD', { size: apkSizeMb(apk.size) })}</span>
                </span>
              </a>
            ) : null}
            <ul className="flex flex-wrap gap-x-6 gap-y-2 pt-1 text-sm text-muted-foreground">
              {trust.map((x) => (
                <li key={x.text} className="flex items-center gap-2">
                  <x.icon className="size-4 text-primary" /> {x.text}
                </li>
              ))}
            </ul>
          </div>
          <div className="animate-rise-in [animation-delay:150ms]">
            <Preview t={t as never} />
          </div>
        </div>
      </section>

      {/* المزايا */}
      <section className="container py-16 lg:py-20">
        <div className="mb-10 max-w-2xl">
          <h2 className="font-heading text-[28px] font-bold sm:text-4xl">{t('public.featuresTitle')}</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <div key={f.title} className="relative rounded-lg border border-border bg-card p-6 shadow-soft transition-colors duration-150 hover:border-primary/40">
              <span className="flex size-12 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                <f.icon className="size-6" />
              </span>
              <p className="mt-5 font-heading text-lg font-semibold">{f.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
              <span className="sr-only">{i + 1}</span>
            </div>
          ))}
        </div>
      </section>

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
