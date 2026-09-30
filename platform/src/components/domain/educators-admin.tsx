'use client'

/* eslint-disable @next/next/no-img-element -- صور قنوات يوتيوب الخارجية: بلا تحسين Next ولا نطاقات مسبقة */
import { CheckCircle2, RefreshCw, RotateCcw, Search, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { cn, formatDateTime } from '@/lib/utils'
import { approveEducatorAction, rejectEducatorAction, resetEducatorAction, resolveEducatorsAction, syncEducatorAction } from '@/server/actions/educators.actions'
import type { EducatorView } from '@/server/services/educators.service'

const STATUS_AR: Record<string, { label: string; variant: 'default' | 'success' | 'destructive' | 'muted' }> = {
  SUGGESTED: { label: 'مرشّح', variant: 'default' },
  APPROVED: { label: 'معتمد', variant: 'success' },
  REJECTED: { label: 'مرفوض', variant: 'destructive' }
}

const fmt = (n: number | null | undefined) => (n == null ? '—' : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n))

/**
 * دليل الأساتذة: لكل مرشّح قنوات وجدها البحث؛ المشرف يختار الصحيحة ويعتمد، فتُزامَن فيديوهاتها.
 * لا اعتماد آلي: الاسم المتشابه شائع على يوتيوب.
 */
