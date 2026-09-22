import { ArrowLeft, BookOpen, Brain, CheckCircle2, GraduationCap, QrCode, ShieldCheck, Sparkles, WifiOff, Youtube } from 'lucide-react'
import Link from 'next/link'
import { ContentGrid } from '@/components/domain/content-cards'
import { Button } from '@/components/ui/button'
import { getT } from '@/i18n/server'
import { getDb } from '@/server/db/client'
import { listPublicContent } from '@/server/queries/content.queries'

export const dynamic = 'force-dynamic'

/** معاينة ثابتة لثلاث شاشات من المنصة — تُظهر ما سيجده الطالب دون صور خارجية */
function Preview({ t }: { t: (k: never) => string }) {
  const tt = t as unknown as (k: string) => string
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-hidden>
      <div className="absolute -inset-8 rounded-full bg-accent/10 blur-3xl" />
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

export default async function HomePage() {
  const [latest, { t, locale }] = await Promise.all([listPublicContent(await getDb(), { limit: 6 }), getT()])
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
        <div className="container grid items-center gap-12 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
          <div className="space-y-7 animate-rise-in">
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
          <div className="animate-rise-in [animation-delay:150ms]">
            <Preview t={t as never} />
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
