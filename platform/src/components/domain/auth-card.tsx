import Link from 'next/link'
import type { ReactNode } from 'react'
import { Logo } from '@/components/brand/logo'
import type { Locale } from '@/i18n'
import { AuthBackgroundPreload } from '@/lib/brand-backgrounds'

/**
 * بطاقة الدخول والتسجيل والاسترجاع: استمارة واحدة واضحة على بطاقة فاتحة بحافة ذهبية،
 * فوق خلفية الهوية الكحلية (20 نوفمبر 2026). الشعار بكتابة كحلية فيوضع على لوحة فاتحة.
 */
export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode; locale?: Locale }) {
  return (
    <div className="auth-backdrop flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-10 sm:py-14">
      <AuthBackgroundPreload />
      <div className="w-full max-w-[440px] animate-fade-in">
        <Link href="/" className="auth-outside mx-auto mb-6 flex w-fit flex-col items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Logo width={168} priority surface="plate" className="!rounded-xl !px-4 !py-2 shadow-lg" />
          <span className="font-heading text-sm font-semibold">نفهم. نتقدّم. نتفوّق.</span>
        </Link>
        <div className="rounded-xl border border-border border-t-4 border-t-[#C29B45] bg-card p-6 shadow-2xl sm:p-8">
          <h1 className="font-heading text-[28px] font-bold leading-[1.4]">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
        </div>
        {footer ? <div className="auth-outside mt-5 rounded-xl bg-[#0F2544]/70 px-4 py-3 text-center text-sm backdrop-blur-sm [&_a]:font-semibold [&_a]:underline-offset-4 hover:[&_a]:underline">{footer}</div> : null}
      </div>
    </div>
  )
}
