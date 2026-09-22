import { Quote } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AboutSettings } from '@/server/services/about.service'

/**
 * صورة الأستاذ داخل المنصة في موضعين فقط: أول شاشة للطالب، وصفحة «دروسي».
 * صورته تقف على حافة البطاقة، وبجانبها الترحيب واسم الأستاذ واقتباسه.
 */
export function TeacherBanner({ about, greeting, subtitle, action, image = '/teacher.webp' }: { about: AboutSettings; greeting: string; subtitle: string; action?: ReactNode; image?: string }) {
  return (
    <section className="bg-ink bg-pattern relative overflow-hidden rounded-xl text-white shadow-lift">
      <span className="absolute -top-16 end-10 size-72 rounded-full bg-accent/15 blur-3xl" aria-hidden />
      <div className="relative grid items-end gap-4 sm:grid-cols-[1fr_auto]">
        <div className="space-y-4 p-6 sm:p-8 sm:pe-0">
          <div>
            <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">{greeting}</h1>
            <p className="mt-1 text-sm text-white/60">{subtitle}</p>
          </div>
          {about.name ? (
            <div className="flex items-center gap-3">
              <span className="h-8 w-0.5 rounded-full bg-accent" aria-hidden />
              <div className="leading-tight">
                <p className="font-display text-xl font-bold text-white">{about.name}</p>
                {about.title ? <p className="text-xs text-accent">{about.title}</p> : null}
              </div>
            </div>
          ) : null}
          {about.quote ? (
            <p className="flex max-w-xl items-start gap-2 text-base font-semibold leading-relaxed text-white/90">
              <Quote className="mt-1 size-4 shrink-0 text-accent" aria-hidden />
              {about.quote}
            </p>
          ) : null}
          {action}
        </div>
        {about.name ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={about.name}
            width={1000}
            height={1400}
            className="mx-auto -mb-1 block h-56 w-auto object-contain object-bottom drop-shadow-[0_20px_30px_rgba(0,0,0,0.5)] sm:me-6 sm:h-64 lg:h-72"
          />
        ) : null}
      </div>
    </section>
  )
}
