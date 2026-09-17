import type { ReactNode } from 'react'
import { getDb } from '@/server/db/client'
import type { Actor } from '@/server/lib/actor'
import { unreadCount } from '@/server/services/notifications.service'
import { navFor } from './nav'
import { ShellClient } from './shell-client'

export async function AppShell({ actor, children }: { actor: Actor; children: ReactNode }) {
  const unread = await unreadCount(await getDb(), actor.userId)
  const sections = navFor(actor.role).map((s) => ({
    title: s.title,
    items: s.items.map((i) => ({ href: i.href, label: i.label, exact: i.exact ?? false, iconKey: i.iconKey }))
  }))
  return (
    <ShellClient actor={{ fullName: actor.fullName, email: actor.email, role: actor.role }} sections={sections} unread={unread}>
      {children}
    </ShellClient>
  )
}
