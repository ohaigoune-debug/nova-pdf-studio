'use client'

import { Square, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'
import { cancelSessionAction, closeSessionAction } from '@/server/actions/sessions.actions'

export function CloseSessionButton({ sessionId, afterClose, basePath = '/teacher' }: { sessionId: string; afterClose?: 'refresh' | 'sessions'; basePath?: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Square className="size-4" /> {t('sessions.end')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('sessions.end')}</DialogTitle>
          <DialogDescription>{t('sessions.endConfirm')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="destructive"
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await closeSessionAction(sessionId)
                if (!r.ok) {
                  toast('error', r.error.message)
                  return
                }
                toast('success', t('sessions.closedSummary', { present: r.data.present, late: r.data.late, absent: r.data.autoAbsent, suspended: r.data.suspended.length }), undefined, 8000)
                setOpen(false)
                if (afterClose === 'sessions') router.push(`${basePath}/sessions/${sessionId}`)
                else router.refresh()
              })
            }
          >
            {t('common.confirm')}
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t('common.cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CancelSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button
      variant="ghost"
      loading={pending}
      onClick={() => {
        if (!confirm(t('sessions.cancel') + '؟')) return
        start(async () => {
          const r = await cancelSessionAction(sessionId)
          if (!r.ok) toast('error', r.error.message)
          else {
            toast('success', t('common.success'))
            router.refresh()
          }
        })
      }}
    >
      <XCircle className="size-4" /> {t('sessions.cancel')}
    </Button>
  )
}
