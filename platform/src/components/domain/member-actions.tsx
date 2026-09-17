'use client'

import { Archive, LogOut, PauseCircle, RefreshCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'
import { archiveGroupAction, reactivateStudentAction, setEnrollmentStatusAction } from '@/server/actions/groups.actions'

export function MemberActions({ groupStudentId, status, compact }: { groupStudentId: string; status: string; compact?: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, successMsg: string) =>
    start(async () => {
      const r = await fn()
      if (!r.ok) toast('error', r.error?.message ?? t('common.error'))
      else {
        toast('success', successMsg)
        router.refresh()
      }
    })
  const size = compact ? 'sm' : 'default'
  if (status === 'SUSPENDED' || status === 'SUSPENDED_DUE_TO_ABSENCE' || status === 'INACTIVE' || status === 'LEFT_GROUP') {
    return (
      <Button size={size} variant="success" loading={pending} onClick={() => run(() => reactivateStudentAction(groupStudentId), t('groups.reactivated'))}>
        <RefreshCcw className="size-4" /> {t('groups.reactivate')}
      </Button>
    )
  }
  return (
    <div className="flex flex-wrap gap-1">
      <Button
        size={size}
        variant="ghost"
        loading={pending}
        onClick={() => {
          const reason = prompt(t('common.reason')) ?? undefined
          if (reason === undefined) return
          run(() => setEnrollmentStatusAction(groupStudentId, 'SUSPENDED', reason), t('common.success'))
        }}
      >
        <PauseCircle className="size-4" /> {t('groups.suspend')}
      </Button>
      <Button
        size={size}
        variant="ghost"
        loading={pending}
        onClick={() => {
          if (!confirm(t('groups.markLeft') + '؟')) return
          run(() => setEnrollmentStatusAction(groupStudentId, 'LEFT_GROUP'), t('common.success'))
        }}
      >
        <LogOut className="size-4" /> {t('groups.markLeft')}
      </Button>
    </div>
  )
}

export function ArchiveGroupButton({ groupId }: { groupId: string }) {
  const [pending, start] = useTransition()
  return (
    <Button
      variant="outline"
      loading={pending}
      onClick={() => {
        if (!confirm(t('groups.archiveConfirm'))) return
        start(async () => {
          const r = await archiveGroupAction(groupId)
          if (r && !r.ok) toast('error', r.error.message)
        })
      }}
    >
      <Archive className="size-4" /> {t('groups.archive')}
    </Button>
  )
}
