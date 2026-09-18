'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect } from 'react'
import { FormError, SubmitButton } from '@/components/forms/form-bits'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'
import { reviewAttemptAction } from '@/server/actions/quizzes.actions'

export interface EssayItem {
  answerId: string
  prompt: string
  answerText: string | null
  points: number
  score: number | null
}

export function AttemptReviewForm({ attemptId, essays, autoScore, maxScore }: { attemptId: string; essays: EssayItem[]; autoScore: number; maxScore: number }) {
  const router = useRouter()
  const [state, action] = useActionState(reviewAttemptAction, null)
  useEffect(() => {
    if (state?.ok) {
      toast('success', t('quizzes.reviewSaved'))
      router.refresh()
    }
  }, [state, router])
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="attemptId" value={attemptId} />
      <p className="text-sm text-muted-foreground">
        {t('quizzes.autoScore')}: <b className="tabular">{autoScore}</b> / {maxScore}
      </p>
      {essays.map((e, i) => (
        <div key={e.answerId} className="space-y-2 rounded-lg border p-4">
          <p className="font-semibold">
            {i + 1}. {e.prompt}
          </p>
          <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm leading-7">{e.answerText?.trim() || '—'}</p>
          <div className="flex items-center gap-2">
            <Input name={`score_${e.answerId}`} type="number" min={0} max={e.points} step="0.25" defaultValue={e.score ?? ''} required className="w-24 text-center font-bold" dir="ltr" />
            <span className="text-sm text-muted-foreground tabular">/ {e.points}</span>
          </div>
        </div>
      ))}
      <FormError state={state} />
      <SubmitButton>{t('quizzes.finalize')}</SubmitButton>
    </form>
  )
}
