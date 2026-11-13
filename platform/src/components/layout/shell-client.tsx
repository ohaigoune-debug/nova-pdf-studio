'use client'

import { ArrowRight, BookMarked, ChevronDown, MoreHorizontal, Sun, Bell, LogOut, Menu, Search, X } from 'lucide-react'
import { iconByName } from '@/components/icon-registry'
import Link from '@/components/ui/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { Logo } from '@/components/brand/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { Avatar } from '@/components/ui/misc'
import { Button } from '@/components/ui/button'
import { t, tEnum } from '@/i18n'
import { cn } from '@/lib/utils'
import { logoutAction } from '@/server/actions/auth.actions'
import { HiddenPathsProvider } from '@/components/student/hidden-paths'
import { hubEntry } from '@/lib/student-menu'
import { hubPaths, type StudentHubKey } from '@/lib/student-hubs'

export interface ShellNavItem {
  href: string
  label: string
  exact: boolean
  also?: string[]
  children?: ShellNavItem[]
  iconKey: string
}
interface ShellSection {
  collapsible?: boolean
  title?: string
  items: ShellNavItem[]
}

function Icon({ name, className }: { name: string; className?: string }) {
  const Cmp = iconByName(name)
  if (!Cmp) return <span className={className} />
  return <Cmp className={className} />
}

/** الشعار الأصلي في الشريط الكحلي: على لوحة فاتحة نظيفة (الكتابة كحلية)، وتحته الدور */
function Brand({ role }: { role: string }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <Logo width={128} surface="plate" />
      <p className="ps-1 text-xs font-medium text-sidebar-muted">{tEnum('roles', role)}</p>
    </div>
  )
}

