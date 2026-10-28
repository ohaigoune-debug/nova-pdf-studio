'use client'

import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, Flag, Home, RotateCcw, Sparkles, Trophy, Volume2, VolumeX, XCircle, Zap } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, Textarea } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { abandonPlaySessionAction, reportPlayQuestionAction, setPlayPrefsAction, submitPlayAnswerAction } from '@/server/actions/play.actions'
import { CHALLENGE_NAMES, PLAY_REPORT_REASONS, type PlayChallengeType, type PlayReportReason } from '@/server/play/constants'
import type { PlayStudentAnswer } from '@/server/play/question-types'
import type { SessionQuestionView, SubmitResult } from '@/server/services/play.service'
import { FillBlankCard, MatchingCard, McqCard, OrderingCard } from './question-cards'
import { RichText } from './rich-text'
import { DifficultyPill, LucideIcon } from './visuals'

export interface PlayGameProps {
  session: {
    id: string
    challengeType: string
    status: string
    timed: boolean
    expiresAt: string | null
    answeredCount: number
    correctCount: number
    xpEarned: number
    total: number
    subjectCode: string | null
  }
  questions: SessionQuestionView[]
  prefs: { sound?: boolean; motion?: boolean }
  subjectName: string
  backHref: string
}

const REASON_LABELS: Record<PlayReportReason, string> = {
  WRONG_ANSWER: 'الإجابة المعتمدة خاطئة',
  AMBIGUOUS: 'السؤال غامض أو له أكثر من إجابة',
  TYPO: 'خطأ إملائي أو لغوي',
  OFF_LESSON: 'السؤال لا يخص الدرس',
  OTHER: 'سبب آخر'
}

export function useBeep(enabled: boolean) {
  const ctx = useRef<AudioContext | null>(null)
  return useCallback(
    (kind: 'ok' | 'bad' | 'win') => {
      if (!enabled || typeof window === 'undefined') return
      try {
        ctx.current ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
        const ac = ctx.current
        const notes = kind === 'ok' ? [660, 880] : kind === 'bad' ? [220, 180] : [523, 659, 784, 1047]
        notes.forEach((f, i) => {
          const o = ac.createOscillator()
          const g = ac.createGain()
          o.type = kind === 'bad' ? 'sawtooth' : 'sine'
          o.frequency.value = f
          g.gain.value = 0.0001
          o.connect(g).connect(ac.destination)
          const t = ac.currentTime + i * 0.09
          g.gain.exponentialRampToValueAtTime(0.08, t + 0.01)
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
          o.start(t)
          o.stop(t + 0.2)
        })
      } catch {
        /* الصوت اختياري */
      }
    },
    [enabled]
  )
}

