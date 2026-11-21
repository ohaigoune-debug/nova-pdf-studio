'use client'

import { Radio, Video } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'
import { toast } from '@/components/ui/toast'
import { cn, formatDateTime } from '@/lib/utils'
import { joinLiveAction } from '@/server/actions/live.actions'
import type { NextLiveBannerSession } from './next-live-banner'

const JOIN_OPENS_BEFORE_MS = 15 * 60_000
const JOIN_CLOSES_AFTER_MS = 30 * 60_000

export interface LiveDoorLater {
  id: string
  title: string
  /** ISO */
  startsAt: string
  durationMinutes: number
}

function parts(ms: number): { value: number; label: string }[] {
  const s = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(s / 86_400)
  const h = Math.floor((s % 86_400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return d > 0
    ? [
        { value: d, label: d === 1 ? 'يوم' : d === 2 ? 'يومان' : d <= 10 ? 'أيام' : 'يومًا' },
        { value: h, label: 'ساعة' },
        { value: m, label: 'دقيقة' }
      ]
    : [
        { value: h, label: 'ساعة' },
        { value: m, label: 'دقيقة' },
        { value: sec, label: 'ثانية' }
      ]
}

/**
 * باب «الحصص المباشرة» في صفحة الدورة (التصوّر المعتمد، 21 نوفمبر 2026): بطاقة كحلية فيها الحصة القادمة،
 * عدّ تنازلي، وزرّ «انضمّ» يُفتح قبل الموعد بربع ساعة (الخادم يتحقق من النافذة ويسجّل الحضور ثم يعيد الرابط).
 */
export function LiveDoor({ session, later, serverNow }: { session: NextLiveBannerSession | null; later: LiveDoorLater[]; serverNow: number }) {
  const [now, setNow] = useState(serverNow)
  const [pending, start] = useTransition()
  useEffect(() => {
    setNow(Date.now())
    const iv = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(iv)
  }, [])

  const startsAt = session ? new Date(session.startsAt).getTime() : 0
  const open = session ? now >= startsAt - JOIN_OPENS_BEFORE_MS && now <= startsAt + session.durationMinutes * 60_000 + JOIN_CLOSES_AFTER_MS : false
  const live = session ? session.status === 'LIVE' || (now >= startsAt && open) : false

  const join = () =>
    session &&
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
    <section id="live" aria-label="الحصص المباشرة" className="scroll-mt-24 rounded-[20px] border-b-[3px] border-[#C29B45] bg-gradient-to-br from-[#1C3A63] to-[#0F2544] p-4 text-[#FFFDF7] shadow-soft sm:p-5">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-[#E6CF95]">
        <span className={cn('size-2.5 shrink-0 rounded-full bg-[#F04438] shadow-[0_0_0_3px_rgba(240,68,56,.3)]', live && 'animate-pulse')} aria-hidden />
        الحصص المباشرة · {live ? 'جارية الآن' : session ? 'القادمة' : 'لا حصة مجدولة'}
      </p>

      {session ? (
        <>
          <h2 className="mt-1 text-lg font-bold leading-snug">{session.title}</h2>
          <p className="text-xs text-white/75">{formatDateTime(session.startsAt)}</p>
          {!live ? (
            <div className="mt-3 flex gap-2" dir="rtl">
              {parts(startsAt - now).map((p) => (
                <div key={p.label} className="flex-1 rounded-xl border border-white/20 bg-white/10 py-1.5 text-center">
                  <b className="block font-heading text-[22px] leading-tight tabular-nums text-white" suppressHydrationWarning>
                    {String(p.value).padStart(2, '0')}
                  </b>
                  <span className="text-[11px] text-[#E6CF95]">{p.label}</span>
                </div>
              ))}
            </div>
          ) : null}
          {!session.termsAccepted ? (
            <p className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-xs">اقبل شروط الدورة أولًا لتتمكّن من الانضمام.</p>
          ) : open ? (
            <button
              type="button"
              onClick={join}
              disabled={pending}
              className={cn(
                'mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-70',
                live ? 'bg-destructive text-white hover:bg-destructive/90' : 'bg-[#C29B45] text-[#0F2544] hover:bg-[#E6CF95]'
              )}
            >
              {live ? <Radio className="size-5 animate-pulse" /> : <Video className="size-5" />} {pending ? 'جارٍ فتح الحصة…' : 'انضمّ الآن'}
            </button>
          ) : (
            <div className="mt-3 flex h-11 items-center justify-center gap-2 rounded-xl bg-white/[0.14] text-sm font-bold text-white/75" aria-disabled>
              <Video className="size-5" /> انضمّ <span className="text-xs font-normal">· يُفتح قبل الموعد بربع ساعة</span>
            </div>
          )}
        </>
      ) : (
        <p className="mt-2 text-sm text-white/80">حين يبرمج أستاذك حصة مباشرة تظهر هنا مع عدّ تنازلي وزرّ الانضمام.</p>
      )}

      {later.length ? (
        <ul className="mt-3 space-y-1 border-t border-white/15 pt-3 text-xs text-white/80">
          {later.map((l) => (
            <li key={l.id} className="flex justify-between gap-3">
              <span className="truncate">{l.title}</span>
              <span className="shrink-0 tabular-nums">{formatDateTime(l.startsAt)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
