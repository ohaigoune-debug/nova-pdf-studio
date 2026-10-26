import Link from 'next/link'
import type { ReactNode } from 'react'
import { Logo } from '@/components/brand/logo'
import type { Locale } from '@/i18n'

/** بطاقة الدخول والتسجيل والاسترجاع: سطح فاتح هادئ، الشعار الأصلي فوقها، ونموذج واحد واضح */
export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode; locale?: Locale }) {
  return (
    <div className="relative flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-background px-4 py-10 sm:py-14">
      <div className="w-full max-w-[440px] animate-fade-in">
        <Link href="/" className="mx-auto mb-6 flex w-fit flex-col items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Logo width={176} priority />
          <span className="font-heading text-sm font-semibold text-muted-foreground">نفهم. نتقدّم. نتفوّق.</span>
        </Link>
        <div className="rounded-xl border border-border bg-card p-6 shadow-soft sm:p-8">
          <h1 className="font-heading text-[28px] font-bold leading-[1.4]">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
        </div>
        {footer ? <div className="mt-5 text-center text-sm text-muted-foreground [&_a]:font-semibold [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline">{footer}</div> : null}
      </div>
    </div>
  )
}
