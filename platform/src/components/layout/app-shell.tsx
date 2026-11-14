import type { ReactNode } from 'react'
import { headers } from 'next/headers'
import Link from '@/components/ui/link'
import { IOS_PRESENTATION_HEADER, IOS_PRESENTATION_VALUE } from '@/lib/ios-presentation'
import { Logo } from '@/components/brand/logo'
import { getDb } from '@/server/db/client'
import type { Actor } from '@/server/lib/actor'
import { unreadCount } from '@/server/services/notifications.service'
import { navFor, type NavItem } from './nav'
import { hubEntry, hubKeyByHref, isPathHidden } from '@/lib/student-menu'
import { studentHiddenPaths } from '@/server/services/ios-only.service'
import { ShellClient, type ShellNavItem } from './shell-client'

export async function AppShell({ actor, children }: { actor: Actor; children: ReactNode }) {
  // Presentation only. StudentLayout and every service keep their usual guards.
  if (actor.role === 'STUDENT' && (await headers()).get(IOS_PRESENTATION_HEADER) === IOS_PRESENTATION_VALUE) {
    return <div className="mx-auto min-h-dvh max-w-4xl px-4 py-5 sm:px-6"><header className="mb-5 border-b pb-4"><Link href="/ios"><Logo width={136} /></Link></header><main>{children}</main></div>
  }
  const unread = actor.role === 'CONFIRMER' || actor.role === 'CONTENT_UPLOADER' ? 0 : await unreadCount(await getDb(), actor.userId)
  const serializeItem = (i: NavItem): ShellNavItem => ({
    href: i.href, label: i.label, exact: i.exact ?? false, iconKey: i.iconKey, also: i.also ?? [],
    children: i.children?.map(serializeItem)
  })
  const hidden = actor.role === 'STUDENT' ? await studentHiddenPaths(await getDb()) : []
  // مدخل مجمّع يختفي حين تُخفى كل تبويباته
  const visible = (i: NavItem) => !isPathHidden(i.href, hidden) || (i.also ?? []).some((h) => !isPathHidden(h, hidden))
  const place = (i: NavItem): ShellNavItem => {
    const item = serializeItem(i)
    // مدخل مجمّع للتلميذ: أول تبويب ظاهر، واسمه البديل إن خُفي تبويبه الأول («تدرّب» بدل PLAY)
    const hub = actor.role === 'STUDENT' ? hubKeyByHref(i.href) : null
    const entry = hub ? hubEntry(hub, hidden) : null
    if (entry) return { ...item, ...entry }
    return { ...item, href: isPathHidden(i.href, hidden) ? ((i.also ?? []).find((h) => !isPathHidden(h, hidden)) ?? i.href) : i.href }
  }
  const sections = navFor(actor.role, { assistantScope: actor.assistantScope }).map((s) => ({
    title: s.title,
    collapsible: s.collapsible,
    items: s.items.filter(visible).map(place)
  })).filter((s) => s.items.length > 0)
  return (
    <ShellClient actor={{ fullName: actor.fullName, email: actor.email, role: actor.role }} sections={sections} unread={unread} hidden={hidden}>
      {children}
    </ShellClient>
  )
}
