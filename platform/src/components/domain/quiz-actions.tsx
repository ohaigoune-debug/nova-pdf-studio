'use client'

import { Play, Trash2 } from 'lucide-react'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'
import { deleteQuizAction, startAttemptAction } from '@/server/actions/quizzes.actions'

export function DeleteQuizButton({ id }: { id: string }) {
  const [pending, start] = useTransition()
  return (
    <Button
      variant="ghost"
      loading={pending}
      onClick={() => {
        if (!confirm(t('quizzes.deleteConfirm'))) return
        start(async () => {
          const r = await deleteQuizAction(id)
          if (r && !r.ok) toast('error', r.error.message)
        })
      }}
    >
      <Trash2 className="size-4 text-destructive" /> {t('common.delete')}
    </Button>
  )
}

export function StartAttemptButton({ quizId, label }: { quizId: string; label?: string }) {
  const [pending, start] = useTransition()
  return (
    <Button
      size="lg"
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await startAttemptAction(quizId)
          if (r && !r.ok) toast('error', r.error.message)
        })
      }
    >
      <Play className="size-4" /> {label ?? t('quizzes.start')}
    </Button>
  )
}
