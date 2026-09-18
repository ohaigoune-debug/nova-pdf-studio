'use client'

import { Loader2, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'
import { formatDateTime } from '@/lib/utils'
import { requestTeacherInsightsAction } from '@/server/actions/ai.actions'
import type { TeacherInsightsView } from '@/server/services/ai.service'

export function AiInsightsPanel({ insights }: { insights: TeacherInsightsView | null }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const working = insights?.status === 'QUEUED' || insights?.status === 'PROCESSING'
  useEffect(() => {
    if (!working) return
    const id = setInterval(() => router.refresh(), 3000)
    return () => clearInterval(id)
  }, [working, router])
  const generate = () =>
    start(async () => {
      const r = await requestTeacherInsightsAction()
      if (!r.ok) toast('error', r.error.message)
      else {
        toast('info', t('ai.insightsQueued'))
        router.refresh()
      }
    })
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> {t('ai.insightsTitle')}
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{t('ai.insightsHint')}</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={generate} loading={pending || working}>
          {t('ai.generateInsights')}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {working ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> {t('ai.pending')}
          </p>
        ) : null}
        {insights?.status === 'FAILED' ? <p className="text-destructive">{t('ai.failed')}</p> : null}
        {insights?.status === 'COMPLETED' && insights.summary ? (
          <>
            <p className="whitespace-pre-wrap leading-7">{insights.summary}</p>
            {insights.nextLessonSuggestions.length ? (
              <div>
                <p className="font-bold">{t('ai.nextLesson')}</p>
                <ol className="mt-1 list-decimal space-y-1 ps-5">
                  {insights.nextLessonSuggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </div>
            ) : null}
            <p className="text-[11px] text-muted-foreground">
              {t('ai.provider')}: {insights.provider} · {t('ai.generatedAt')} {formatDateTime(insights.generatedAt)}
            </p>
          </>
        ) : null}
        {!insights ? <p className="text-muted-foreground">{t('ai.noInsightsYet')}</p> : null}
      </CardContent>
    </Card>
  )
}
