import { Quote } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { AboutSettings } from '@/server/services/about.service'

/** قسم الأستاذ على الصفحة الرئيسية: صورة مقصوصة على الحبر، اسم وصفة وسطران واقتباس */
export function AboutTeacher({ about, eyebrow, cta }: { about: AboutSettings; eyebrow: string; cta: string }) {
  if (!about.name) return null
  return (
    <section className="container py-16 lg:py-20">
      <div className="bg-ink bg-pattern relative overflow-hidden rounded-xl text-white shadow-lift">
        <div className="grid items-end gap-8 lg:grid-cols-[1fr_minmax(0,1.3fr)]">
          {/* الصورة تقف على حافة القسم السفلية كأنها جالسة داخله */}
          <div className="relative order-last mx-auto -mb-2 w-full max-w-sm px-6 pt-8 lg:order-first lg:max-w-none lg:px-0 lg:pt-12">
            <span className="absolute inset-x-10 bottom-0 top-1/3 rounded-full bg-accent/15 blur-3xl" aria-hidden />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/teacher.webp" alt={about.name} width={933} height={1400} className="relative mx-auto block h-[420px] w-auto object-contain object-bottom drop-shadow-[0_24px_40px_rgba(0,0,0,0.5)] lg:h-[520px]" />
          </div>
          <div className="space-y-5 px-6 pb-10 pt-10 sm:px-10 lg:px-12 lg:py-14">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">{eyebrow}</p>
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{about.name}</h2>
              {about.title ? <p className="mt-2 text-base text-white/70">{about.title}</p> : null}
            </div>
            {about.quote ? (
              <blockquote className="relative border-s-2 border-accent/60 ps-5 text-xl font-semibold leading-relaxed text-white/95">
                <Quote className="absolute -start-3 -top-3 size-6 text-accent/70" aria-hidden />
                {about.quote}
              </blockquote>
            ) : null}
            {about.bio ? <p className="max-w-xl text-base leading-relaxed text-white/70">{about.bio}</p> : null}
            <Button asChild size="lg" variant="gold">
              <Link href="/register">{cta}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
