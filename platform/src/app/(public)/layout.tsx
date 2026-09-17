import { BookOpenText } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { t } from '@/i18n'
import { getCurrentActor, homeFor } from '@/server/auth/current-user'

const links = [
  { href: '/lessons', label: t('nav.lessons') },
  { href: '/bac', label: t('nav.bac') },
  { href: '/resources', label: t('nav.resources') },
  { href: '/quizzes', label: t('nav.quizzes') }
]

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const actor = await getCurrentActor()
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="container flex h-16 items-center gap-4">
          <Link href="/" className="flex items-center gap-2 font-extrabold">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BookOpenText className="size-5" />
            </span>
            {t('app.name')}
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-md px-3 py-2 text-sm font-semibold text-foreground/80 hover:bg-muted hover:text-foreground">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex-1" />
          <ThemeToggle />
          {actor ? (
            <Button asChild>
              <Link href={homeFor(actor.role)}>{t('nav.dashboard')}</Link>
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link href="/login">{t('nav.login')}</Link>
              </Button>
              <Button asChild>
                <Link href="/register">{t('nav.register')}</Link>
              </Button>
            </div>
          )}
        </div>
        <nav className="container flex gap-1 overflow-x-auto pb-2 md:hidden">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="shrink-0 rounded-full border px-3 py-1 text-xs font-semibold">
              {l.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        <div className="container">
          © {new Date().getFullYear()} {t('app.name')} — {t('app.tagline')}
        </div>
      </footer>
    </div>
  )
}
