import { BookOpen, Brain, GraduationCap, QrCode } from 'lucide-react'
import Link from 'next/link'
import { ContentGrid } from '@/components/domain/content-cards'
import { Button } from '@/components/ui/button'
import { t } from '@/i18n'
import { getDb } from '@/server/db/client'
import { listPublicContent } from '@/server/queries/content.queries'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const latest = await listPublicContent(await getDb(), { limit: 6 })
  const features = [
    { icon: BookOpen, title: t('public.f1'), text: t('public.f1d') },
    { icon: GraduationCap, title: t('public.f2'), text: t('public.f2d') },
    { icon: QrCode, title: t('public.f3'), text: t('public.f3d') },
    { icon: Brain, title: t('public.f4'), text: t('public.f4d') }
  ]
  return (
    <>
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="container grid items-center gap-10 py-16 lg:grid-cols-2 lg:py-24">
          <div className="space-y-6">
            <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{t('app.tagline')}</span>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight lg:text-5xl">{t('public.heroTitle')}</h1>
            <p className="max-w-xl text-lg text-muted-foreground">{t('public.heroSubtitle')}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/register">{t('public.ctaStudent')}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/activate-code">{t('public.ctaCode')}</Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link href="/lessons">{t('public.browseLessons')}</Link>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {features.map((f) => (
              <div key={f.title} className="rounded-lg border bg-card p-5 shadow-sm">
                <f.icon className="mb-3 size-6 text-primary" />
                <p className="font-bold">{f.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="container py-12">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-2xl font-extrabold">{t('public.latestLessons')}</h2>
          <Button asChild variant="link">
            <Link href="/lessons">{t('common.viewAll')}</Link>
          </Button>
        </div>
        <ContentGrid items={latest} />
      </section>
    </>
  )
}
