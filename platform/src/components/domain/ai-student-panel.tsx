'use client'

import { Loader2, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'
import { formatDateTime } from '@/lib/utils'
import { requestStudentAnalysisAction } from '@/server/actions/ai.actions'
import type { StudentAnalysisView } from '@/server/services/ai.service'

function List({ title, items, tone }: { title: string; items: string[]; tone: 'success' | 'warning' | 'info' }) {
  if (items.length === 0) return null
  const color = { success: 'text-success', warning: 'text-amber-700 dark:text-amber-300', info: 'text-primary' }[tone]
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

/** تحليل الذكاء الاصطناعي لملف الطالب (للأستاذ فقط؛ لا يراه الطالب) */
export function AiStudentPanel({ studentId, analysis }: { studentId: string; analysis: StudentAnalysisView | null }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const working = analysis?.status === 'QUEUED' || analysis?.status === 'PROCESSING'
  useEffect(() => {
    if (!working) return
    const id = setInterval(() => router.refresh(), 3000)
    return () => clearInterval(id)
  }, [working, router])
  const generate = () =>
    start(async () => {
      const r = await requestStudentAnalysisAction(studentId)
      if (!r.ok) toast('error', r.error.message)
      else {
        toast('info', t('ai.pending'))
        router.refresh()
      }
    })
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" /> {t('ai.studentTitle')}
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{t('ai.studentHint')}</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={generate} loading={pending || working}>
          {analysis?.status === 'COMPLETED' ? t('ai.requestAgain') : t('ai.analyze')}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {working ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> {t('ai.pending')}
          </p>
        ) : null}
        {analysis?.status === 'FAILED' ? <p className="text-destructive">{t('ai.failed')}</p> : null}
        {analysis?.status === 'COMPLETED' && analysis.summary ? (
          <>
            <p className="leading-7">{analysis.summary}</p>
            <List title={t('ai.strengths')} items={analysis.strengths} tone="success" />
            <List title={t('ai.weaknesses')} items={analysis.weaknesses} tone="warning" />
            <List title={t('ai.recommendations')} items={analysis.recommendations} tone="info" />
            <p className="text-[11px] text-muted-foreground">
              {t('ai.provider')}: {analysis.provider} · {t('ai.generatedAt')} {formatDateTime(analysis.generatedAt)}
            </p>
          </>
        ) : null}
        {!analysis ? <p className="text-muted-foreground">{t('ai.noAnalysisYet')}</p> : null}
      </CardContent>
    </Card>
  )
}
