'use client'

import { BookOpen, CheckCircle2, ChevronLeft, Clock, Coins, Flag, Flame, Pause, Pointer, RotateCcw, Sparkles, Trophy, Volume2, VolumeX, WifiOff, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { abandonPlaySessionAction, setPlayPrefsAction, submitPlayAnswerAction } from '@/server/actions/play.actions'
import { CHALLENGE_NAMES, type PlayChallengeType } from '@/server/play/constants'
import type { PlayStudentAnswer } from '@/server/play/question-types'
import type { SessionQuestionView } from '@/server/services/play.service'
import { answerReady, canSubmit, cardReducer, createSubmitGate, initialCardState, LEAVE_MS, longestStreak, resumeIndex } from './card-machine'
import { StartButton, type LaunchTarget } from './challenge-launcher'
import { BookGlyph, FlipCard } from './flip-card'
import { ReportDialog, useBeep, type PlayGameProps } from './play-game'
import { FillBlankCard, MatchingCard, McqCard, OrderingCard } from './question-cards'
import { RichText } from './rich-text'
import { DifficultyPill, LucideIcon } from './visuals'

export interface PlayLevelView {
  title: string
  progressPct: number
  nextMinXp: number | null
}

export interface PlayCardGameProps extends PlayGameProps {
  /** «إعادة المحاولة»: جولة جديدة بالتحدي نفسه عبر startPlaySessionAction الحالي */
  retry: LaunchTarget
  level: PlayLevelView | null
  xpTotal: number
}

/** نتيجة سؤال كما تعرضها البطاقة (من رد الخادم أو من الجلسة المحفوظة) */
interface ShownResult {
  isCorrect: boolean
  correctText: string
  explanation: string
  xp: number
  lessonMastered: boolean
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia?.(REDUCED_MOTION_QUERY)
      m?.addEventListener('change', cb)
      return () => m?.removeEventListener('change', cb)
    },
    () => window.matchMedia?.(REDUCED_MOTION_QUERY).matches ?? false,
    () => false
  )
}

function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('online', cb)
      window.addEventListener('offline', cb)
      return () => {
        window.removeEventListener('online', cb)
        window.removeEventListener('offline', cb)
      }
    },
    () => navigator.onLine,
    () => true
  )
}

/**
 * جولة MADRASADZ PLAY بالبطاقات: الأسئلة نفسها، والتصحيح والتسجيل نفسيهما (submitPlayAnswerAction)،
 * والصلاحيات نفسها. الواجهة القديمة باقية في PlayGame (?view=classic).
 */
