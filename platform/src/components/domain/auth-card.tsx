import { BookOpenText } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { t, type Locale } from '@/i18n'

/** بطاقة الدخول على خلفية الحبر: أول ما يراه الطالب والأستاذ من المنصة */
export function AuthCard({ title, subtitle, children, footer, locale = 'ar' }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode; locale?: Locale }) {
  return (
    <div className="bg-ink bg-pattern relative flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-rise-in">
        <Link href="/" className="mb-8 flex items-center justify-center gap-3 text-white">
          <span className="flex size-12 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent/70 text-accent-foreground shadow-lift">
            <BookOpenText className="size-6" />
          </span>
          <span className="text-2xl font-extrabold tracking-tight">{t('app.name', undefined, locale)}</span>
        </Link>
        <div className="rounded-xl border border-white/10 bg-card p-6 shadow-lift sm:p-8">
          <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
        </div>
        {footer ? <div className="mt-5 text-center text-sm text-white/70 [&_a]:text-accent [&_a]:hover:text-accent/80">{footer}</div> : null}
      </div>
    </div>
  )
}
