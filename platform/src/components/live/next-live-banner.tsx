'use client'

import { Radio, Video } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { formatDateTime } from '@/lib/utils'
import { joinLiveAction } from '@/server/actions/live.actions'

export interface NextLiveBannerSession {
  id: string
  title: string
  courseTitle: string
  /** ISO */
  startsAt: string
  durationMinutes: number
  provider: string
  status: string
  termsAccepted: boolean
}

const PROVIDER: Record<string, string> = { ZOOM: 'Zoom', MEET: 'Google Meet', YOUTUBE: 'يوتيوب', OTHER: 'بث' }

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function countdown(ms: number): string {
  if (ms <= 0) return 'الآن'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86_400)
  const h = Math.floor((s % 86_400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (d > 0) return `${d} يوم و ${pad(h)}:${pad(m)}`
  return `${pad(h)}:${pad(m)}:${pad(sec)}`
}

/**
 * لافتة الحصة المباشرة القادمة للتلميذ: عدّ تنازلي + زر «انضم» يطلب الرابط من الخادم (يُسجَّل الحضور)
 * ثم يفتحه في نافذة جديدة. لا يُرسم شيء إن لم تكن حصة قادمة. صفحات الدورة قد تستورده لاحقاً.
 */
export function NextLiveBanner({ session }: { session: NextLiveBannerSession | null }) {
  const [now, setNow] = useState(() => Date.now())
  const [pending, start] = useTransition()
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(iv)
  }, [])
  if (!session) return null
  const startsAt = new Date(session.startsAt).getTime()
  const opensAt = startsAt - 15 * 60_000
  const closesAt = startsAt + session.durationMinutes * 60_000 + 30 * 60_000
  const open = now >= opensAt && now <= closesAt
  const live = session.status === 'LIVE' || (now >= startsAt && now <= closesAt)

  const join = () =>
    start(async () => {
      const r = await joinLiveAction({ sessionId: session.id })
      if (!r.ok) {
        toast('error', r.error.message)
        return
      }
      const w = window.open(r.data.url, '_blank', 'noopener,noreferrer')
      if (!w) window.location.href = r.data.url
    })

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${live ? 'border-destructive/40 bg-destructive/5' : 'border-primary/30 bg-primary/5'}`}>
      <div className="flex min-w-0 items-start gap-3">
        <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${live ? 'bg-destructive text-destructive-foreground' : 'bg-primary/10 text-primary'}`}>
          {live ? <Radio className="size-5 animate-pulse" /> : <Video className="size-5" />}
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{live ? 'حصة مباشرة الآن' : 'الحصة المباشرة القادمة'} · {session.courseTitle}</p>
          <p className="truncate font-bold">{session.title}</p>
          <p className="text-xs text-muted-foreground">
            {formatDateTime(session.startsAt)} · {PROVIDER[session.provider] ?? session.provider} · {session.durationMinutes} دقيقة
          </p>
          {!session.termsAccepted ? <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">اقبل شروط الدورة أولاً لتتمكن من الانضمام.</p> : null}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        {!live ? (
          <span className="font-mono text-lg font-extrabold tabular-nums" dir="ltr">
            {countdown(startsAt - now)}
          </span>
        ) : null}
        <Button size="sm" variant={live ? 'destructive' : 'default'} onClick={join} loading={pending} disabled={!open}>
          <Radio className="size-4" /> انضم
        </Button>
        <span className="text-[11px] text-muted-foreground">البث يفتح قبل الموعد بـ15 دقيقة</span>
      </div>
    </div>
  )
}
