'use client'

import { AlertTriangle, CheckCircle2, Keyboard, ScanLine, Volume2, VolumeX, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CloseSessionButton } from '@/components/domain/close-session-button'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/input'
import { Progress } from '@/components/ui/misc'
import { t } from '@/i18n'
import { cn, formatTime } from '@/lib/utils'
import { openScannerAction, scanAction } from '@/server/actions/attendance.actions'

interface SessionOpt {
  id: string
  label: string
  groupName: string
  startedAt: Date
}

type Feedback =
  | { kind: 'idle' }
  | { kind: 'success'; name: string; group: string; time: Date; status: 'PRESENT' | 'LATE'; minutesLate: number }
  | { kind: 'warning'; message: string }
  | { kind: 'error'; message: string }

interface RecentScan {
  id: number
  name: string
  status: 'PRESENT' | 'LATE' | 'ERROR'
  time: Date
  message?: string
}

const WARNING_CODES = new Set(['ATTENDANCE_DUPLICATE', 'QR_REPLAYED'])

function useBeep(enabled: boolean) {
  const ctx = useRef<AudioContext | null>(null)
  return useCallback(
    (kind: 'success' | 'warning' | 'error') => {
      if (!enabled) return
      try {
        ctx.current ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
        const ac = ctx.current
        const play = (freq: number, start: number, dur: number) => {
          const o = ac.createOscillator()
          const g = ac.createGain()
          o.type = 'sine'
          o.frequency.value = freq
          g.gain.value = 0.15
          o.connect(g).connect(ac.destination)
          o.start(ac.currentTime + start)
          o.stop(ac.currentTime + start + dur)
        }
        if (kind === 'success') play(880, 0, 0.12)
        else if (kind === 'warning') {
          play(660, 0, 0.1)
          play(660, 0.15, 0.1)
        } else play(220, 0, 0.35)
      } catch {
        /* لا صوت */
      }
    },
    [enabled]
  )
}

