'use client'

import { MonitorSmartphone } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'
import { formatDateTime } from '@/lib/utils'
import { revokeDeviceAction } from '@/server/actions/auth.actions'

export interface DeviceRow {
  id: string
  deviceName: string | null
  userAgent: string | null
  ip: string | null
  lastSeenAt: Date
  createdAt: Date
}

export function DevicesList({ devices }: { devices: DeviceRow[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <ul className="divide-y rounded-lg border bg-card">
      {devices.map((d) => (
        <li key={d.id} className="flex items-center gap-3 p-4">
          <MonitorSmartphone className="size-5 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="font-bold">{d.deviceName ?? '—'}</p>
            <p className="truncate text-xs text-muted-foreground" dir="ltr">
              {d.ip ?? ''} · {d.userAgent ?? ''}
            </p>
            <p className="text-[11px] text-muted-foreground">آخر نشاط: {formatDateTime(d.lastSeenAt)}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await revokeDeviceAction(d.id)
                if (!r.ok) toast('error', r.error.message)
                else {
                  toast('success', t('common.success'))
                  router.refresh()
                }
              })
            }
          >
            {t('teacherPages.revoke')}
          </Button>
        </li>
      ))}
    </ul>
  )
}
