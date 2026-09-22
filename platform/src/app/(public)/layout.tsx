import { BookOpenText } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { LocaleSwitcher } from '@/components/locale-switcher'
import { getT } from '@/i18n/server'
import { getCurrentActor, homeFor } from '@/server/auth/current-user'

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const [actor, { t }] = await Promise.all([getCurrentActor(), getT()])
  const links = [
    { href: '/lessons', label: t('nav.lessons') },
    { href: '/bac', label: t('nav.bac') },
    { href: '/resources', label: t('nav.resources') },
    { href: '/quizzes', label: t('nav.quizzes') }
  ]
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/75 backdrop-blur-xl">
        <div className="container flex h-16 min-w-0 items-center gap-3 sm:gap-4">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 text-lg font-extrabold tracking-tight">
            <span className="flex size-9 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-soft">
              <BookOpenText className="size-5" />
            </span>
            {/* على الهاتف الأيقونة تكفي: الاسم يزاحم الأزرار ويُخرج الصفحة عن عرض الشاشة */}
            <span className="hidden sm:inline">{t('app.name')}</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-full px-3.5 py-2 text-sm font-semibold text-foreground/75 transition-colors hover:bg-muted hover:text-foreground">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex-1" />
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
        <nav className="container flex gap-1.5 overflow-x-auto pb-2.5 md:hidden">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="shrink-0 rounded-full border border-border/80 bg-card px-3.5 py-1.5 text-xs font-semibold shadow-soft">
              {l.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t bg-card/40 py-10">
        <div className="container flex flex-col items-center justify-between gap-3 text-center text-xs text-muted-foreground sm:flex-row sm:text-start">
          <p>
            © {new Date().getFullYear()} <span className="font-bold text-foreground">{t('app.name')}</span> — {t('app.tagline')}
          </p>
          <nav className="flex gap-4">
            {links.map((l) => (
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
