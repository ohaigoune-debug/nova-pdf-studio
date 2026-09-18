'use client'

import { Eye, EyeOff, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'
import { deleteContentAction, setContentPublishedAction } from '@/server/actions/content.actions'

export function ContentRowActions({ id, published }: { id: string; published: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <div className="flex justify-end gap-1">
      <Button
        size="sm"
        variant="ghost"
        loading={pending}
        onClick={() =>
          start(async () => {
            const r = await setContentPublishedAction(id, !published)
            if (!r.ok) toast('error', r.error.message)
            else router.refresh()
          })
        }
      >
        {published ? <EyeOff className="size-4" /> : <Eye className="size-4" />} {published ? t('contentMgmt.unpublish') : t('contentMgmt.publish')}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        loading={pending}
        onClick={() => {
          if (!confirm(t('contentMgmt.deleteConfirm'))) return
          start(async () => {
            const r = await deleteContentAction(id)
            if (!r.ok) toast('error', r.error.message)
            else {
              toast('success', t('contentMgmt.deleted'))
              router.refresh()
            }
          })
        }}
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
    </div>
  )
}