export function PlayGame({ session, questions, prefs, subjectName, backHref }: PlayGameProps) {
  const router = useRouter()
  const firstUnanswered = Math.max(0, questions.findIndex((q) => !q.answered))
  const [index, setIndex] = useState(session.status === 'ACTIVE' && firstUnanswered >= 0 ? firstUnanswered : questions.length)
  const [answer, setAnswer] = useState<PlayStudentAnswer | null>(null)
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [pending, start] = useTransition()
  const [sound, setSound] = useState(prefs.sound ?? false)
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const motion = (prefs.motion ?? true) && !reduceMotion
  const beep = useBeep(sound)
  const [now, setNow] = useState(() => Date.now())
  const [reportOpen, setReportOpen] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const startedAt = useRef(Date.now())
  const [tally, setTally] = useState({ correct: session.correctCount, answered: session.answeredCount, xp: session.xpEarned })
  const [newBadges, setNewBadges] = useState<{ code: string; nameAr: string; icon: string }[]>([])
  const [expired, setExpired] = useState(session.status === 'EXPIRED')

  const current = questions[index] ?? null
  const finished = index >= questions.length || session.status === 'COMPLETED' || expired

  useEffect(() => {
    if (!session.timed || finished) return
    const iv = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(iv)
  }, [session.timed, finished])
  const remaining = session.timed && session.expiresAt ? Math.max(0, Math.floor((new Date(session.expiresAt).getTime() - now) / 1000)) : null
  useEffect(() => {
    if (remaining === 0 && !finished) setExpired(true)
  }, [remaining, finished])

  useEffect(() => {
    startedAt.current = Date.now()
    setAnswer(null)
    setResult(null)
  }, [index])

  const submit = () => {
    if (!current || result || pending) return
    start(async () => {
      const r = await submitPlayAnswerAction({ sessionId: session.id, questionId: current.id, answer, timeMs: Math.min(3_600_000, Date.now() - startedAt.current) })
      if (!r.ok) {
        if (r.error.code === 'PLAY_SESSION_EXPIRED') setExpired(true)
        else if (r.error.code === 'PLAY_ALREADY_ANSWERED' || r.error.code === 'PLAY_SESSION_CLOSED') router.refresh()
        toast('error', r.error.message)
        return
      }
      setResult(r.data)
      setTally({ correct: r.data.correctCount, answered: r.data.answeredCount, xp: r.data.sessionXp })
      if (r.data.newBadges.length) setNewBadges((b) => [...b, ...r.data.newBadges])
      beep(r.data.isCorrect ? 'ok' : 'bad')
      if (r.data.sessionCompleted) setTimeout(() => beep('win'), 500)
    })
  }

  const next = () => {
    if (index + 1 >= questions.length) {
      setIndex(questions.length)
      router.refresh()
    } else setIndex(index + 1)
  }

  const toggleSound = () => {
    const v = !sound
    setSound(v)
    void setPlayPrefsAction({ sound: v })
  }

  const progressPct = Math.round((Math.min(index, questions.length) / Math.max(1, questions.length)) * 100)
  const challengeName = CHALLENGE_NAMES[session.challengeType as PlayChallengeType] ?? session.challengeType

  /* ------------------------------ شاشة النهاية ------------------------------ */
  if (finished || !current) {
    const pct = Math.round((tally.correct / Math.max(1, questions.length)) * 100)
    const headline = expired ? 'انتهى الوقت!' : pct >= 80 ? 'ممتاز! أداء رائع' : pct >= 50 ? 'جيد، واصل التدريب' : 'لا بأس، كل خطأ فرصة للتعلم'
    return (
      <div className={cn('mx-auto max-w-xl space-y-5', motion && 'animate-scale-in')}>
        <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/15 via-card to-accent/15 p-6 text-center shadow-sm">
          <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-full bg-primary/15 text-primary">{expired ? <Clock className="size-8" /> : pct >= 50 ? <Trophy className="size-8" /> : <RotateCcw className="size-8" />}</div>
          <h2 className="text-2xl font-extrabold">{headline}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {challengeName} · {subjectName}
          </p>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <Stat label="صحيحة" value={`${tally.correct}/${questions.length}`} tone="success" />
            <Stat label="النسبة" value={`${pct}%`} tone={pct >= 50 ? 'primary' : 'warning'} />
            <Stat label="XP" value={`+${tally.xp}`} tone="accent" />
          </div>
          {newBadges.length ? (
            <div className="mt-5 space-y-2">
              <p className="text-sm font-bold">شارات جديدة 🎉</p>
              <div className="flex flex-wrap justify-center gap-2">
                {newBadges.map((b) => (
                  <span key={b.code} className="inline-flex items-center gap-1 rounded-full bg-accent/20 px-3 py-1 text-sm font-bold text-accent-foreground dark:text-accent">
                    <LucideIcon name={b.icon} className="size-4" /> {b.nameAr}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Button asChild size="lg" variant="secondary">
            <Link href="/student/play">
              <Home className="size-4" /> الرئيسية
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/student/play/mistakes">
              <RotateCcw className="size-4" /> راجع أخطاءك
            </Link>
          </Button>
          <Button asChild size="lg">
            <Link href={backHref}>
              <Zap className="size-4" /> تحدٍّ جديد
            </Link>
          </Button>
        </div>
        {questions.some((q) => q.answered && !q.answered.isCorrect) ? (
          <div className="space-y-2">
            <h3 className="font-bold">الأسئلة التي أخطأت فيها</h3>
            {questions
              .filter((q) => q.answered && !q.answered.isCorrect)
              .map((q) => (
                <div key={q.id} className="rounded-2xl border bg-card p-4 text-sm">
                  <RichText text={q.questionText} className="font-semibold" as="p" />
                  <p className="mt-2 text-success">
                    الإجابة الصحيحة: <strong>{q.answered!.correctText}</strong>
                  </p>
                  <p className="mt-1 text-muted-foreground">{q.answered!.explanation}</p>
                </div>
              ))}
          </div>
        ) : null}
      </div>
    )
  }

  /* ------------------------------- شاشة السؤال ------------------------------- */
  const cardProps = { payload: current.payload, disabled: !!result || pending, onChange: setAnswer, result: result ? { isCorrect: result.isCorrect, correctText: result.correctText } : null, motion }
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* الشريط العلوي */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setConfirmLeave(true)} className="rounded-full p-2 hover:bg-muted" aria-label="خروج">
          <ArrowLeft className="size-5 rtl:rotate-180" />
        </button>
        <div className="flex-1">
          <div className="mb-1 flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>
              {challengeName} · {subjectName}
            </span>
            <span className="tabular-nums">
              {index + 1} / {questions.length}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-gradient-to-l from-primary to-emerald-400 transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        {remaining !== null ? (
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums', remaining <= 30 ? 'bg-destructive/15 text-destructive' : 'bg-muted text-foreground')}>
            <Clock className="size-3.5" /> {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
          </span>
        ) : null}
        <button type="button" onClick={toggleSound} className="rounded-full p-2 hover:bg-muted" aria-label={sound ? 'كتم الصوت' : 'تشغيل الصوت'}>
          {sound ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
        </button>
      </div>

      {/* بطاقة السؤال */}
      <div key={current.id} className={cn('rounded-3xl border bg-card p-4 shadow-sm sm:p-6', motion && 'animate-fade-in')}>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <DifficultyPill value={current.difficulty} />
          <span className="rounded-full bg-muted px-2 py-0.5">{current.lessonName}</span>
          <span className="ms-auto inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 font-bold text-accent-foreground dark:text-accent">
            <Zap className="size-3" /> {tally.xp} XP
          </span>
        </div>
        {current.payload.type !== 'FILL_BLANK' ? <RichText as="p" text={current.questionText} className="mb-5 text-lg font-bold leading-relaxed sm:text-xl" /> : <p className="mb-4 text-sm font-semibold text-muted-foreground">أكمل الفراغ بالكلمة المناسبة:</p>}
        {current.payload.type === 'MCQ' ? <McqCard {...cardProps} /> : current.payload.type === 'FILL_BLANK' ? <FillBlankCard {...cardProps} /> : current.payload.type === 'MATCHING' ? <MatchingCard {...cardProps} /> : <OrderingCard {...cardProps} />}
      </div>

      {/* التصحيح */}
      {result ? (
        <div className={cn('rounded-3xl border-2 p-4 sm:p-5', result.isCorrect ? 'border-success/50 bg-success/10' : 'border-destructive/40 bg-destructive/5', motion && 'animate-scale-in')} role="status" aria-live="polite">
          <div className="flex items-start gap-3">
            {result.isCorrect ? <CheckCircle2 className="mt-0.5 size-7 shrink-0 text-success" /> : <XCircle className="mt-0.5 size-7 shrink-0 text-destructive" />}
            <div className="flex-1 space-y-1">
              <p className="text-lg font-extrabold">
                {result.isCorrect ? 'إجابة صحيحة' : 'إجابة خاطئة'}
                {result.xp > 0 ? <span className="ms-2 inline-flex items-center gap-1 rounded-full bg-accent/25 px-2 py-0.5 text-sm font-bold text-accent-foreground dark:text-accent">+{result.xp} XP</span> : null}
              </p>
              {!result.isCorrect && current.payload.type === 'MCQ' ? (
                <p className="text-sm">
                  الإجابة الصحيحة: <strong>{result.correctText}</strong>
                </p>
              ) : null}
              <p className="text-sm leading-relaxed text-foreground/90">{result.explanation}</p>
              {result.lessonMastered ? (
                <p className="inline-flex items-center gap-1 text-sm font-bold text-primary">
                  <Sparkles className="size-4" /> أتقنتَ هذا الدرس! +XP إضافية
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* الأزرار */}
      <div className="sticky bottom-2 flex items-center gap-2 rounded-2xl border bg-background/95 p-2 shadow-lg backdrop-blur">
        <button type="button" onClick={() => setReportOpen(true)} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="الإبلاغ عن خطأ في السؤال">
          <Flag className="size-4" /> <span className="hidden sm:inline">إبلاغ</span>
        </button>
        <div className="flex-1" />
        {result ? (
          <Button size="lg" onClick={next} className="min-w-40">
            {index + 1 >= questions.length ? 'عرض النتيجة' : 'السؤال التالي'}
          </Button>
        ) : (
          <Button size="lg" onClick={submit} disabled={!answer} loading={pending} className="min-w-40">
            تحقّق
          </Button>
        )}
      </div>

      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} questionId={current.id} sessionId={session.id} />
      <Dialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>مغادرة التحدي؟</DialogTitle>
            <DialogDescription>يمكنك العودة لاحقاً من «أكمل من حيث توقفت» ما لم تبدأ تحدياً جديداً.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmLeave(false)}>
              متابعة اللعب
            </Button>
            <Button variant="secondary" onClick={() => router.push('/student/play')}>
              حفظ والعودة
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                start(async () => {
                  await abandonPlaySessionAction(session.id)
                  router.push('/student/play')
                })
              }
            >
              إنهاء التحدي
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'success' | 'primary' | 'warning' | 'accent' }) {
  const cls = { success: 'text-success', primary: 'text-primary', warning: 'text-amber-700 dark:text-amber-300', accent: 'text-accent-foreground dark:text-accent' }[tone]
  return (
    <div className="rounded-2xl bg-background/70 p-3">
      <p className={cn('text-2xl font-extrabold tabular-nums', cls)}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

export function ReportDialog({ open, onOpenChange, questionId, sessionId }: { open: boolean; onOpenChange: (v: boolean) => void; questionId: string; sessionId: string | null }) {
  const [reason, setReason] = useState<PlayReportReason>('WRONG_ANSWER')
  const [message, setMessage] = useState('')
  const [pending, start] = useTransition()
  const send = () =>
    start(async () => {
      const r = await reportPlayQuestionAction({ questionId, sessionId, reason, message: message || null })
      if (!r.ok) {
        toast('error', r.error.message)
        return
      }
      toast('success', 'شكراً! وصل بلاغك إلى الإدارة.')
      setMessage('')
      onOpenChange(false)
    })
  const reasons = useMemo(() => PLAY_REPORT_REASONS.map((r) => ({ value: r, label: REASON_LABELS[r] })), [])
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-warning" /> الإبلاغ عن خطأ في السؤال
          </DialogTitle>
          <DialogDescription>يصل البلاغ إلى الإدارة مع بيانات السؤال. لن تُخصم منك نقاط.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={reason} onChange={(e) => setReason(e.target.value as PlayReportReason)}>
            {reasons.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="اشرح الخطأ باختصار (اختياري)" maxLength={1000} />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={send} loading={pending}>
            إرسال البلاغ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
