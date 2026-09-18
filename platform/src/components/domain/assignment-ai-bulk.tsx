'use client'

import { CheckCheck, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'
import { applyAllAiEvaluationsAction, requestAiEvaluationForAssignmentAction } from '@/server/actions/ai.actions'
import type { AssignmentAiSummary } from '@/server/services/ai.service'

/** لوحة "التصحيح دفعة واحدة" للواجب: طلب اقتراحات للكل ثم اعتمادها فوق حدّ ثقة */
export function AssignmentAiBulk({ assignmentId, summary }: { assignmentId: string; summary: AssignmentAiSummary }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [minConfidence, setMinConfidence] = useState('0.7')

  // ما دامت هناك اقتراحات قيد المعالجة نحدّث الصفحة كل 5 ثوانٍ
  useEffect(() => {
    if (summary.pending === 0) return
    const iv = setInterval(() => router.refresh(), 5000)
    return () => clearInterval(iv)
  }, [summary.pending, router])

  if (summary.submitted === 0) return null

  const stat = (label: string, value: number, cls: string) => (
    <div className={`rounded-md p-2 text-center ${cls}`}>
      <p className="text-xl font-extrabold tabular">{value}</p>
      <p className="text-[11px]">{label}</p>
    </div>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" /> {t('ai.bulkTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('ai.bulkHint')}</p>
        <div className="grid grid-cols-4 gap-2">
          {stat(t('ai.bulkAwaiting'), summary.awaiting, 'bg-muted')}
          {stat(t('ai.bulkPending'), summary.pending, 'bg-warning/20')}
          {stat(t('ai.bulkSuggested'), summary.suggested, 'bg-primary/10 text-primary')}
          {stat(t('ai.bulkReviewed'), summary.reviewed, 'bg-success/10 text-success')}
        </div>
        {summary.pending > 0 ? <p className="text-xs text-muted-foreground">{t('ai.bulkRefreshing')}</p> : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Button
            disabled={pending || summary.awaiting === 0}
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await requestAiEvaluationForAssignmentAction(assignmentId)
                if (!r.ok) toast('error', r.error.message)
                else {
                  toast('success', t('ai.bulkRequested', { queued: r.data.queued, skipped: r.data.skipped }))
                  router.refresh()
                }
              })
            }
          >
            <Sparkles className="size-4" /> {t('ai.bulkRequest')} ({summary.awaiting})
          </Button>
          <div className="flex items-end gap-2">
            <label className="text-xs font-semibold">
              {t('ai.bulkMinConfidence')}
              <Select value={minConfidence} onChange={(e) => setMinConfidence(e.target.value)} className="mt-1 w-28">
                <option value="0">0%</option>
                <option value="0.5">50%</option>
                <option value="0.7">70%</option>
                <option value="0.85">85%</option>
              </Select>
            </label>
            <Button
              variant="secondary"
              disabled={pending || summary.suggested === 0}
              loading={pending}
              onClick={() => {
                if (!confirm(t('ai.bulkApplyConfirm', { n: summary.suggested }))) return
                start(async () => {
                  const r = await applyAllAiEvaluationsAction(assignmentId, Number(minConfidence))
                  if (!r.ok) toast('error', r.error.message)
                  else {
                    toast('success', t('ai.bulkApplied', { approved: r.data.approved, below: r.data.belowThreshold }), undefined, 8000)
                    router.refresh()
                  }
                })
              }}
            >
              <CheckCheck className="size-4" /> {t('ai.bulkApply')} ({summary.suggested})
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
