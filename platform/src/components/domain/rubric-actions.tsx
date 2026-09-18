'use client'

import { Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'
import { deleteRubricAction } from '@/server/actions/quizzes.actions'

export function RubricRowActions({ id }: { id: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <div className="flex justify-end gap-1">
      <Button asChild size="sm" variant="ghost">
        <Link href={`/teacher/rubrics/${id}/edit`}>
          <Pencil className="size-4" /> {t('common.edit')}
        </Link>
      </Button>
      <Button
        size="sm"
        variant="ghost"
        loading={pending}
        onClick={() => {
          if (!confirm(t('rubrics.deleteConfirm'))) return
          start(async () => {
            const r = await deleteRubricAction(id)
            if (!r.ok) toast('error', r.error.message)
            else router.refresh()
          })
        }}
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </div>
  )
}
