'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Input, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'
import { applyAiEvaluationAction } from '@/server/actions/ai.actions'
import { reviewSubmissionAction } from '@/server/actions/assignments.actions'

export interface RubricItemView {
  id: string
  label: string
  description: string | null
  maxPoints: string
  skillName: string | null
}

export interface ReviewValues {
  score: string
  strengths: string[]
  improvements: string[]
  notes: string | null
  rubricBreakdown?: Record<string, number> | null
}

export function ReviewForm({
  submissionId,
  maxScore,
  current,
  rubricItems,
  prefill,
  aiEvaluationId
}: {
  submissionId: string
  maxScore: string
  current: ReviewValues | null
  rubricItems?: RubricItemView[]
  /** قيم مبدئية من اقتراح الذكاء الاصطناعي (تُعبَّأ ثم يعدّلها الأستاذ) */
  prefill?: ReviewValues | null
  /** إن وُجد يُعتمد الاقتراح عبر مسار القرار (APPROVED/EDITED) بدل التصحيح اليدوي */
  aiEvaluationId?: string | null
}) {
  const router = useRouter()
  const action = aiEvaluationId ? applyAiEvaluationAction : reviewSubmissionAction
  const [state, formAction] = useActionState(action, null)
  const init = prefill ?? current
  const [breakdown, setBreakdown] = useState<Record<string, number>>(() => Object.fromEntries((rubricItems ?? []).map((i) => [i.id, init?.rubricBreakdown?.[i.id] ?? 0])))
  const total = Object.values(breakdown).reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0)
  useEffect(() => {
    if (state?.ok) {
      toast('success', t('assignments.reviewSaved'))
      router.refresh()
    }
  }, [state, router])
  const hasRubric = !!rubricItems && rubricItems.length > 0
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="submissionId" value={submissionId} />
      {aiEvaluationId ? <input type="hidden" name="evaluationId" value={aiEvaluationId} /> : null}
      {hasRubric ? (
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-sm font-bold">{t('rubrics.breakdown')}</p>
          {rubricItems!.map((it) => (
            <div key={it.id} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{it.label}</p>
                {it.skillName ? <p className="text-[11px] text-muted-foreground">{it.skillName}</p> : null}
              </div>
              <Input
                name={`rubric_${it.id}`}
                type="number"
                min={0}
                max={Number(it.maxPoints)}
                step="0.25"
                value={breakdown[it.id] ?? 0}
                onChange={(e) => setBreakdown((b) => ({ ...b, [it.id]: Number(e.target.value) }))}
                className="w-20 text-center"
                dir="ltr"
                required
              />
              <span className="w-10 text-xs text-muted-foreground tabular">/ {Number(it.maxPoints)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t pt-2 text-sm">
            <span className="font-bold">{t('rubrics.total')}</span>
            <span className="text-lg font-extrabold tabular">
              {Math.round(total * 100) / 100} / {Number(maxScore)}
            </span>
          </div>
          <input type="hidden" name="score" value={total} />
        </div>
      ) : (
        <Field label={`${t('assignments.score')} / ${Number(maxScore)}`} htmlFor="score" error={fieldError(state, 'score')}>
          <Input id="score" name="score" type="number" min={0} max={Number(maxScore)} step="0.25" defaultValue={init ? Number(init.score) : ''} required className="w-32 text-lg font-bold" dir="ltr" />
        </Field>
      )}
      <Field label={t('assignments.strengths')} htmlFor="strengths" hint={t('assignments.oneLinePerItem')}>
        <Textarea id="strengths" name="strengths" rows={3} defaultValue={init?.strengths.join('\n') ?? ''} />
      </Field>
      <Field label={t('assignments.improvements')} htmlFor="improvements" hint={t('assignments.oneLinePerItem')}>
        <Textarea id="improvements" name="improvements" rows={3} defaultValue={init?.improvements.join('\n') ?? ''} />
      </Field>
      <Field label={t('assignments.notes')} htmlFor="notes">
        <Textarea id="notes" name="notes" rows={2} defaultValue={init?.notes ?? ''} />
      </Field>
      <FormError state={state} />
      <SubmitButton>{t('assignments.saveReview')}</SubmitButton>
    </form>
  )
}
