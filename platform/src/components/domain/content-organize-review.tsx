'use client'

import { Sparkles, Wand2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Alert, EmptyState, Progress } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { formatDateTime } from '@/lib/utils'
import { applyOrganizeAction, requestContentOrganizeAction } from '@/server/actions/content.actions'
import type { OrganizeStatus } from '@/server/services/content-organize.service'

type Opt = { id: string; name: string }

/**
 * تنظيم الفيديوهات بالذكاء الاصطناعي: طلب ← مهمة خلفية ← اقتراحات (عنوان، ملخّص، محور)
 * يختار الأستاذ منها ما يطبّقه. لا يتغيّر شيء دون اختياره.
 */
export function ContentOrganizeReview({ status, levels, streams }: { status: OrganizeStatus; levels: Opt[]; streams: Opt[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [levelId, setLevelId] = useState('')
  const [streamId, setStreamId] = useState('')
  const job = status.job
  const running = job?.status === 'QUEUED' || job?.status === 'PROCESSING'
  const proposals = useMemo(() => job?.result?.proposals ?? [], [job])
  const applied = useMemo(() => new Set(job?.result?.appliedIds ?? []), [job])
  const [picked, setPicked] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    setPicked(new Set(proposals.filter((p) => p.changed && !applied.has(p.contentId)).map((p) => p.contentId)))
  }, [proposals, applied])

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => router.refresh(), 4000)
    return () => clearInterval(id)
  }, [running, router])

  const request = () =>
    start(async () => {
      const r = await requestContentOrganizeAction({ levelId: levelId || null, streamId: streamId || null })
      if (!r.ok) toast('error', r.error.message)
      else {
        toast('success', r.data.reused ? 'هناك تنظيم جارٍ بالفعل' : `بدأ تنظيم ${r.data.lessons} فيديو في الخلفية`)
        router.refresh()
      }
    })
  const apply = () => {
    if (!job || picked.size === 0) return
    start(async () => {
      const r = await applyOrganizeAction(job.id, [...picked])
      if (!r.ok) toast('error', r.error.message)
      else {
        toast('success', `طُبّق على ${r.data.applied} درساً`)
        router.refresh()
      }
    })
  }
  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const changedOpen = proposals.filter((p) => p.changed && !applied.has(p.contentId))

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="size-5 text-primary" /> تنظيم جديد
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!status.aiConfigured ? <Alert tone="warning">الذكاء الاصطناعي غير مضبوط: يُدخل المشرف المفتاح من «إعدادات الذكاء الاصطناعي».</Alert> : null}
          <p className="text-muted-foreground">
            يقرأ الذكاء الاصطناعي عناوين فيديوهاتك ({status.videos}) ويقترح لكل درس عنواناً نظيفاً وملخّصاً للتلميذ ومحوراً (وحدة). لا يتغيّر أي درس إلا ما تختاره
            وتطبّقه أنت.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="المستوى (اختياري)" htmlFor="org-level">
              <Select id="org-level" value={levelId} onChange={(e) => setLevelId(e.target.value)}>
                <option value="">كل المستويات</option>
                {levels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="الشعبة (اختياري)" htmlFor="org-stream">
              <Select id="org-stream" value={streamId} onChange={(e) => setStreamId(e.target.value)}>
                <option value="">كل الشعب</option>
                {streams.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button onClick={request} loading={pending} disabled={running || !status.aiConfigured || status.videos === 0}>
            <Sparkles className="size-4" /> نظّم فيديوهاتي بالذكاء الاصطناعي
          </Button>
          {status.videos === 0 ? (
            <p className="text-xs text-muted-foreground">
              لا فيديوهات بعد —{' '}
              <Link href="/teacher/content/import" className="text-primary underline">
                استورد قائمة تشغيل
              </Link>{' '}
              أولاً (وعند الاستيراد يمكنك تفعيل التنظيم مباشرة).
            </p>
          ) : null}
        </CardContent>
      </Card>

      {job ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              الاقتراحات
              <Badge variant={job.status === 'COMPLETED' ? 'success' : job.status === 'FAILED' ? 'destructive' : 'default'}>
                {job.status === 'COMPLETED' ? 'جاهزة' : job.status === 'FAILED' ? 'فشلت' : 'قيد التوليد'}
              </Badge>
              <span className="text-xs font-normal text-muted-foreground">{formatDateTime(job.finishedAt ?? job.createdAt)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {running ? (
              <>
                <Progress value={job.totalItems ? Math.round((job.processedItems / job.totalItems) * 100) : 5} />
                <p className="text-xs text-muted-foreground">
                  {job.processedItems}/{job.totalItems ?? '؟'} فيديو — تُحدَّث الصفحة تلقائياً.
                </p>
              </>
            ) : null}
            {job.status === 'FAILED' ? <Alert tone="destructive">لم يكتمل التنظيم. الإشعار يذكر السبب؛ أعد المحاولة لاحقاً.</Alert> : null}
            {job.status === 'COMPLETED' && proposals.length === 0 ? <EmptyState title="لا اقتراحات" description="لم يُعد النموذج شيئاً." /> : null}
            {job.status === 'COMPLETED' && proposals.length > 0 ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">
                    {changedOpen.length} من {proposals.length} فيها تحسين مقترح
                    {applied.size ? ` · طُبّق ${applied.size}` : ''}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setPicked(new Set(changedOpen.map((p) => p.contentId)))} disabled={changedOpen.length === 0}>
                    تحديد الكل
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())} disabled={picked.size === 0}>
                    إلغاء التحديد
                  </Button>
                  <Button size="sm" onClick={apply} loading={pending} disabled={picked.size === 0}>
                    تطبيق المحدد ({picked.size})
                  </Button>
                </div>
                <ul className="divide-y rounded-lg border">
                  {proposals.map((p) => {
                    const done = applied.has(p.contentId)
                    return (
                      <li key={p.contentId} className={`flex gap-3 p-3 ${!p.changed || done ? 'opacity-70' : ''}`}>
                        <input type="checkbox" className="mt-1 size-4 shrink-0" checked={picked.has(p.contentId)} onChange={() => toggle(p.contentId)} disabled={!p.changed || done} aria-label={`اختيار ${p.proposed.title}`} />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{p.proposed.title}</span>
                            {done ? <Badge variant="success">طُبّق</Badge> : !p.changed ? <Badge variant="muted">بلا تغيير</Badge> : null}
                            {p.proposed.topic ? <Badge variant="secondary">{p.proposed.topic}</Badge> : null}
                          </div>
                          {p.changed && p.current.title !== p.proposed.title ? <p className="text-xs text-muted-foreground line-through">{p.current.title}</p> : null}
                          {p.proposed.summary ? <p className="text-xs text-muted-foreground">{p.proposed.summary}</p> : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
