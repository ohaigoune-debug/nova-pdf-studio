import { BookOpenText } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { t } from '@/i18n'

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2 font-extrabold">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BookOpenText className="size-5" />
          </span>
          {t('app.name')}
        </Link>
        <div className="rounded-lg border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-extrabold">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
        </div>
        {footer ? <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div> : null}
      </div>
    </div>
  )
}
