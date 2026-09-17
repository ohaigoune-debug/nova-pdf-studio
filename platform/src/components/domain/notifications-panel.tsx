import { Bell } from 'lucide-react'
import Link from 'next/link'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { t } from '@/i18n'
import { cn, formatDateTime } from '@/lib/utils'
import type { Actor } from '@/server/lib/actor'
import { getDb } from '@/server/db/client'
import { listNotifications } from '@/server/services/notifications.service'
import { MarkAllReadButton } from './notifications-actions'

export async function NotificationsPanel({ actor }: { actor: Actor }) {
  const items = await listNotifications(await getDb(), actor.userId, 50)
  return (
    <>
      <PageHeader title={t('notifications.title')} actions={items.some((i) => !i.readAt) ? <MarkAllReadButton /> : null} />
      {items.length === 0 ? (
        <EmptyState icon={Bell} title={t('notifications.empty')} />
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {items.map((n) => {
            const inner = (
              <div className={cn('flex gap-3 p-4', !n.readAt && 'bg-primary/5')}>
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-primary')} />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{n.title}</p>
                  {n.body ? <p className="text-sm text-muted-foreground">{n.body}</p> : null}
                  <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(n.createdAt)}</p>
                </div>
              </div>
            )
            return (
              <li key={n.id}>
                {n.link ? (
                  <Link href={n.link} className="block hover:bg-muted/40">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
