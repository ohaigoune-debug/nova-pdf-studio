import { BookOpenText } from 'lucide-react'
import Link from 'next/link'
import { Suspense, type ReactNode } from 'react'
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
      <header className="sticky top-0 z-40 brand-header border-b border-white/10 backdrop-blur-xl">
        <div className="container flex h-[72px] min-w-0 items-center gap-3 sm:gap-4">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 text-lg font-extrabold tracking-tight">
            <span className="flex size-9 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-soft">
              <BookOpenText className="size-5" />
            </span>
            {/* على الهاتف الأيقونة تكفي: الاسم يزاحم الأزرار ويُخرج الصفحة عن عرض الشاشة */}
            <span className="hidden sm:inline">{t('app.name')}</span>
          </Link>
          <PublicNav links={links} variant="desktop" />
          <div className="flex-1" />
          <Suspense fallback={null}>
            <LevelPicker saved={saved} className="hidden min-[1720px]:inline-flex" />
          </Suspense>
          <LocaleSwitcher />
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
              <Button asChild className="h-9 px-3 text-xs sm:h-10 sm:px-4 sm:text-sm">
                <Link href="/register">{t('nav.register')}</Link>
              </Button>
            </div>
          )}
        </div>
        <nav className="container flex items-center gap-1.5 overflow-x-auto pb-2.5 min-[1720px]:hidden" aria-label="أقسام المنصة">
          <Suspense fallback={null}>
            <LevelPicker saved={saved} className="shrink-0" />
          </Suspense>
          <PublicNav links={links} variant="mobile" />
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t bg-card/40 py-10">
        <div className="container flex flex-col items-center justify-between gap-3 text-center text-xs text-muted-foreground sm:flex-row sm:text-start">
          <p>
            © {new Date().getFullYear()} <span className="font-bold text-foreground">{t('app.name')}</span> — {t('app.tagline')}
          </p>
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
