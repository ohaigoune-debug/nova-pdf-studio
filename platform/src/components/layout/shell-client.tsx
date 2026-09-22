'use client'

import { Bell, LogOut, Menu, Search, X } from 'lucide-react'
import * as Icons from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { BrandMark } from '@/components/brand-mark'
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

/** الشعار على الشريط الحبريّ: وجه الأستاذ في حلقة ذهبية — البراند نفسه */
function Brand({ role }: { role: string }) {
  return (
    <div className="flex items-center gap-3">
      <BrandMark className="size-11" />
      <div className="leading-tight">
        <p className="text-base font-extrabold tracking-tight text-sidebar-foreground">{t('app.name')}</p>
        <p className="text-[11px] font-medium text-sidebar-muted">{tEnum('roles', role)}</p>
      </div>
    </div>
  )
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
    <nav className="flex flex-col gap-6 p-3">
      {sections.map((s, i) => (
        <div key={i}>
          {s.title ? <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-sidebar-muted/80">{s.title}</p> : null}
          <ul className="space-y-0.5">
            {s.items.map((item) => {
              const active = isActive(item)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors',
                      active ? 'bg-white/[0.08] text-white' : 'text-sidebar-foreground/70 hover:bg-white/[0.05] hover:text-sidebar-foreground'
                    )}
                  >
                    {/* شريط ذهبي رفيع في الطرف: علامة الصفحة الحالية */}
                    <span className={cn('absolute inset-y-2 start-0 w-0.5 rounded-full bg-sidebar-active transition-opacity', active ? 'opacity-100' : 'opacity-0')} aria-hidden />
                    <Icon name={item.iconKey} className={cn('size-[18px] shrink-0 transition-colors', active ? 'text-sidebar-active' : 'text-sidebar-muted group-hover:text-sidebar-foreground')} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )

  const userCard = (
    <div className="flex items-center gap-3 rounded-md bg-white/[0.04] px-3 py-2.5 ring-1 ring-white/[0.06]">
      <Avatar name={actor.fullName} size="sm" className="bg-gradient-to-br from-sidebar-active/30 to-sidebar-active/10 text-sidebar-active ring-sidebar-active/30" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-sidebar-foreground">{actor.fullName}</p>
        <p className="truncate text-[11px] text-sidebar-muted" dir="ltr">
          {actor.email}
        </p>
      </div>
      <form action={logoutAction}>
        <Button type="submit" variant="ghost" size="icon" className="size-8 text-sidebar-muted hover:bg-white/10 hover:text-white" aria-label={t('common.logout')} title={t('common.logout')}>
          <LogOut className="size-4" />
        </Button>
      </form>
    </div>
  )

  return (
    <div className="flex min-h-dvh">
      {/* الشريط الجانبي (حاسوب) */}
      <aside className="no-print sticky top-0 hidden h-dvh w-[268px] shrink-0 flex-col border-e border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-[72px] items-center border-b border-sidebar-border px-5">
          <Brand role={actor.role} />
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">{nav}</div>
        <div className="border-t border-sidebar-border p-3">{userCard}</div>
      </aside>

      {/* الدرج (هاتف) */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 start-0 flex w-[300px] max-w-[85vw] flex-col bg-sidebar shadow-2xl animate-fade-in">
            <div className="flex h-[72px] items-center justify-between border-b border-sidebar-border px-4">
              <Brand role={actor.role} />
              <Button variant="ghost" size="icon" className="text-sidebar-muted hover:bg-white/10 hover:text-white" onClick={() => setOpen(false)} aria-label={t('common.close')}>
                <X className="size-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">{nav}</div>
            <div className="border-t border-sidebar-border p-3">{userCard}</div>
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-40 flex h-[72px] items-center gap-2 border-b border-border/70 bg-background/75 px-4 backdrop-blur-xl lg:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="القائمة">
            <Menu className="size-5" />
          </Button>
          <Link href={`/${base}`} className="flex items-center gap-2 font-extrabold lg:hidden">
            <BrandMark className="size-8" />
            {t('app.name')}
          </Link>
          <div className="flex-1">
            {actor.role === 'TEACHER' ? (
              <form action="/teacher/search" className="relative mx-auto hidden max-w-md md:block">
                <Search className="absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  name="q"
                  placeholder={t('search.placeholder')}
                  className="h-10 w-full rounded-full border border-border/80 bg-card ps-10 pe-4 text-sm shadow-soft transition-[box-shadow,border-color] placeholder:text-muted-foreground/80 hover:border-primary/40 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
                />
              </form>
            ) : null}
          </div>
          <Link href={notificationsHref} className="relative rounded-md p-2 text-foreground/80 transition-colors hover:bg-muted hover:text-foreground" aria-label={t('common.notifications')}>
            <Bell className="size-5" />
            {unread > 0 ? (
              <span className="absolute -end-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground ring-2 ring-background">
                {unread > 99 ? '99+' : unread}
              </span>
            ) : null}
          </Link>
          <ThemeToggle />
          <div className="hidden items-center gap-2 sm:flex">
            <Avatar name={actor.fullName} size="sm" />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-7xl animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  )
}