export function EducatorsAdmin({ educators, hasApiKey, pendingResolve }: { educators: EducatorView[]; hasApiKey: boolean; pendingResolve: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [filter, setFilter] = useState<'ALL' | 'SUGGESTED' | 'APPROVED' | 'REJECTED'>('ALL')
  const [subject, setSubject] = useState('')
  const syncing = educators.some((e) => e.status === 'APPROVED' && !e.syncedAt && !e.lastError)

  useEffect(() => {
    if (!pendingResolve && !syncing) return
    const id = setInterval(() => router.refresh(), 6000)
    return () => clearInterval(id)
  }, [pendingResolve, syncing, router])

  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } } & Record<string, unknown>>, okMsg: string) =>
    start(async () => {
      const r = await fn()
      if (!r.ok) toast('error', r.error!.message)
      else {
        toast('success', okMsg)
        router.refresh()
      }
    })

  const unresolved = educators.filter((e) => e.status === 'SUGGESTED' && !e.resolvedAt).length
  const subjectsAll = [...new Map(educators.flatMap((e) => e.subjects).map((s) => [s.code, s])).values()]
  const shown = educators.filter((e) => (filter === 'ALL' || e.status === filter) && (!subject || e.subjects.some((s) => s.code === subject)))
  const chip = (on: boolean) => cn('rounded-full border px-3 py-1 text-sm', on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/50')

  return (
    <div className="space-y-4">
      {!hasApiKey ? <Alert tone="warning">مفتاح YouTube API غير مضبوط على الخادم (YOUTUBE_API_KEY): البحث عن القنوات والمزامنة لا يعملان بدونه.</Alert> : null}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
          <Badge variant="secondary">{educators.length} أستاذاً</Badge>
          <Badge variant="success">{educators.filter((e) => e.status === 'APPROVED').length} معتمد</Badge>
          <Badge variant="default">{unresolved} لم يُبحث عنهم بعد</Badge>
          <Button size="sm" onClick={() => run(resolveEducatorsAction, 'بدأ البحث عن القنوات في الخلفية')} loading={pending} disabled={!hasApiKey || pendingResolve || unresolved === 0}>
            <Search className="size-4" /> {pendingResolve ? 'البحث جارٍ…' : `ابحث عن قنوات الـ${unresolved} الباقين`}
          </Button>
          <span className="text-xs text-muted-foreground">كل بحث يستهلك 100 وحدة من حصة يوتيوب اليومية (10 000)؛ إن نفدت يتوقّف ويكمل غداً.</span>
          <Link href="/videos" className="text-xs text-primary underline">
            صفحة الفيديوهات العامة
          </Link>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {(['ALL', 'SUGGESTED', 'APPROVED', 'REJECTED'] as const).map((f) => (
          <button key={f} type="button" className={chip(filter === f)} onClick={() => setFilter(f)}>
            {f === 'ALL' ? 'الكل' : STATUS_AR[f]!.label}
          </button>
        ))}
        <span className="mx-2 border-s" />
        <button type="button" className={chip(!subject)} onClick={() => setSubject('')}>
          كل المواد
        </button>
        {subjectsAll.map((s) => (
          <button key={s.code} type="button" className={chip(subject === s.code)} onClick={() => setSubject(s.code)}>
            {s.nameAr}
          </button>
        ))}
      </div>

      <ul className="space-y-3">
        {shown.map((e) => (
          <li key={e.id} className="rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {e.channelThumbnail ? <img src={e.channelThumbnail} alt="" className="size-12 rounded-full border object-cover" /> : <span className="grid size-12 place-items-center rounded-full border bg-muted text-lg font-bold">{e.name.replace(/^الأستاذة?\s+/, '').slice(0, 1)}</span>}
                <div>
                  <p className="font-bold">
                    {e.name} <Badge variant={STATUS_AR[e.status]!.variant}>{STATUS_AR[e.status]!.label}</Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {e.subjects.map((s) => `${s.nameAr} (${s.rank})`).join(' · ')}
                    {e.note ? ` — ${e.note}` : ''}
                  </p>
                  {e.status === 'APPROVED' ? (
                    <p className="text-xs text-muted-foreground">
                      <a href={`https://www.youtube.com/channel/${e.youtubeChannelId}`} target="_blank" rel="noreferrer" className="text-primary underline" dir="ltr">
                        {e.channelTitle}
                      </a>{' '}
                      · {fmt(e.subscriberCount)} مشترك · {fmt(e.videoCount)} فيديو على القناة · في المكتبة {e.videos}
                      {e.syncedAt ? ` · زُومنت ${formatDateTime(e.syncedAt)}` : ' · المزامنة جارية…'}
                    </p>
                  ) : null}
                  {e.lastError ? (
                    <p className="text-xs text-destructive" dir="auto">
                      {e.lastError}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {e.status === 'APPROVED' ? (
                  <Button size="sm" variant="outline" onClick={() => run(() => syncEducatorAction(e.id), 'بدأت مزامنة القناة')} loading={pending}>
                    <RefreshCw className="size-4" /> مزامنة
                  </Button>
                ) : null}
                {e.status === 'SUGGESTED' ? (
                  <Button size="sm" variant="ghost" onClick={() => confirm(`رفض «${e.name}»؟`) && run(() => rejectEducatorAction(e.id), 'رُفض')} loading={pending}>
                    <XCircle className="size-4" /> رفض
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => confirm(`إعادة «${e.name}» إلى الترشيح؟ فيديوهاته تُؤرشف.`) && run(() => resetEducatorAction(e.id), 'أُعيد إلى الترشيح')} loading={pending}>
                    <RotateCcw className="size-4" /> إعادة
                  </Button>
                )}
              </div>
            </div>

            {e.status === 'SUGGESTED' ? (
              e.candidates.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">{e.resolvedAt ? 'لم يجد البحث قناة بهذا الاسم.' : 'لم يُبحث عنه بعد.'}</p>
              ) : (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {e.candidates.map((c) => (
                    <li key={c.channelId} className="flex gap-2 rounded-lg border p-2">
                      {c.thumbnail ? <img src={c.thumbnail} alt="" className="size-12 shrink-0 rounded-full object-cover" /> : null}
                      <div className="min-w-0 flex-1 text-xs">
                        <a href={`https://www.youtube.com/channel/${c.channelId}`} target="_blank" rel="noreferrer" className="block truncate font-semibold text-primary underline" dir="auto">
                          {c.title}
                        </a>
                        <span className="text-muted-foreground" dir="ltr">
                          {c.handle ?? ''} · {fmt(c.subscriberCount)} مشترك · {fmt(c.videoCount)} فيديو
                        </span>
                        <p className="line-clamp-2 text-muted-foreground" dir="auto">
                          {c.description}
                        </p>
                        <Button size="sm" className="mt-1" onClick={() => run(() => approveEducatorAction(e.id, c.channelId), 'اعتُمد وبدأت المزامنة')} loading={pending}>
                          <CheckCircle2 className="size-4" /> هذه قناته
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