export function ScannerConsole({ sessions, sessionId, initial, basePath = '/teacher' }: { sessions: SessionOpt[]; sessionId: string; initial: { present: number; late: number; active: number; recorded: number }; basePath?: string }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [feedback, setFeedback] = useState<Feedback>({ kind: 'idle' })
  const [recent, setRecent] = useState<RecentScan[]>([])
  const [counts, setCounts] = useState(initial)
  const [sound, setSound] = useState(true)
  const [busy, setBusy] = useState(false)
  const [scannerSessionId, setScannerSessionId] = useState<string | null>(null)
  const beep = useBeep(sound)
  const session = sessions.find((s) => s.id === sessionId)
  const seq = useRef(0)

  useEffect(() => {
    setCounts(initial)
    // فتح جلسة سكانر لتسجيل الجهاز
    void openScannerAction(sessionId, navigator.userAgent.slice(0, 80)).then((r) => {
      if (r.ok) setScannerSessionId(r.data.scannerSessionId)
    })
  }, [sessionId, initial])

  // الحفاظ على التركيز في حقل المسح
  useEffect(() => {
    const focus = () => inputRef.current?.focus()
    focus()
    const onClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('button, a, select, input, textarea, [role="dialog"]')) return
      focus()
    }
    document.addEventListener('click', onClick)
    const iv = setInterval(() => {
      if (document.activeElement === document.body) focus()
    }, 2000)
    return () => {
      document.removeEventListener('click', onClick)
      clearInterval(iv)
    }
  }, [])

  const submit = useCallback(
    async (raw: string) => {
      const token = raw.trim()
      if (!token || busy) return
      setBusy(true)
      setValue('')
      const r = await scanAction({ classSessionId: sessionId, token, scannerSessionId })
      const now = new Date()
      if (r.ok) {
        beep('success')
        setFeedback({ kind: 'success', name: r.data.fullName, group: r.data.groupName, time: r.data.recordedAt, status: r.data.status, minutesLate: r.data.minutesLate })
        setRecent((list) => [{ id: ++seq.current, name: r.data.fullName, status: r.data.status, time: r.data.recordedAt }, ...list].slice(0, 30))
        setCounts((c) => ({ ...c, present: c.present + (r.data.status === 'PRESENT' ? 1 : 0), late: c.late + (r.data.status === 'LATE' ? 1 : 0), recorded: c.recorded + 1 }))
      } else if (WARNING_CODES.has(r.error.code)) {
        beep('warning')
        setFeedback({ kind: 'warning', message: r.error.message })
        setRecent((list) => [{ id: ++seq.current, name: '—', status: 'ERROR' as const, time: now, message: r.error.message }, ...list].slice(0, 30))
      } else {
        beep('error')
        setFeedback({ kind: 'error', message: r.error.message })
        setRecent((list) => [{ id: ++seq.current, name: '—', status: 'ERROR' as const, time: now, message: r.error.message }, ...list].slice(0, 30))
        if (r.error.code === 'SESSION_NOT_OPEN' || r.error.code === 'SESSION_NOT_FOUND') router.refresh()
      }
      setBusy(false)
      inputRef.current?.focus()
    },
    [beep, busy, router, scannerSessionId, sessionId]
  )

  const pct = counts.active > 0 ? Math.round((counts.recorded / counts.active) * 100) : 0

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="flex flex-wrap items-center gap-2">
          {sessions.length > 1 ? (
            <Select value={sessionId} onChange={(e) => router.push(`${basePath}/scanner?session=${e.target.value}`)} className="w-auto min-w-64" aria-label={t('scanner.selectSession')}>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          ) : (
            <p className="font-bold">{session?.label}</p>
          )}
          <span className="text-xs text-muted-foreground">
            {t('sessions.started')} {formatTime(session?.startedAt)}
          </span>
          <div className="ms-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setSound((s) => !s)} aria-label={t('scanner.sound')}>
              {sound ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`${basePath}/sessions/${sessionId}`}>{t('sessions.attendanceList')}</Link>
            </Button>
            <CloseSessionButton sessionId={sessionId} afterClose="sessions" basePath={basePath} />
          </div>
        </div>

        {/* لوحة النتيجة */}
        <div
          className={cn(
            'flex min-h-64 flex-col items-center justify-center gap-2 rounded-2xl border-2 p-8 text-center transition-colors',
            feedback.kind === 'idle' && 'border-dashed bg-muted/30',
            feedback.kind === 'success' && feedback.status === 'PRESENT' && 'border-success bg-success/10',
            feedback.kind === 'success' && feedback.status === 'LATE' && 'border-warning bg-warning/15',
            feedback.kind === 'warning' && 'border-warning bg-warning/15',
            feedback.kind === 'error' && 'border-destructive bg-destructive/10'
          )}
          aria-live="polite"
        >
          {feedback.kind === 'idle' ? (
            <>
              <ScanLine className="size-14 text-muted-foreground/50" />
              <p className="text-lg font-bold">{t('scanner.ready')}</p>
              <p className="text-sm text-muted-foreground">{t('scanner.listening')}</p>
            </>
          ) : feedback.kind === 'success' ? (
            <>
              <CheckCircle2 className={cn('size-16', feedback.status === 'PRESENT' ? 'text-success' : 'text-amber-600')} />
              <p className="text-sm font-bold">{t('scanner.scanned')}</p>
              <p className="text-3xl font-extrabold">{feedback.name}</p>
              <p className="text-muted-foreground">{feedback.group}</p>
              <p className="text-xl font-bold tabular">
                {feedback.status === 'PRESENT' ? t('attendanceStatus.PRESENT') : `${t('attendanceStatus.LATE')} (${feedback.minutesLate} د)`} · {formatTime(feedback.time)}
              </p>
            </>
          ) : feedback.kind === 'warning' ? (
            <>
              <AlertTriangle className="size-16 text-amber-600" />
              <p className="text-2xl font-extrabold">{feedback.message}</p>
            </>
          ) : (
            <>
              <XCircle className="size-16 text-destructive" />
              <p className="text-2xl font-extrabold">{feedback.message}</p>
            </>
          )}
        </div>

        {/* حقل المسح */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit(value)
          }}
          className="space-y-2"
        >
          <label htmlFor="scan-input" className="flex items-center gap-2 text-sm font-semibold">
            <Keyboard className="size-4" /> {t('scanner.inputLabel')}
          </label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              id="scan-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onPaste={(e) => {
                const text = e.clipboardData.getData('text')
                if (text.includes('.')) {
                  e.preventDefault()
                  void submit(text)
                }
              }}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              dir="ltr"
              placeholder={t('scanner.manualPaste')}
              className="h-12 flex-1 rounded-md border bg-background px-3 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button type="submit" loading={busy} className="h-12">
              {t('scanner.scanNow')}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">{t('scanner.focusHint')}</p>
        </form>
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-2 text-xs font-bold text-muted-foreground">{t('scanner.counters')}</p>
          <div className="mb-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md bg-success/10 p-2">
              <p className="text-2xl font-extrabold tabular text-success">{counts.present}</p>
              <p className="text-[11px]">{t('sessions.present')}</p>
            </div>
            <div className="rounded-md bg-warning/20 p-2">
              <p className="text-2xl font-extrabold tabular">{counts.late}</p>
              <p className="text-[11px]">{t('sessions.late')}</p>
            </div>
            <div className="rounded-md bg-muted p-2">
              <p className="text-2xl font-extrabold tabular">{Math.max(0, counts.active - counts.recorded)}</p>
              <p className="text-[11px]">{t('sessions.unrecorded')}</p>
            </div>
          </div>
          <Progress value={pct} />
          <p className="mt-1 text-[11px] text-muted-foreground tabular">
            {counts.recorded}/{counts.active} ({pct}%)
          </p>
        </div>
        <div className="rounded-lg border bg-card">
          <p className="border-b p-3 text-xs font-bold text-muted-foreground">{t('scanner.recent')}</p>
          {recent.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{t('common.empty')}</p>
          ) : (
            <ul className="max-h-96 divide-y overflow-y-auto scrollbar-thin">
              {recent.map((r) => (
                <li key={r.id} className="flex items-center gap-2 p-3 text-sm">
                  {r.status === 'PRESENT' ? <CheckCircle2 className="size-4 text-success" /> : r.status === 'LATE' ? <AlertTriangle className="size-4 text-amber-600" /> : <XCircle className="size-4 text-destructive" />}
                  <span className="flex-1 truncate font-semibold">{r.status === 'ERROR' ? r.message : r.name}</span>
                  <span className="text-[11px] text-muted-foreground tabular">{formatTime(r.time)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
