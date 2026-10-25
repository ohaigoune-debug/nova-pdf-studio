import type { ReactNode } from 'react'
import { getDb } from '@/server/db/client'
import type { Actor } from '@/server/lib/actor'
import { unreadCount } from '@/server/services/notifications.service'
import { navFor, type NavItem } from './nav'
import { ShellClient, type ShellNavItem } from './shell-client'

export async function AppShell({ actor, children }: { actor: Actor; children: ReactNode }) {
  const unread = actor.role === 'CONFIRMER' ? 0 : await unreadCount(await getDb(), actor.userId)
  const serializeItem = (i: NavItem): ShellNavItem => ({
    href: i.href, label: i.label, exact: i.exact ?? false, iconKey: i.iconKey, also: i.also ?? [],
    children: i.children?.map(serializeItem)
  })
  const sections = navFor(actor.role).map((s) => ({
    title: s.title,
    collapsible: s.collapsible,
    items: s.items.map(serializeItem)
  }))
  return (
    <ShellClient actor={{ fullName: actor.fullName, email: actor.email, role: actor.role }} sections={sections} unread={unread}>
      {children}
    </ShellClient>
  )
}