export function ShellClient({
  actor,
  sections,
  unread,
  hidden = [],
  children
}: {
  actor: { fullName: string; email: string; role: string }
  sections: ShellSection[]
  unread: number
  hidden?: string[]
  children: ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const base = pathname.split('/')[1] ?? ''
  const notificationsHref = `/${base}/notifications`

  const matches = (href: string, exact: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(href + '/'))
  const isActive = (item: ShellNavItem): boolean => matches(item.href, item.exact) || (item.also ?? []).some((h) => matches(h, false)) || (item.children ?? []).some(isActive)

  const renderItem = (item: ShellNavItem): ReactNode => {
    const active = isActive(item)
    const classes = cn(
      'group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors',
      active ? 'bg-white/[0.08] text-white' : 'text-sidebar-foreground/70 hover:bg-white/[0.05] hover:text-sidebar-foreground'
    )
    const contents = <><Icon name={item.iconKey} className={cn('size-[18px] shrink-0', active ? 'text-sidebar-active' : 'text-sidebar-muted')} /><span className="truncate">{item.label}</span></>
    if (item.children?.length) return (
      <li key={item.href}>
        <details className="group/nav" open={active}>
          <summary className={cn(classes, 'cursor-pointer list-none [&::-webkit-details-marker]:hidden')}>
            {contents}<ChevronDown className="ms-auto size-4 transition-transform group-open/nav:rotate-180" />
          </summary>
          <ul className="ms-4 mt-1 space-y-0.5 border-s border-sidebar-border ps-2">{item.children.map(renderItem)}</ul>
        </details>
      </li>
    )
    return (
      <li key={item.href}>
        <Link href={item.href} onClick={() => setOpen(false)} aria-current={active ? 'page' : undefined} className={classes}>
          <span className={cn('absolute inset-y-2 start-0 w-0.5 rounded-full bg-sidebar-active transition-opacity', active ? 'opacity-100' : 'opacity-0')} aria-hidden />
          {contents}
        </Link>
      </li>
    )
  }

  const nav = (
    <nav className="flex flex-col gap-6 p-3">
      {sections.map((s, i) => s.collapsible ? (
        <details key={i} className="group/section" open={s.items.some(isActive)}>
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2.5 text-sm font-semibold text-sidebar-foreground/70 hover:bg-white/[0.05] [&::-webkit-details-marker]:hidden">
            <MoreHorizontal className="size-[18px]" /><span>{s.title}</span><ChevronDown className="ms-auto size-4 transition-transform group-open/section:rotate-180" />
          </summary>
          <ul className="mt-1 space-y-0.5">{s.items.map(renderItem)}</ul>
        </details>
      ) : (
        <div key={i}>
          {s.title ? <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-sidebar-muted/80">{s.title}</p> : null}
          <ul className="space-y-0.5">{s.items.map(renderItem)}</ul>
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
        <div className="flex min-h-[88px] items-center border-b border-sidebar-border px-5 py-3">
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
            <div className="flex min-h-[88px] items-center justify-between border-b border-sidebar-border px-4 py-3">
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
        <header className="no-print sticky top-0 z-40 flex h-[72px] items-center gap-2 brand-header px-4 backdrop-blur-xl lg:px-8">
          {/* رجوع ظاهر على الهاتف في كل صفحة غير الرئيسية (لا زر رجوع في الآيفون): السجل إن وُجد، وإلا الصفحة الأم */}
          {pathname.split('/').filter(Boolean).length > 1 ? (
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="رجوع"
              onClick={() => {
                if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) router.back()
                else router.push(pathname.split('/').slice(0, -1).join('/') || '/')
              }}
            >
              <ArrowRight className="size-5 ltr:rotate-180" />
            </Button>
          ) : null}
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="القائمة">
            <Menu className="size-5" />
          </Button>
          <Link href={actor.role === 'CONFIRMER' ? '/admin/store/confirm' : actor.role === 'MANAGER' ? '/admin/points-of-sale' : actor.role === 'CONTENT_UPLOADER' ? '/studio' : `/${base}`} className="flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden">
            <Logo width={132} priority />
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
          {actor.role !== 'CONFIRMER' && actor.role !== 'CONTENT_UPLOADER' ? (
          <Link href={notificationsHref} className="relative flex min-h-11 min-w-11 items-center justify-center rounded-md p-2 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={t('common.notifications')}>
            <Bell className="size-5" />
            {unread > 0 ? (
              <span className="absolute -end-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground ring-2 ring-background">
                {unread > 99 ? '99+' : unread}
              </span>
            ) : null}
          </Link>
          ) : null}
          <ThemeToggle />
          <div className="hidden items-center gap-2 sm:flex">
            <Avatar name={actor.fullName} size="sm" />
          </div>
        </header>
        {/* للتلميذ: الهامش السفلي من .student-content (100px فوق شريط التنقل الثابت في الهاتف)؛ py-6 كانت تلغيه فيُغطّي الشريط آخر عنصر في الصفحة */}
        <main className={cn("flex-1 px-4 pt-6 lg:px-8 lg:pt-8", actor.role === 'STUDENT' ? "student-content" : "pb-6 lg:pb-8")}>
          <div className="mx-auto w-full max-w-7xl animate-fade-in"><HiddenPathsProvider hidden={hidden}>{children}</HiddenPathsProvider></div>
        </main>
        {actor.role === 'STUDENT' ? (
          <nav aria-label="التنقل الرئيسي للتلميذ" className="student-bottom-nav no-print fixed inset-x-0 bottom-0 z-40 border-t bg-card shadow-soft lg:hidden">
            <div className="mx-auto grid h-[68px] max-w-lg grid-flow-col auto-cols-fr items-center px-2">
              {[
                { href: '/student', label: 'اليوم', icon: Sun, paths: [] as string[] },
                // كل باب يفتح أول تبويب ظاهر فيه، ويختفي إن خُفيت تبويباته كلها («تدرّب» حين يُخفى PLAY)
                ...(['courses', 'train', 'account'] as StudentHubKey[]).flatMap((key) => {
                  const entry = hubEntry(key, hidden)
                  return entry ? [{ href: entry.href, label: entry.label, icon: iconByName(entry.iconKey) ?? BookMarked, paths: hubPaths(key) }] : []
                })
              ].map((item) => {
                // الأبواب الثلاثة: الباب نشط في كل تبويباته (الواجبات تحت «دوراتي»، الفروض تحت PLAY…)
                const active = item.href === '/student' ? pathname === item.href : item.paths.some((h) => matches(h, false))
                return (
                  <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={cn('flex min-h-11 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', active ? 'text-primary' : 'text-muted-foreground')}>
                    <span className={cn('flex items-center justify-center', active && 'rounded-full bg-secondary px-3 py-0.5')}><item.icon className="size-5" /></span>
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </nav>
        ) : null}
      </div>
    </div>
  )
}
