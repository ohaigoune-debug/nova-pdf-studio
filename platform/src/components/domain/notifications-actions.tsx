'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'
import { markAllReadAction } from '@/server/actions/notifications.actions'

export function MarkAllReadButton() {
  const [pending, start] = useTransition()
  return (
    <Button
      variant="outline"
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await markAllReadAction()
          if (!r.ok) toast('error', r.error.message)
        })
      }
    >
      {t('notifications.markAllRead')}
    </Button>
  )
}
