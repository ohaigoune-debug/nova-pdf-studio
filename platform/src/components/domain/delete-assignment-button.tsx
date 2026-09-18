'use client'

import { Trash2 } from 'lucide-react'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'
import { deleteAssignmentAction } from '@/server/actions/assignments.actions'

export function DeleteAssignmentButton({ id }: { id: string }) {
  const [pending, start] = useTransition()
  return (
    <Button
      variant="ghost"
      loading={pending}
      onClick={() => {
        if (!confirm(t('assignments.deleteConfirm'))) return
        start(async () => {
          const r = await deleteAssignmentAction(id)
          if (r && !r.ok) toast('error', r.error.message)
        })
      }}
    >
      <Trash2 className="size-4 text-destructive" /> {t('common.delete')}
    </Button>
  )
}
