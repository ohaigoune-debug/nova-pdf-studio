'use client'

import { Bell, BookOpenText, LogOut, Menu, X } from 'lucide-react'
import * as Icons from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { ThemeToggle } from '@/components/theme-toggle'
import { Avatar } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { t, tEnum } from '@/i18n'
import { cn } from '@/lib/utils'
import { logoutAction } from '@/server/actions/auth.actions'

interface ShellNavItem {
  href: string
  label: string
  exact: boolean
  iconKey: string
}
interface ShellSection {
  title?: string
  items: ShellNavItem[]
}

function Icon({ name, className }: { name: string; className?: string }) {
  const Cmp = (Icons as unknown as Record<string, Icons.LucideIcon>)[name]
  if (!Cmp) return <span className={className} />
  return <Cmp className={className} />
}

export function ShellClient({
  actor,
  sections,
  unread,
  children
}: {
  actor: { fullName: string; email: string; role: string }
  sections: ShellSection[]
  unread: number
  children: ReactNode
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const base = pathname.split('/')[1] ?? ''
  const notificationsHref = `/${base}/notifications`

  const isActive = (item: ShellNavItem) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/'))

  const nav = (
    <nav className="flex flex-col gap-5 p-3">
      {sections.map((s, i) => (
        <div key={i}>
          {s.title ? <p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{s.title}</p> : null}
          <ul className="space-y-0.5">
            {s.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-colors',
                    isActive(item) ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground/80 hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon name={item.iconKey} className="size-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar (desktop) */}
      <aside className="no-print sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-e bg-card lg:flex">
        <div className="flex h-16 items-center gap-2 border-b px-5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BookOpenText className="size-5" />
          </div>
          <div className="leading-tight">
            <p className="font-extrabold">{t('app.name')}</p>
            <p className="text-[11px] text-muted-foreground">{tEnum('roles', actor.role)}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">{nav}</div>
        <div className="border-t p-3">
          <div className="flex items-center gap-3 rounded-md px-2 py-1.5">
            <Avatar name={actor.fullName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{actor.fullName}</p>
              <p className="truncate text-[11px] text-muted-foreground">{actor.email}</p>
            </div>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="icon" aria-label={t('common.logout')} title={t('common.logout')}>
                <LogOut className="size-4" />
              </Button>
            </form>
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 start-0 flex w-72 flex-col bg-card shadow-2xl animate-fade-in">
            <div className="flex h-16 items-center justify-between border-b px-4">
              <p className="font-extrabold">{t('app.name')}</p>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label={t('common.close')}>
                <X className="size-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">{nav}</div>
            <div className="border-t p-3">
              <form action={logoutAction}>
                <Button type="submit" variant="outline" className="w-full">
                  <LogOut className="size-4" /> {t('common.logout')}
                </Button>
              </form>
            </div>
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-40 flex h-16 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="القائمة">
            <Menu className="size-5" />
          </Button>
          <Link href={`/${base}`} className="font-extrabold lg:hidden">
            {t('app.name')}
          </Link>
          <div className="flex-1" />
          <Link href={notificationsHref} className="relative rounded-md p-2 hover:bg-muted" aria-label={t('common.notifications')}>
            <Bell className="size-5" />
            {unread > 0 ? (
              <span className="absolute -end-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                {unread > 99 ? '99+' : unread}
              </span>
            ) : null}
          </Link>
          <ThemeToggle />
          <div className="hidden items-center gap-2 sm:flex">
            <Avatar name={actor.fullName} size="sm" />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  )
}
