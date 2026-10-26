import Link from 'next/link'
import { Suspense, type ReactNode } from 'react'
import { Logo } from '@/components/brand/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { LocaleSwitcher } from '@/components/locale-switcher'
import { LevelPicker } from '@/components/level-picker'
import { PublicNav, type PublicLink } from '@/components/layout/public-nav'
import { FOOTER_EXTRA, MAIN_SECTIONS } from '@/lib/sections'
import { savedLevelCode } from '@/server/queries/level-scope'
import { getT } from '@/i18n/server'
import { getCurrentActor, homeFor } from '@/server/auth/current-user'

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const [actor, { t }, saved] = await Promise.all([getCurrentActor(), getT(), savedLevelCode()])
  const links: PublicLink[] = MAIN_SECTIONS.map((s) => ({ href: s.href, label: s.label }))
  const legal = [
    { href: '/privacy', label: t('public.privacy') },
    { href: '/delete-account', label: t('public.deleteAccount') }
  ]
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 brand-header backdrop-blur-xl">
        <div className="container flex h-[72px] min-w-0 items-center gap-2 sm:gap-4">
          {/* الشعار الأصلي: أصغر قليلاً على الهاتف كي لا يزاحم الأزرار */}
          <Link href="/" className="flex shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Logo width={132} priority className="sm:hidden" />
            <Logo width={168} priority className="hidden sm:inline-flex" />
          </Link>
          <PublicNav links={links} variant="desktop" />
          <div className="min-w-0 flex-1" />
          <Suspense fallback={null}>
            <LevelPicker saved={saved} className="hidden min-[1720px]:inline-flex" />
          </Suspense>
          {/* على الهاتف يُنقل مبدّل اللغة إلى السطر الثاني كي لا تخرج الترويسة عن عرض الشاشة */}
          <span className="hidden sm:inline-flex">
            <LocaleSwitcher />
          </span>
          <ThemeToggle />
          {actor ? (
            <Button asChild>
              <Link href={homeFor(actor.role)}>{t('nav.dashboard')}</Link>
            </Button>
          ) : (
            <div className="flex shrink-0 items-center gap-2">
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link href="/login">{t('nav.login')}</Link>
              </Button>
              <Button asChild size="sm" className="px-3 sm:px-4">
                <Link href="/register">{t('nav.register')}</Link>
              </Button>
            </div>
          )}
        </div>
        <nav className="container flex items-center gap-1.5 overflow-x-auto pb-2.5 min-[1720px]:hidden" aria-label="أقسام المنصة">
          <span className="inline-flex shrink-0 sm:hidden">
            <LocaleSwitcher />
          </span>
          <Suspense fallback={null}>
            <LevelPicker saved={saved} className="shrink-0" />
          </Suspense>
          <PublicNav links={links} variant="mobile" />
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t bg-card py-10">
        <div className="container flex flex-col items-center justify-between gap-4 text-center text-xs text-muted-foreground sm:flex-row sm:text-start">
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <Logo width={136} />
            <p className="font-heading text-sm font-semibold text-foreground">نفهم. نتقدّم. نتفوّق.</p>
            <p>
              © {new Date().getFullYear()} {t('app.name')} — {t('app.tagline')}
            </p>
          </div>
          <nav className="flex flex-wrap justify-center gap-4">
            {[...links, ...FOOTER_EXTRA, ...legal].map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-foreground">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  )
}
