'use client'

import { Download, FlaskConical, RefreshCw, Sprout } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, Progress } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { formatDateTime } from '@/lib/utils'
import { startBacSyncAction } from '@/server/actions/bac.actions'
import type { BacSyncStatus } from '@/server/services/bac-sync.service'

const MODE_AR = { all: 'جلب كل المواد', refresh: 'تحديث الروابط المحفوظة', trial: 'تجربة سريعة بلا حفظ' } as const
const PHASE_AR: Record<string, string> = { subjects: 'قراءة قائمة المواد', listing: 'قراءة صفحات المادة', exams: 'زيارة صفحات المواضيع', done: 'انتهى' }

/**
 * استيراد بكالوريات DzExams من اللوحة: مهمة خلفية، والتقدّم يُقرأ من الخادم كل بضع ثوانٍ.
 * روابط فقط، والمصدر مذكور لكل موضوع.
 */
export function BacImportCard({ status }: { status: BacSyncStatus }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const job = status.job
  const running = job?.status === 'QUEUED' || job?.status === 'PROCESSING'

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => router.refresh(), 5000)
    return () => clearInterval(id)
  }, [running, router])

  const launch = (mode: keyof typeof MODE_AR) => {
    if (mode === 'all' && !confirm('جلب كل المواد يستغرق من 20 إلى 60 دقيقة (طلب واحد كل ثانية احتراماً للمصدر). يعمل في الخلفية ويمكنك مغادرة الصفحة. نبدأ؟')) return
    if (mode === 'refresh' && !confirm('يعيد زيارة كل المواضيع المحفوظة لتحديث روابطها. يستغرق وقتاً مماثلاً للجلب الأول. نبدأ؟')) return
    start(async () => {
      const r = await startBacSyncAction({ mode })
      if (!r.ok) toast('error', r.error.message)
      else {
        toast('success', r.data.reused ? 'هناك مهمة جارية بالفعل' : 'بدأ الجلب في الخلفية')
        router.refresh()
      }
    })
  }

  const p = job?.progress ?? {}
  const pct = job ? (job.status === 'COMPLETED' ? 100 : p.subjects ? Math.round((Math.max(0, (p.subjectIndex ?? 1) - 1) / p.subjects) * 100) : 0) : 0

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="size-5 text-primary" /> بكالوريات DzExams
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={status.saved ? 'success' : 'muted'}>{status.saved} موضوعاً محفوظاً</Badge>
          <Badge variant="secondary">{status.withDirectLink} برابط تنزيل مباشر</Badge>
          <Badge variant="secondary">{status.subjects} مادة</Badge>
          {status.lastFetchedAt ? <span className="text-xs text-muted-foreground">آخر جلب: {formatDateTime(status.lastFetchedAt)}</span> : null}
          {status.saved ? (
            <Link href="/past-bac" className="text-xs text-primary underline">
              التبويب العام «بكالوريات سابقة»
            </Link>
          ) : null}
        </div>

        {!status.inlineWorker ? <Alert tone="warning">العامل الداخلي معطّل (JOBS_INLINE_WORKER=0): مهمة الجلب الطويلة لا تعمل إلا به أو بالعامل المستقل «npm run jobs:worker».</Alert> : null}

        {job ? (
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={job.status === 'COMPLETED' ? 'success' : job.status === 'FAILED' ? 'destructive' : 'default'}>
                {job.status === 'COMPLETED' ? 'اكتملت' : job.status === 'FAILED' ? 'فشلت' : job.status === 'PROCESSING' ? 'قيد التنفيذ' : 'في الانتظار'}
              </Badge>
              <span className="font-semibold">{MODE_AR[job.mode]}</span>
              <span className="text-xs text-muted-foreground">{formatDateTime(job.startedAt ?? job.createdAt)}</span>
              {running && p.phase ? (
                <span className="text-xs text-muted-foreground">
                  · {PHASE_AR[p.phase] ?? p.phase}
                  {p.subject ? ` — ${p.subject} (${p.subjectIndex}/${p.subjects})` : ''}
                </span>
              ) : null}
            </div>
            {running ? <Progress value={pct} /> : null}
            {p.phase ? (
              <p className="text-xs text-muted-foreground" dir="auto">
                صفحات مقروءة {p.listings ?? 0} · مواضيع {p.found ?? 0} · زيارات {p.visited ?? 0}/{p.toVisit ?? 0} · حُفظ {p.saved ?? 0} · روابط مباشرة {p.withDirectLink ?? 0} · أخطاء {p.errors ?? 0}
              </p>
            ) : null}
            {job.error ? (
              <p className="font-mono text-xs text-destructive" dir="ltr">
                {job.error}
              </p>
            ) : null}
            {job.logs.length ? (
              <details open={running || job.result?.found === 0}>
                <summary className="cursor-pointer text-xs text-muted-foreground">سجلّ المهمة ({job.logs.length} سطراً)</summary>
                <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs" dir="auto">
                  {job.logs.slice(-40).join('\n')}
                </pre>
              </details>
            ) : null}
            {job.status === 'COMPLETED' && job.result?.found === 0 ? (
              <Alert tone="warning">لم يُعثر على أي موضوع. إن كان السجلّ يذكر 403 أو 429 فالمصدر يحجب الزحف؛ وإن ذكر «لم تُقرأ المواد» فبنية الصفحات تغيّرت وتحتاج تعديلاً في الشيفرة. أرسل السجلّ للمطوّر.</Alert>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => launch('all')} loading={pending} disabled={running}>
            <Sprout className="size-4" /> جلب كل المواد
          </Button>
          <Button size="sm" variant="outline" onClick={() => launch('trial')} loading={pending} disabled={running}>
            <FlaskConical className="size-4" /> تجربة سريعة (مادة واحدة، بلا حفظ)
          </Button>
          <Button size="sm" variant="ghost" onClick={() => launch('refresh')} loading={pending} disabled={running || !status.saved}>
            <RefreshCw className="size-4" /> تحديث الروابط المحفوظة
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">الجلب تراكمي: ما حُفظ لا يُزار ثانية، فإعادة التشغيل بعد انقطاع تكمل من حيث توقّفت. لا يُخزَّن أي ملف؛ الروابط تفتح عند DzExams مع ذكر المصدر.</p>
      </CardContent>
    </Card>
  )
}
