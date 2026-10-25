import { Quote } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AboutSettings } from '@/server/services/about.service'

/** Welcome card with the teacher's text only. */
export function TeacherBanner({ about, greeting, subtitle, action }: { about: AboutSettings; greeting: string; subtitle: string; action?: ReactNode }) {
  return (
    <section className="bg-ink relative overflow-hidden rounded-xl text-white shadow-lift">
      <span className="absolute -top-16 end-10 size-72 rounded-full bg-white/15 blur-3xl" aria-hidden />
      <div className="relative">
        <div className="space-y-4 p-6 sm:p-8">
          <div>
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{greeting}</h1>
            <p className="mt-1 text-sm text-white/60">{subtitle}</p>
          </div>
          {about.name ? (
            <div className="flex items-center gap-3">
              <span className="h-8 w-0.5 rounded-full bg-white" aria-hidden />
              <div className="leading-tight">
                <p className="font-display text-xl font-bold text-white">{about.name}</p>
                {about.title ? <p className="text-xs text-white/80">{about.title}</p> : null}
              </div>
            </div>
          ) : null}
          {about.quote ? (
            <p className="flex max-w-xl items-start gap-2 text-base font-semibold leading-relaxed text-white/90">
              <Quote className="mt-1 size-4 shrink-0 text-white/80" aria-hidden />
              {about.quote}
            </p>
          ) : null}
          {action}
        </div>
      </div>
    </section>
  )
}