export function PlayCardGame({ session, questions, prefs, subjectName, backHref, retry, level, xpTotal }: PlayCardGameProps) {
  const router = useRouter()
  const [index, setIndex] = useState(() =>
    resumeIndex(
      session.status,
      questions.map((q) => !!q.answered)
    )
  )
  const current = questions[index] ?? null
  const [card, dispatch] = useReducer(cardReducer, current?.id ?? null, (id) => initialCardState(id))
  const [answer, setAnswer] = useState<PlayStudentAnswer | null>(null)
  const [result, setResult] = useState<ShownResult | null>(null)
  const [outcomes, setOutcomes] = useState<Record<string, boolean>>({})
  const [sound, setSound] = useState(prefs.sound ?? false)
  const reducedMotion = useReducedMotion()
  const motion = (prefs.motion ?? true) && !reducedMotion
  const online = useOnline()
  const beep = useBeep(sound)
  const [now, setNow] = useState(() => Date.now())
  const [tally, setTally] = useState({ correct: session.correctCount, answered: session.answeredCount, xp: session.xpEarned })
  const [newBadges, setNewBadges] = useState<{ code: string; nameAr: string; icon: string }[]>([])
  const [expired, setExpired] = useState(session.status === 'EXPIRED')
  const [standing, setStanding] = useState({ level, xpTotal })
  const [pauseOpen, setPauseOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [announce, setAnnounce] = useState('')
  const gate = useRef(createSubmitGate())
  const advancing = useRef(false)
  const startedAt = useRef(Date.now())
  const backRef = useRef<HTMLButtonElement>(null)
  const questionRef = useRef<HTMLDivElement>(null)
  const correctionRef = useRef<HTMLDivElement>(null)
  const focusBackOnLoad = useRef(false)

  const finished = index >= questions.length || session.status === 'COMPLETED' || expired
  // حالة البطاقة المعروضة: بطاقة جديدة تبدأ مغلقة حتى لو لم يصل LOAD بعد
  const phase = current && card.questionId === current.id ? card.phase : 'covered'

  /* المؤقت كما هو في القواعد الحالية (الخادم يحدد expiresAt) */
  useEffect(() => {
    if (!session.timed || finished) return
    const iv = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(iv)
  }, [session.timed, finished])
  const remaining = session.timed && session.expiresAt ? Math.max(0, Math.floor((new Date(session.expiresAt).getTime() - now) / 1000)) : null
  useEffect(() => {
    if (remaining === 0 && !finished) setExpired(true)
  }, [remaining, finished])

  /* بطاقة جديدة لكل سؤال؛ وإن أكّد الخادم أنه مُجاب تُعرض نتيجته */
  const currentId = current?.id ?? null
  const currentAnswered = !!current?.answered
  useEffect(() => {
    if (!currentId) return
    dispatch({ type: 'LOAD', questionId: currentId, answered: currentAnswered })
  }, [currentId, currentAnswered])
  useEffect(() => {
    setAnswer(null)
    setResult(null)
    advancing.current = false
  }, [currentId])

  /* بعد تحديث الصفحة من الخادم: العدّاد لا يتراجع */
  useEffect(() => {
    setTally((t) => ({ correct: Math.max(t.correct, session.correctCount), answered: Math.max(t.answered, session.answeredCount), xp: Math.max(t.xp, session.xpEarned) }))
  }, [session.correctCount, session.answeredCount, session.xpEarned])

  /* التركيز: السؤال بعد القلب، والبطاقة الجديدة بعد «السؤال التالي»؛ والتصحيح ظاهر بعد الإجابة */
  useEffect(() => {
    if (phase === 'question') questionRef.current?.focus({ preventScroll: true })
    if (phase === 'answered') correctionRef.current?.scrollIntoView({ block: 'nearest', behavior: motion ? 'smooth' : 'auto' })
    if (phase === 'covered' && focusBackOnLoad.current) {
      focusBackOnLoad.current = false
      backRef.current?.focus({ preventScroll: true })
    }
  }, [phase, currentId, motion])

  const reveal = useCallback(() => {
    dispatch({ type: 'REVEAL', reducedMotion: !motion })
    startedAt.current = Date.now()
  }, [motion])
  const flipEnd = useCallback(() => dispatch({ type: 'FLIP_END' }), [])

  const ready = current ? answerReady(current.payload, answer) : false

  const submit = () => {
    if (!current || !online || !canSubmit(card, ready) || !gate.current.tryEnter()) return
    dispatch({ type: 'SUBMIT' })
    const questionId = current.id
    void (async () => {
      try {
        const r = await submitPlayAnswerAction({ sessionId: session.id, questionId, answer, timeMs: Math.min(3_600_000, Date.now() - startedAt.current) })
        if (!r.ok) {
          dispatch({ type: 'SUBMIT_FAIL' })
          if (r.error.code === 'PLAY_SESSION_EXPIRED') setExpired(true)
          else if (r.error.code === 'PLAY_ALREADY_ANSWERED' || r.error.code === 'PLAY_SESSION_CLOSED') router.refresh()
          toast('error', r.error.message)
          return
        }
        const d = r.data
        setResult({ isCorrect: d.isCorrect, correctText: d.correctText, explanation: d.explanation, xp: d.xp, lessonMastered: d.lessonMastered })
        setOutcomes((o) => ({ ...o, [questionId]: d.isCorrect }))
        setTally({ correct: d.correctCount, answered: d.answeredCount, xp: d.sessionXp })
        setStanding({ level: { title: d.level.title, progressPct: d.level.progressPct, nextMinXp: d.level.nextMinXp }, xpTotal: d.xpTotal })
        if (d.newBadges.length) setNewBadges((b) => [...b, ...d.newBadges])
        dispatch({ type: 'SUBMIT_OK' })
        setAnnounce(d.isCorrect ? `إجابة صحيحة${d.xp > 0 ? `، ‎+${d.xp} نقطة` : ''}` : `إجابة غير صحيحة. ${d.correctText ? `الإجابة الصحيحة: ${d.correctText}` : ''}`)
        beep(d.isCorrect ? 'ok' : 'bad')
        if (d.sessionCompleted) setTimeout(() => beep('win'), 500)
      } catch {
        // انقطاع الشبكة: لا نعرف هل سُجّلت؛ إعادة المحاولة آمنة لأن الخادم يرفض التكرار ثم تُعرض النتيجة المحفوظة
        dispatch({ type: 'SUBMIT_FAIL' })
        toast('error', 'تعذّر الاتصال بالخادم. تحقّق من الإنترنت ثم أعد المحاولة.')
      } finally {
        gate.current.leave()
      }
    })()
  }

  const next = () => {
    if (phase !== 'answered' || advancing.current) return
    advancing.current = true
    dispatch({ type: 'NEXT' })
    focusBackOnLoad.current = true
    setAnnounce('')
    const go = () => {
      if (index + 1 >= questions.length) {
        setIndex(questions.length)
        router.refresh()
      } else setIndex(index + 1)
    }
    if (motion) setTimeout(go, LEAVE_MS)
    else go()
  }

  const toggleSound = () => {
    const v = !sound
    setSound(v)
    void setPlayPrefsAction({ sound: v })
  }

  const challengeName = CHALLENGE_NAMES[session.challengeType as PlayChallengeType] ?? session.challengeType
  const total = questions.length
  const outcomeOf = (q: SessionQuestionView): boolean | null => outcomes[q.id] ?? q.answered?.isCorrect ?? null

  /* ------------------------------ نتيجة الجولة ------------------------------ */
  if (finished || !current) {
    const pct = Math.round((tally.correct / Math.max(1, total)) * 100)
    const headline = expired ? 'انتهى الوقت!' : pct >= 80 ? 'ممتاز! أداء رائع' : pct >= 50 ? 'جيد، واصل التدريب' : 'لا بأس، كل خطأ فرصة للتعلم'
    const streak = longestStreak(questions.map(outcomeOf))
    const wrong = questions.filter((q) => q.answered && !q.answered.isCorrect)
    const lvl = standing.level
    return (
      <DeckShell>
        <section className={cn('rounded-[20px] border border-deck-line bg-card p-5 text-center shadow-lift sm:p-6', motion && 'animate-scale-in')} aria-labelledby="round-result-title">
          <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-deck-gold/15 text-deck-gold" aria-hidden>
            {expired ? <Clock className="size-10" /> : pct >= 50 ? <Trophy className="size-10" /> : <RotateCcw className="size-9" />}
          </div>
          <h2 id="round-result-title" className="mt-3 text-2xl font-extrabold">
            {headline}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {challengeName} · {subjectName}
          </p>
          <dl className="mt-5 divide-y divide-deck-line overflow-hidden rounded-[14px] border border-deck-line text-start">
            <ResultRow icon={<CheckCircle2 className="size-5 text-success" />} label="الإجابات الصحيحة" value={`${tally.correct} من ${total}`} />
            <ResultRow icon={<Coins className="size-5 text-deck-gold" />} label="النقاط المحصّلة" value={<bdi dir="ltr">+{tally.xp}</bdi>} />
            <ResultRow icon={<Flame className="size-5 text-primary" />} label="أطول سلسلة صحيحة" value={streak} />
          </dl>
          {lvl ? (
            <div className="mt-5 text-start">
              <div className="flex items-baseline justify-between gap-2 text-sm font-bold">
                <span>مستواك: {lvl.title}</span>
                <span className="tabular-nums text-muted-foreground">{standing.xpTotal} نقطة</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-deck-line" role="progressbar" aria-label="التقدّم نحو المستوى التالي" aria-valuenow={lvl.progressPct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-primary" style={{ width: `${lvl.progressPct}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{lvl.nextMinXp !== null ? `${Math.max(0, lvl.nextMinXp - standing.xpTotal)} نقطة للمستوى التالي` : 'بلغتَ أعلى مستوى'}</p>
            </div>
          ) : null}
          {newBadges.length ? (
            <div className="mt-5 space-y-2">
              <p className="text-sm font-bold">شارات جديدة</p>
              <div className="flex flex-wrap justify-center gap-2">
                {newBadges.map((b) => (
                  <span key={b.code} className="inline-flex items-center gap-1 rounded-full border border-deck-gold/40 bg-deck-gold/10 px-3 py-1 text-sm font-bold text-deck-gold-ink">
                    <LucideIcon name={b.icon} className="size-4" /> {b.nameAr}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>
        <div className="grid gap-2 sm:grid-cols-2">
          <StartButton target={retry} timed={session.timed} size="lg" className="w-full rounded-[14px]">
            <RotateCcw className="size-4" /> إعادة المحاولة
          </StartButton>
          <Button asChild size="lg" variant="outline" className="w-full rounded-[14px]">
            <Link href={backHref}>
              <BookOpen className="size-4" /> {backHref === '/student/play' ? 'العودة إلى المواد' : 'العودة للدروس'}
            </Link>
          </Button>
        </div>
        {wrong.length ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold">الأسئلة التي أخطأت فيها</h3>
              <Link href="/student/play/mistakes" className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-semibold text-primary hover:underline">
                راجع أخطاءك
              </Link>
            </div>
            {wrong.map((q) => (
              <div key={q.id} className="rounded-[14px] border border-deck-line bg-card p-4 text-sm">
                <RichText text={q.questionText} className="font-semibold" as="p" />
                <p className="mt-2 text-success">
                  الإجابة الصحيحة: <strong>{q.answered!.correctText}</strong>
                </p>
                <p className="mt-1 text-muted-foreground">{q.answered!.explanation}</p>
              </div>
            ))}
          </div>
        ) : null}
      </DeckShell>
    )
  }

  /* --------------------------------- الجولة --------------------------------- */
  const shown: ShownResult | null = result ?? (current.answered ? { ...current.answered, lessonMastered: false } : null)
  const answered = phase === 'answered' || phase === 'next'
  const done = Math.min(total, index + (answered ? 1 : 0))
  const progressPct = Math.round((done / Math.max(1, total)) * 100)
  const cardProps = { payload: current.payload, disabled: answered || card.submitting, onChange: setAnswer, result: shown ? { isCorrect: shown.isCorrect, correctText: shown.correctText } : null, motion, layout: 'stack' as const }
  const isLast = index + 1 >= total

  return (
    <DeckShell>
      {/* الشريط العلوي */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPauseOpen(true)} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-[hsl(var(--brand-blue-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" aria-label="إيقاف التحدي أو الخروج">
            <Pause className="size-5" fill="currentColor" aria-hidden />
          </button>
          <div className="flex min-w-0 flex-1 justify-center">
            <span className="truncate rounded-full border border-deck-line bg-card px-4 py-1.5 text-sm font-extrabold tabular-nums shadow-sm">
              السؤال {index + 1} من {total}
            </span>
          </div>
          {remaining !== null ? (
            <span className={cn('inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-xs font-bold tabular-nums', remaining <= 30 ? 'bg-destructive/10 text-destructive' : 'bg-card text-foreground')} aria-label={`الوقت المتبقي ${Math.floor(remaining / 60)} دقيقة و${remaining % 60} ثانية`}>
              <Clock className="size-3.5" aria-hidden /> {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
            </span>
          ) : null}
          <span className="inline-flex h-11 min-w-11 items-center justify-end gap-1 text-sm font-extrabold tabular-nums" aria-label={`نقاط الجولة: ${tally.xp}`}>
            <Trophy className="size-5 text-deck-gold" aria-hidden />
            <span aria-hidden>{tally.xp}</span>
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-deck-line" role="progressbar" aria-label="تقدّم الجولة" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total} aria-valuetext={`${done} من ${total}`}>
          <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${progressPct}%` }} />
        </div>
        <p className="truncate text-center text-xs text-muted-foreground">
          {challengeName} · {subjectName}
        </p>
      </div>

      {!online ? (
        <div role="alert" className="flex items-start gap-2 rounded-[14px] border border-warning/30 bg-warning/10 p-3 text-sm">
          <WifiOff className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <span>لا يوجد اتصال بالإنترنت. إجاباتك السابقة محفوظة؛ أكمل عند عودة الاتصال.</span>
        </div>
      ) : null}

      {/* البطاقة */}
      <FlipCard key={current.id} phase={phase} position={index + 1} total={total} motion={motion} onReveal={reveal} onFlipEnd={flipEnd} backRef={backRef} className={cn(motion && 'animate-fade-in')}>
        <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="min-w-0 truncate rounded-full bg-deck-bg px-2.5 py-1 font-semibold text-muted-foreground">{current.lessonName}</span>
            <DifficultyPill value={current.difficulty} />
          </div>
          <div className="flex justify-center text-primary" aria-hidden>
            <BookGlyph className="size-9" />
          </div>
          <div ref={questionRef} tabIndex={-1} className="outline-none">
            {current.payload.type !== 'FILL_BLANK' ? (
              <RichText as="p" text={current.questionText} className="text-center text-lg font-extrabold leading-relaxed [overflow-wrap:anywhere] sm:text-xl" />
            ) : (
              <p className="text-center text-sm font-bold text-muted-foreground">أكمل الفراغ بالكلمة المناسبة:</p>
            )}
          </div>
          {shown && answered ? <Correction ref={correctionRef} result={shown} showCorrect={current.payload.type === 'MCQ'} /> : null}
          <div>
            {current.payload.type === 'MCQ' ? <McqCard {...cardProps} /> : current.payload.type === 'FILL_BLANK' ? <FillBlankCard {...cardProps} /> : current.payload.type === 'MATCHING' ? <MatchingCard {...cardProps} /> : <OrderingCard {...cardProps} />}
          </div>
        </div>
      </FlipCard>

      {/* الإجراءات */}
      {phase === 'covered' || phase === 'flipping' ? (
        <p className="flex min-h-12 items-center justify-center gap-2 text-sm font-semibold text-muted-foreground" aria-hidden>
          <Pointer className="size-5 text-primary" /> اضغط على البطاقة لعرض السؤال
        </p>
      ) : (
        <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 flex items-center gap-2 rounded-2xl border border-deck-line bg-card/95 p-2 shadow-lift backdrop-blur lg:bottom-4">
          <button type="button" onClick={() => setReportOpen(true)} className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="الإبلاغ عن خطأ في السؤال">
            <Flag className="size-4" aria-hidden /> <span className="hidden sm:inline">إبلاغ</span>
          </button>
          {answered ? (
            <Button key="card-action" size="lg" onClick={next} disabled={phase === 'next'} className="flex-1 rounded-[14px]">
              {isLast ? 'عرض النتيجة' : 'السؤال التالي'} <ChevronLeft className="size-5" aria-hidden />
            </Button>
          ) : (
            <Button key="card-action" size="lg" onClick={submit} disabled={!ready || !online} loading={card.submitting} className="flex-1 rounded-[14px]">
              تحقّق من الإجابة
            </Button>
          )}
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} questionId={current.id} sessionId={session.id} />
      <Dialog open={pauseOpen} onOpenChange={setPauseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إيقاف التحدي</DialogTitle>
            <DialogDescription>
              يمكنك العودة لاحقاً من «أكمل من حيث توقفت» ما لم تبدأ تحدياً جديداً.
              {session.timed ? ' في الوضع بالمؤقت يستمر الوقت في العدّ.' : ''}
            </DialogDescription>
          </DialogHeader>
          <button type="button" role="switch" aria-checked={sound} onClick={toggleSound} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-[14px] border border-border px-4 py-2 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="inline-flex items-center gap-2">
              {sound ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />} أصوات التصحيح
            </span>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', sound ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>{sound ? 'مفعّلة' : 'معطّلة'}</span>
          </button>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPauseOpen(false)}>
              متابعة اللعب
            </Button>
            <Button variant="secondary" onClick={() => router.push('/student/play')}>
              حفظ والعودة
            </Button>
            <Button
              variant="destructive"
              loading={leaving}
              onClick={() => {
                if (leaving) return
                setLeaving(true)
                void abandonPlaySessionAction(session.id)
                  .then(() => router.push('/student/play'))
                  .catch(() => {
                    setLeaving(false)
                    toast('error', 'تعذّر الاتصال بالخادم. حاول مرة أخرى.')
                  })
              }}
            >
              إنهاء التحدي
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DeckShell>
  )
}

/** خلفية اللعبة البيضاء المائلة للأزرق؛ على الهاتف تمتد بعرض الشاشة */
function DeckShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="play-deck -mx-4 -mt-6 mb-[calc(-100px-env(safe-area-inset-bottom))] min-h-[calc(100svh-140px)] bg-deck-bg px-4 pb-[calc(124px+env(safe-area-inset-bottom))] pt-4 sm:mx-auto sm:mb-0 sm:mt-0 sm:min-h-0 sm:max-w-2xl sm:rounded-[28px] sm:border sm:border-deck-line sm:px-8 sm:py-8">
      <div className="mx-auto w-full max-w-[24rem] space-y-4 sm:max-w-[26rem]">{children}</div>
    </div>
  )
}

function Correction({ result, showCorrect, ref }: { result: ShownResult; showCorrect: boolean; ref?: React.Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} className={cn('scroll-mb-44 scroll-mt-24 rounded-[14px] border p-3.5', result.isCorrect ? 'border-success/30 bg-success/10' : 'border-destructive/25 bg-destructive/5')} data-testid="card-correction">
      <div className="flex items-center gap-2">
        {result.isCorrect ? <CheckCircle2 className="size-6 shrink-0 text-success" aria-hidden /> : <XCircle className="size-6 shrink-0 text-destructive" aria-hidden />}
        <p className={cn('text-base font-extrabold', result.isCorrect ? 'text-success' : 'text-destructive')}>{result.isCorrect ? 'إجابة صحيحة' : 'إجابة غير صحيحة'}</p>
        {result.xp > 0 ? (
          <span className="ms-auto inline-flex items-center gap-1 rounded-full bg-deck-gold/15 px-2.5 py-0.5 text-sm font-bold text-deck-gold-ink">
            <Coins className="size-4 text-deck-gold" aria-hidden /> <bdi dir="ltr">+{result.xp}</bdi> نقطة
          </span>
        ) : null}
      </div>
      {!result.isCorrect && showCorrect ? (
        <p className="mt-2 text-sm">
          الإجابة الصحيحة: <strong>{result.correctText}</strong>
        </p>
      ) : null}
      {result.explanation ? <p className="mt-1.5 text-sm leading-relaxed text-foreground/85">{result.explanation}</p> : null}
      {result.lessonMastered ? (
        <p className="mt-1.5 inline-flex items-center gap-1 text-sm font-bold text-primary">
          <Sparkles className="size-4" aria-hidden /> أتقنتَ هذا الدرس! نقاط إضافية
        </p>
      ) : null}
    </div>
  )
}

function ResultRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 bg-card px-4 py-3">
      <span aria-hidden>{icon}</span>
      <dt className="flex-1 text-sm font-semibold">{label}</dt>
      <dd className="text-lg font-extrabold tabular-nums">{value}</dd>
    </div>
  )
}
