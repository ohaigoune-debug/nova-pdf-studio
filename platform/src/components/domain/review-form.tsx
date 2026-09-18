'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Input, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'
import { reviewSubmissionAction } from '@/server/actions/assignments.actions'

export function ReviewForm({ submissionId, maxScore, current }: { submissionId: string; maxScore: string; current: { score: string; strengths: string[]; improvements: string[]; notes: string | null } | null }) {
  const router = useRouter()
  const [state, action] = useActionState(reviewSubmissionAction, null)
  useEffect(() => {
    if (state?.ok) {
      toast('success', t('assignments.reviewSaved'))
      router.refresh()
    }
  }, [state, router])
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="submissionId" value={submissionId} />
      <Field label={`${t('assignments.score')} / ${Number(maxScore)}`} htmlFor="score" error={fieldError(state, 'score')}>
        <Input id="score" name="score" type="number" min={0} max={Number(maxScore)} step="0.25" defaultValue={current ? Number(current.score) : ''} required className="w-32 text-lg font-bold" dir="ltr" />
      </Field>
      <Field label={t('assignments.strengths')} htmlFor="strengths" hint={t('assignments.oneLinePerItem')}>
        <Textarea id="strengths" name="strengths" rows={3} defaultValue={current?.strengths.join('\n') ?? ''} />
      </Field>
      <Field label={t('assignments.improvements')} htmlFor="improvements" hint={t('assignments.oneLinePerItem')}>
        <Textarea id="improvements" name="improvements" rows={3} defaultValue={current?.improvements.join('\n') ?? ''} />
      </Field>
      <Field label={t('assignments.notes')} htmlFor="notes">
        <Textarea id="notes" name="notes" rows={2} defaultValue={current?.notes ?? ''} />
      </Field>
      <FormError state={state} />
      <SubmitButton>{t('assignments.saveReview')}</SubmitButton>
    </form>
  )
}
