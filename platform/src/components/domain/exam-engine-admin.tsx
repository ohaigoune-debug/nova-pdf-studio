'use client'

import { CheckCircle2, Cog, Download, RefreshCw, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from '@/components/ui/toast'
import { formatDateTime } from '@/lib/utils'
import { approveDocumentAction, processDocumentsAction, registerBacDocumentsAction, rejectDocumentAction, reprocessDocumentAction } from '@/server/actions/exam-engine.actions'
import { DOC_STATUS_AR, DOC_TYPE_AR } from '@/lib/exam-engine-labels'
import type { DocumentListItem, EngineStats } from '@/server/services/exam-engine.service'

const STATUS_VARIANT: Record<string, 'muted' | 'default' | 'warning' | 'success' | 'destructive'> = { PENDING: 'muted', PROCESSING: 'default', NEEDS_REVIEW: 'warning', PUBLISHED: 'success', FAILED: 'destructive' }

/** أزرار التشغيل: تسجيل الوثائق من المكتبة، ومعالجة المعلّق في الخلفية (التقدّم يُقرأ بالتحديث) */
export function EngineControls({ stats }: { stats: EngineStats }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  useEffect(() => {
    if (!stats.queue.pending) return
    const id = setInterval(() => router.refresh(), 5000)
    return () => clearInterval(id)
  }, [stats.queue.pending, router])
  const register = () =>
    start(async () => {
      const r = await registerBacDocumentsAction({})
      if (!r.ok) return toast('error', r.error.message)
      toast('success', r.data.registered ? `سُجّلت ${r.data.registered} وثيقة (رياضيات 3AS) بانتظار المعالجة` : r.data.candidates ? 'كل الوثائق مسجَّلة سلفاً' : 'لا بكالوريات رياضيات 3AS في المكتبة بعد — اجلب DzExams من «المنهاج والمكتبة» أولاً')
      router.refresh()
    })
  const process = () =>
    start(async () => {
      const r = await processDocumentsAction({ limit: 20 })
      if (!r.ok) return toast('error', r.error.message)
      toast('success', r.data.reused ? 'المعالجة تعمل سلفاً' : `بدأت معالجة ${r.data.count} وثيقة في الخلفية`)
      router.refresh()
    })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cog className="size-5 text-primary" /> خطّ المعالجة
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          1) «تسجيل» يأخذ مواضيع البكالوريا الرسمية الموجودة في المكتبة (الرياضيات 3AS في هذه المرحلة) إلى سجلّ المعالجة. 2) «معالجة» تنزّل الملف وتخزّنه وتقرأ نصّه وتقسّمه تمارين بالذكاء الاصطناعي وتصنّفها بالمنهاج وتربط الحلّ، ثم تضعها
          بانتظار مراجعتك. 3) «اعتماد» ينشر تمارين الوثيقة في البنك المركزي.
        </p>
        {!stats.ai.configured ? <Alert tone="warning">مفتاح الذكاء الاصطناعي غير مضبوط: المعالجة تحتاجه (اضبطه من «الذكاء الاصطناعي»).</Alert> : null}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={register} loading={pending}>
            <Download className="size-4" /> تسجيل بكالوريات الرياضيات 3AS ({stats.archive.candidates} غير مسجَّلة)
          </Button>
          <Button onClick={process} loading={pending} disabled={!stats.ai.configured || stats.docs.PENDING === 0 || stats.queue.pending}>
            <Cog className="size-4" /> معالجة المعلّق ({stats.docs.PENDING})
          </Button>
          <Button asChild variant="ghost">
            <Link href="/bac">بنك البكالوريا العام</Link>
          </Button>
        </div>
        {stats.queue.pending ? (
          <Alert tone="info">
            المعالجة تعمل الآن: {stats.queue.processed} / {stats.queue.total} وثيقة. تُحدَّث الصفحة تلقائياً.
          </Alert>
        ) : stats.queue.lastError ? (
          <Alert tone="destructive">آخر مهمة فشلت: {stats.queue.lastError}</Alert>
        ) : stats.queue.lastFinishedAt ? (
          <p className="text-xs text-muted-foreground">آخر معالجة انتهت في {formatDateTime(stats.queue.lastFinishedAt)}.</p>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function DocumentsTable({ docs }: { docs: DocumentListItem[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const approve = (id: string) =>
    start(async () => {
      const r = await approveDocumentAction(id)
      if (!r.ok) return toast('error', r.error.message)
      toast('success', `اعتُمد ${r.data.approved} تمريناً ونُشر في البنك المركزي`)
      router.refresh()
    })
  const reject = (id: string) =>
    start(async () => {
      const reason = prompt('سبب الرفض (اختياري):')
      if (reason === null) return
      const r = await rejectDocumentAction(id, reason)
      if (!r.ok) return toast('error', r.error.message)
      toast('success', 'رُفضت تمارين الوثيقة')
      router.refresh()
    })
  const reprocess = (id: string) =>
    start(async () => {
      const r = await reprocessDocumentAction(id)
      if (!r.ok) return toast('error', r.error.message)
      toast('success', 'أُعيدت الوثيقة إلى الطابور')
      router.refresh()
    })
  if (docs.length === 0) return <p className="p-4 text-sm text-muted-foreground">لا وثائق مسجَّلة بعد.</p>
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>الوثيقة</TableHead>
          <TableHead>التصنيف</TableHead>
          <TableHead>الحالة</TableHead>
          <TableHead className="text-center">تمارين</TableHead>
          <TableHead className="text-center">تكلفة $</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {docs.map((d) => (
          <TableRow key={d.id}>
            <TableCell>
              <div className="max-w-md">
                <p className="font-semibold leading-snug">
                  {d.resourceId ? (
                    <Link href={`/bac/${d.resourceId}`} className="hover:underline">
                      {d.title}
                    </Link>
                  ) : (
                    d.title
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {DOC_TYPE_AR[d.docType as keyof typeof DOC_TYPE_AR] ?? d.docType}
                  {d.examYear ? ` ${d.examYear}` : ''} · {d.sourceName ?? '—'}
                  {d.sourceUrl ? (
                    <>
                      {' '}
                      ·{' '}
                      <a href={d.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
                        المصدر
                      </a>
                    </>
                  ) : null}
                </p>
              </div>
            </TableCell>
            <TableCell className="text-xs">{[d.subjectName, d.levelName, d.streamName].filter(Boolean).join(' · ') || '—'}</TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANT[d.status] ?? 'muted'}>{DOC_STATUS_AR[d.status as keyof typeof DOC_STATUS_AR] ?? d.status}</Badge>
              {d.error ? <p className="mt-1 max-w-[16rem] text-[11px] text-destructive">{d.error}</p> : null}
              {d.duplicatesCount ? <p className="text-[11px] text-muted-foreground">{d.duplicatesCount} مكرّر أُهمل</p> : null}
            </TableCell>
            <TableCell className="text-center tabular">
              {d.published ? <span className="text-success">{d.published}</span> : null}
              {d.published && d.review ? ' / ' : ''}
              {d.review ? <span className="text-amber-700">{d.review} للمراجعة</span> : null}
              {!d.published && !d.review ? '—' : null}
            </TableCell>
            <TableCell className="text-center tabular text-xs">{Number(d.aiCostUsd) ? Number(d.aiCostUsd).toFixed(4) : '—'}</TableCell>
            <TableCell>
              <div className="flex justify-end gap-1">
                {d.status === 'NEEDS_REVIEW' ? (
                  <>
                    <Button size="sm" variant="outline" loading={pending} onClick={() => approve(d.id)}>
                      <CheckCircle2 className="size-4" /> اعتماد
                    </Button>
                    <Button size="sm" variant="ghost" loading={pending} onClick={() => reject(d.id)} title="رفض">
                      <XCircle className="size-4 text-destructive" />
                    </Button>
                  </>
                ) : null}
                {d.status === 'FAILED' || d.status === 'PUBLISHED' || d.status === 'NEEDS_REVIEW' ? (
                  <Button size="sm" variant="ghost" loading={pending} onClick={() => reprocess(d.id)} title="إعادة المعالجة">
                    <RefreshCw className="size-4" />
                  </Button>
                ) : null}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
