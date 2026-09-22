import { ArrowLeft, BookOpen, Brain, CheckCircle2, GraduationCap, QrCode, ShieldCheck, Sparkles, WifiOff, Youtube } from 'lucide-react'
import Link from 'next/link'
import { AboutTeacher } from '@/components/domain/about-teacher'
import { ContentGrid } from '@/components/domain/content-cards'
import { Button } from '@/components/ui/button'
import { getT } from '@/i18n/server'
import { getDb } from '@/server/db/client'
import { listPublicContent } from '@/server/queries/content.queries'
import { getAboutSettings, type AboutSettings } from '@/server/services/about.service'

export const dynamic = 'force-dynamic'

/**
 * صورة الأستاذ في واجهة المنصة: هو وجهها. مقصوصة على الحبر، تقف على حافة القسم،
 * ومعها شريحتان زجاجيتان صغيرتان تلمّحان لما وراءها (حضور QR، تصحيح بالذكاء الاصطناعي).
 */
function HeroPortrait({ about, t }: { about: AboutSettings; t: (k: never) => string }) {
  const tt = t as unknown as (k: string) => string
  return (
    <div className="relative mx-auto w-full max-w-md self-end lg:max-w-none">
      <span className="absolute inset-x-8 bottom-0 top-1/4 rounded-full bg-accent/15 blur-3xl" aria-hidden />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/teacher-hero.webp"
        alt={about.name}
        width={991}
        height={1400}
        fetchPriority="high"
        className="relative mx-auto block h-[440px] w-auto object-contain object-bottom drop-shadow-[0_30px_50px_rgba(0,0,0,0.55)] sm:h-[520px] lg:h-[620px]"
      />

      {/* شريحة الحضور — أعلى الطرف الأمامي */}
      <div className="glass animate-float absolute end-0 top-[8%] hidden items-center gap-3 rounded-lg px-4 py-3 shadow-lift sm:flex" style={{ animationDelay: '0.6s' }} aria-hidden>
        <span className="flex size-10 items-center justify-center rounded-md bg-gradient-to-br from-accent to-accent/70 text-accent-foreground">
          <QrCode className="size-5" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-bold text-white">{tt('public.previewAttendance')}</p>
          <p className="text-[11px] text-white/60">{tt('public.previewAttendanceD')}</p>
        </div>
      </div>

      {/* شريحة التصحيح — أسفل الطرف الخلفي */}
      <div className="glass animate-float absolute bottom-[30%] start-0 hidden items-center gap-3 rounded-lg px-4 py-3 shadow-lift sm:flex" style={{ animationDelay: '1.8s' }} aria-hidden>
        <span className="flex size-10 items-center justify-center rounded-md bg-white/10 text-accent">
          <Brain className="size-5" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-bold text-white">{tt('public.previewAi')}</p>
          <p className="text-[11px] text-white/60">{tt('public.previewAiD')}</p>
        </div>
        <span className="ms-2 rounded-full bg-success/20 px-2.5 py-1 text-[11px] font-bold text-emerald-300 tabular">14.5 / 20</span>
      </div>

      {/* الاسم عند قاعدة الصورة */}
      {about.name ? (
        <div className="absolute inset-x-0 bottom-4 flex justify-center">
          <div className="glass rounded-full px-5 py-2.5 text-center shadow-lift">
            <p className="text-base font-extrabold text-white">{about.name}</p>
            {about.title ? <p className="text-[11px] font-medium text-accent">{about.title}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default async function HomePage() {
  const db = await getDb()
  const [latest, about, { t, locale }] = await Promise.all([listPublicContent(db, { limit: 6 }), getAboutSettings(db), getT()])
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
      {/* البطل: حبر، زخرفة خفيفة، عنوان بذهب */}
      <section className="bg-ink bg-pattern relative overflow-hidden text-white">
        <div className="container grid gap-10 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:pt-20">
          <div className="space-y-7 self-center pb-4 animate-rise-in lg:pb-24">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3.5 py-1.5 text-xs font-bold text-accent">
              <Sparkles className="size-3.5" /> {t('public.heroEyebrow')}
            </span>
            <h1 className="text-4xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl lg:text-6xl">
              {before}
              {after !== '' || title.includes(highlight) ? <span className="text-gradient-gold">{highlight}</span> : null}
              {after}
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-white/70">{t('public.heroSubtitle')}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" variant="gold">
                <Link href="/register">{t('public.ctaStudent')}</Link>
              </Button>
              <Button asChild size="lg" className="border border-white/15 bg-white/10 text-white shadow-none hover:bg-white/15" variant="ghost">
                <Link href="/activate-code">{t('public.ctaCode')}</Link>
              </Button>
              <Button asChild size="lg" variant="link" className="text-white/80 hover:text-white">
                <Link href="/lessons">
                  {t('public.browseLessons')} <ArrowLeft className="size-4 rtl:rotate-0 ltr:rotate-180" />
                </Link>
              </Button>
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-sm text-white/60">
              {trust.map((x) => (
                <li key={x.text} className="flex items-center gap-2">
                  <x.icon className="size-4 text-accent" /> {x.text}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex animate-rise-in [animation-delay:150ms]">
            <HeroPortrait about={about} t={t as never} />
          </div>
        </div>
      </section>

      {/* المزايا */}
      <section className="container py-16 lg:py-20">
        <div className="mb-10 max-w-2xl">
          <h2 className="text-3xl font-extrabold tracking-tight">{t('public.featuresTitle')}</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <div key={f.title} className="group relative overflow-hidden rounded-lg border border-border/80 bg-card p-6 shadow-soft transition-all hover:-translate-y-1 hover:shadow-lift">
              <span className="absolute -end-6 -top-6 size-24 rounded-full bg-primary/5 transition-transform group-hover:scale-150" aria-hidden />
              <span className="relative flex size-12 items-center justify-center rounded-md bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-inset ring-primary/10">
                <f.icon className="size-6" />
              </span>
              <p className="relative mt-5 text-lg font-bold">{f.title}</p>
              <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
              <span className="absolute bottom-4 end-5 text-4xl font-extrabold text-primary/5 tabular" aria-hidden>
                0{i + 1}
              </span>
            </div>
          ))}
        </div>
      </section>

      <AboutTeacher about={about} eyebrow={t('public.aboutEyebrow')} cta={t('public.aboutCta')} />

      {/* كيف تبدأ */}
      <section className="border-y bg-card/40">
        <div className="container py-16 lg:py-20">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-extrabold tracking-tight">{t('public.howTitle')}</h2>
            <p className="mt-2 text-muted-foreground">{t('public.howSubtitle')}</p>
          </div>
          <ol className="relative grid gap-6 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="relative rounded-lg border border-border/80 bg-card p-6 shadow-soft">
                <span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent/70 text-base font-extrabold text-accent-foreground shadow-soft tabular">{i + 1}</span>
                <p className="mt-4 text-lg font-bold">{s.title}</p>
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
          <h2 className="text-3xl font-extrabold tracking-tight">{t('public.latestLessons')}</h2>
          <Button asChild variant="link">
            <Link href="/lessons">{t('common.viewAll')}</Link>
          </Button>
        </div>
        <ContentGrid items={latest} locale={locale} />
      </section>

      {/* نداء الأستاذ */}
      <section className="container pb-20">
        <div className="bg-ink bg-pattern relative overflow-hidden rounded-xl p-8 text-white shadow-lift sm:p-12">
          <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-accent">{t('public.teacherCta')}</p>
              <p className="mt-2 text-2xl font-extrabold leading-snug sm:text-3xl">{t('public.teacherCtaD')}</p>
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
