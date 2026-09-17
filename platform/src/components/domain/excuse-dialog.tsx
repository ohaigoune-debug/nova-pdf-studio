'use client'

import { FileCheck2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'
import { excuseAbsenceAction } from '@/server/actions/attendance.actions'

export function ExcuseDialog({ recordId, studentName, size = 'sm' }: { recordId: string; studentName?: string; size?: 'sm' | 'default' }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [state, action] = useActionState(excuseAbsenceAction, null)
  useEffect(() => {
    if (state?.ok) {
      toast('success', t('sessions.excusedDone'), state.data.canReactivate ? t('sessions.canReactivate') : undefined, 7000)
      setOpen(false)
      router.refresh()
    }
  }, [state, router])
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={size} variant="outline">
          <FileCheck2 className="size-4" /> {t('sessions.excuse')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('sessions.excuse')}</DialogTitle>
          {studentName ? <DialogDescription>{studentName}</DialogDescription> : null}
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="recordId" value={recordId} />
          <Field label={t('sessions.excuseReason')} htmlFor="reason" error={fieldError(state, 'reason')}>
            <Input id="reason" name="reason" placeholder={t('sessions.excuseReasonPlaceholder')} required autoFocus />
          </Field>
          <Field label={t('sessions.excuseNotes')} htmlFor="notes">
            <Textarea id="notes" name="notes" />
          </Field>
          <Field label={t('sessions.excuseFile')} htmlFor="fileUrl">
            <Input id="fileUrl" name="fileUrl" type="url" dir="ltr" placeholder="https://" />
          </Field>
          <FormError state={state} />
          <SubmitButton className="w-full">{t('common.confirm')}</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}
