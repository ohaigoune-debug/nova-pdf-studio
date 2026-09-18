'use client'

import { Bot, Loader2, RefreshCw, Sparkles, ThumbsDown, Wand2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'
import { formatDateTime } from '@/lib/utils'
import { rejectAiEvaluationAction, requestAiEvaluationAction } from '@/server/actions/ai.actions'
import type { AiEvaluationView } from '@/server/services/ai.service'
import { ReviewForm, type ReviewValues, type RubricItemView } from './review-form'

function List({ title, items, tone }: { title: string; items: string[]; tone: 'success' | 'warning' | 'destructive' | 'muted' }) {
  if (items.length === 0) return null
  const color = { success: 'text-success', warning: 'text-amber-700 dark:text-amber-300', destructive: 'text-destructive', muted: 'text-muted-foreground' }[tone]
  return (
    <div>
      <p className={`text-xs font-bold ${color}`}>{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 ps-5 text-sm">
        {items.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  )
}

/**
 * لوحة الأستاذ: اقتراح الذكاء الاصطناعي (إن وُجد) + نموذج التصحيح.
 * الاعتماد يمرّ دائماً عبر نموذج الأستاذ؛ الاقتراح لا يُطبَّق تلقائياً.
 */
export function AiReviewPanel({
  submissionId,
  maxScore,
  current,
  rubricItems,
  evaluation
}: {
  submissionId: string
  maxScore: string
  current: ReviewValues | null
  rubricItems?: RubricItemView[]
  evaluation: AiEvaluationView | null
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [prefill, setPrefill] = useState<ReviewValues | null>(null)
  const isPending = evaluation?.status === 'PENDING'

  // تحديث تلقائي أثناء المعالجة
  useEffect(() => {
    if (!isPending) return
    const id = setInterval(() => router.refresh(), 3000)
    return () => clearInterval(id)
  }, [isPending, router])

  const request = () =>
    start(async () => {
      const r = await requestAiEvaluationAction(submissionId)
      if (!r.ok) toast('error', r.error.message)
      else {
        toast('info', t('ai.requested'))
        router.refresh()
      }
    })

  const reject = () => {
    if (!evaluation || !confirm(t('ai.rejectConfirm'))) return
    start(async () => {
      const r = await rejectAiEvaluationAction(evaluation.id)
      if (!r.ok) toast('error', r.error.message)
      else {
        toast('success', t('ai.rejected'))
        setPrefill(null)
        router.refresh()
      }
    })
  }

  const apply = () => {
    if (!evaluation || evaluation.suggestedScore === null) return
    setPrefill({
      score: String(evaluation.suggestedScore),
      strengths: evaluation.strengths,
      improvements: evaluation.weaknesses,
      notes: evaluation.teacherNotesSuggestion,
      rubricBreakdown: evaluation.rubricBreakdown
    })
    toast('info', t('ai.applied'))
  }

  const decided = !!evaluation?.decision
  const canDecide = evaluation?.status === 'COMPLETED' && !decided
  const decisionLabel: Record<string, string> = { APPROVED: t('ai.decisionApproved'), EDITED: t('ai.decisionEdited'), REJECTED: t('ai.decisionRejected') }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Bot className="size-4 text-primary" /> {t('ai.panelTitle')}
          </p>
          {evaluation?.decision ? <Badge variant={evaluation.decision.decision === 'REJECTED' ? 'destructive' : 'success'}>{decisionLabel[evaluation.decision.decision] ?? evaluation.decision.decision}</Badge> : null}
        </div>
        <p className="mb-3 text-[11px] text-muted-foreground">{t('ai.panelHint')}</p>

        {!evaluation || (evaluation.status === 'FAILED' && !decided) ? (
          <div className="space-y-2">
            {evaluation?.status === 'FAILED' ? <Alert tone="warning">{t('ai.failed')}</Alert> : null}
            <Button type="button" variant="outline" size="sm" onClick={request} loading={pending}>
              {evaluation ? <RefreshCw className="size-4" /> : <Sparkles className="size-4" />} {evaluation ? t('ai.requestAgain') : t('ai.request')}
            </Button>
          </div>
        ) : null}

        {isPending ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> {t('ai.pending')}
          </p>
        ) : null}

        {evaluation?.status === 'COMPLETED' ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <p className="text-[11px] text-muted-foreground">{t('ai.suggestedScore')}</p>
                <p className="text-2xl font-extrabold tabular">
                  {evaluation.suggestedScore} <span className="text-sm font-normal text-muted-foreground">/ {Number(maxScore)}</span>
                </p>
              </div>
              {evaluation.confidence !== null ? (
                <div>
                  <p className="text-[11px] text-muted-foreground">{t('ai.confidence')}</p>
                  <p className="text-lg font-bold tabular">{Math.round(evaluation.confidence * 100)}%</p>
                </div>
              ) : null}
            </div>
            {evaluation.rubricBreakdown && rubricItems?.length ? (
              <ul className="space-y-0.5 text-xs">
                {rubricItems.map((it) => (
                  <li key={it.id} className="flex justify-between gap-2">
                    <span className="truncate">{it.label}</span>
                    <span className="tabular">
                      {evaluation.rubricBreakdown?.[it.id] ?? 0} / {Number(it.maxPoints)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <List title={t('ai.strengths')} items={evaluation.strengths} tone="success" />
            <List title={t('ai.weaknesses')} items={evaluation.weaknesses} tone="warning" />
            <List title={t('ai.mistakes')} items={evaluation.mistakes} tone="destructive" />
            {evaluation.skillsDetected.length || evaluation.skillsToImprove.length ? (
              <div className="flex flex-wrap gap-1">
                {evaluation.skillsDetected.map((s) => (
                  <Badge key={`d-${s}`} variant="success">
                    {s}
                  </Badge>
                ))}
                {evaluation.skillsToImprove.map((s) => (
                  <Badge key={`i-${s}`} variant="warning">
                    {s}
                  </Badge>
                ))}
              </div>
            ) : null}
            {evaluation.teacherNotesSuggestion ? <p className="rounded-md bg-background p-2 text-xs leading-6">{evaluation.teacherNotesSuggestion}</p> : null}
            <p className="text-[11px] text-muted-foreground">
              {t('ai.provider')}: {evaluation.provider} · {t('ai.model')}: <span dir="ltr">{evaluation.model}</span> · {t('ai.generatedAt')} {formatDateTime(evaluation.completedAt ?? evaluation.createdAt)}
            </p>
            {canDecide ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={apply} disabled={pending}>
                  <Wand2 className="size-4" /> {t('ai.apply')}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={reject} loading={pending}>
                  <ThumbsDown className="size-4" /> {t('ai.reject')}
                </Button>
              </div>
            ) : null}
            {decided ? (
              <Button type="button" variant="outline" size="sm" onClick={request} loading={pending}>
                <RefreshCw className="size-4" /> {t('ai.requestAgain')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <ReviewForm
        key={prefill ? `ai-${evaluation?.id}` : 'manual'}
        submissionId={submissionId}
        maxScore={maxScore}
        current={current}
        rubricItems={rubricItems}
        prefill={prefill}
        aiEvaluationId={prefill && canDecide ? evaluation!.id : null}
      />
    </div>
  )
}
