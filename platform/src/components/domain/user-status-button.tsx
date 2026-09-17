'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'
import { setUserStatusAction } from '@/server/actions/admin.actions'

export function UserStatusButton({ userId, status }: { userId: string; status: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const next = status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
  return (
    <Button
      size="sm"
      variant={status === 'ACTIVE' ? 'outline' : 'success'}
      loading={pending}
      onClick={() => {
        if (next === 'DISABLED' && !confirm(t('admin.disable') + '؟')) return
        start(async () => {
          const r = await setUserStatusAction(userId, next)
          if (!r.ok) toast('error', r.error.message)
          else {
            toast('success', t('common.success'))
            router.refresh()
          }
        })
      }}
    >
      {status === 'ACTIVE' ? t('admin.disable') : t('admin.enable')}
    </Button>
  )
}
