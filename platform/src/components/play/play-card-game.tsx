'use client'

import { ChevronRight, Flag, Flame, Pause, Sparkles, Timer, Volume2, VolumeX, WifiOff } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
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
import { DeckMcq } from './deck-choices'
import { DECK_BUTTON } from './deck-ui'
import { FlipCard } from './flip-card'
import { PlayImmersive } from './immersive'
import { BookTabIcon, CoinDot, CoinsArt, ResultBadge, TapHandArt, TrophyArt, TrophyGlyph } from './play-art'
import { ReportDialog, useBeep, type PlayGameProps } from './play-game'
import { FillBlankCard, MatchingCard, OrderingCard } from './question-cards'
import { RichText } from './rich-text'
import { LucideIcon } from './visuals'

export interface PlayLevelView {
  title: string
  progressPct: number
  nextMinXp: number | null
}

export interface PlayCardGameProps extends PlayGameProps {
  /** «تابع اللعب»: جولة جديدة بالتحدي نفسه عبر startPlaySessionAction الحالي */
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

const clock = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`

/**
 * جولة MADRASADZ PLAY بالبطاقات كما في حزمة الهوية المعتمدة: الأسئلة نفسها، والتصحيح والتسجيل نفسيهما
 * (submitPlayAnswerAction)، والصلاحيات نفسها. الواجهة السابقة باقية في PlayGame (?view=classic).
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
  // الساعة تبدأ بعد التركيب فقط (لا اختلاف بين الخادم والمتصفح)
  const [now, setNow] = useState<number | null>(null)
  const [revealedAt, setRevealedAt] = useState<number | null>(null)
  const [frozenAt, setFrozenAt] = useState<number | null>(null)
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
  const actionRef = useRef<HTMLDivElement>(null)
  const focusBackOnLoad = useRef(false)

  const finished = index >= questions.length || session.status === 'COMPLETED' || expired
  // حالة البطاقة المعروضة: بطاقة جديدة تبدأ مغلقة حتى لو لم يصل LOAD بعد
  const phase = current && card.questionId === current.id ? card.phase : 'covered'

  /* المؤقت: في الوضع بالمؤقت الوقت المتبقي كما يحدده الخادم، وإلا الوقت المنقضي على السؤال (عرض فقط) */
  useEffect(() => {
    setNow(Date.now())
    if (finished) return
    const iv = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(iv)
  }, [finished])
  const remaining = now !== null && session.timed && session.expiresAt ? Math.max(0, Math.floor((new Date(session.expiresAt).getTime() - now) / 1000)) : null
  const elapsed = now !== null && revealedAt !== null ? Math.max(0, Math.floor(((frozenAt ?? now) - revealedAt) / 1000)) : 0
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
    setRevealedAt(null)
    setFrozenAt(null)
    advancing.current = false
  }, [currentId])

  /* بعد تحديث الصفحة من الخادم: العدّاد لا يتراجع */
  useEffect(() => {
    setTally((t) => ({ correct: Math.max(t.correct, session.correctCount), answered: Math.max(t.answered, session.answeredCount), xp: Math.max(t.xp, session.xpEarned) }))
  }, [session.correctCount, session.answeredCount, session.xpEarned])

  /* التركيز: السؤال بعد الدوران، والبطاقة الجديدة بعد «السؤال التالي»؛ وزر المتابعة ظاهر بعد الإجابة */
  useEffect(() => {
    if (phase === 'question') questionRef.current?.focus({ preventScroll: true })
    if (phase === 'covered' && focusBackOnLoad.current) {
      focusBackOnLoad.current = false
      backRef.current?.focus({ preventScroll: true })
    }
  }, [phase, currentId])

  const reveal = useCallback(() => {
    dispatch({ type: 'REVEAL', reducedMotion: !motion })
    startedAt.current = Date.now()
    setRevealedAt((t) => t ?? Date.now())
  }, [motion])
  const flipEnd = useCallback(() => dispatch({ type: 'FLIP_END' }), [])

  const submit = (given: PlayStudentAnswer | null = answer) => {
    if (!current || !online || !canSubmit(card, answerReady(current.payload, given)) || !gate.current.tryEnter()) return
    dispatch({ type: 'SUBMIT' })
    const questionId = current.id
    void (async () => {
      try {
        const r = await submitPlayAnswerAction({ sessionId: session.id, questionId, answer: given, timeMs: Math.min(3_600_000, Date.now() - startedAt.current) })
        if (!r.ok) {
          dispatch({ type: 'SUBMIT_FAIL' })
          if (r.error.code === 'PLAY_SESSION_EXPIRED') setExpired(true)
          else if (r.error.code === 'PLAY_ALREADY_ANSWERED' || r.error.code === 'PLAY_SESSION_CLOSED') router.refresh()
          // انتهت التجربة المجانية أثناء الجولة: الصفحة الرئيسية تعرض دعوة الاشتراك (الخادم رفض الإجابة)
          else if (r.error.code === 'PLAY_TRIAL_EXPIRED' || r.error.code === 'PLAY_TRIAL_REQUIRED') router.push('/student/play')
          toast('error', r.error.message)
          return
        }
        const d = r.data
        setResult({ isCorrect: d.isCorrect, correctText: d.correctText, explanation: d.explanation, xp: d.xp, lessonMastered: d.lessonMastered })
        setOutcomes((o) => ({ ...o, [questionId]: d.isCorrect }))
        setTally({ correct: d.correctCount, answered: d.answeredCount, xp: d.sessionXp })
        setStanding({ level: { title: d.level.title, progressPct: d.level.progressPct, nextMinXp: d.level.nextMinXp }, xpTotal: d.xpTotal })
        if (d.newBadges.length) setNewBadges((b) => [...b, ...d.newBadges])
        setFrozenAt(Date.now())
        dispatch({ type: 'SUBMIT_OK' })
        setAnnounce(d.isCorrect ? `إجابة صحيحة${d.xp > 0 ? `، ‎+${d.xp} نقطة` : ''}` : `إجابة خاطئة. ${d.correctText ? `الإجابة الصحيحة: ${d.correctText}` : ''}`)
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

  /** الاختيار المتعدد كما في المرجع: لمس الخيار يختاره ويرسله مباشرة (مرة واحدة) */
  const pickOption = (key: string) => {
    if (phase !== 'question' || card.submitting) return
    const a: PlayStudentAnswer = { type: 'MCQ', key }
    setAnswer(a)
    submit(a)
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

  const endChallenge = () => {
    if (leaving) return
    setLeaving(true)
    void abandonPlaySessionAction(session.id)
      .then(() => router.push('/student/play'))
      .catch(() => {
        setLeaving(false)
        toast('error', 'تعذّر الاتصال بالخادم. حاول مرة أخرى.')
      })
  }

  const challengeName = CHALLENGE_NAMES[session.challengeType as PlayChallengeType] ?? session.challengeType
  const total = questions.length
  const outcomeOf = (q: SessionQuestionView): boolean | null => outcomes[q.id] ?? q.answered?.isCorrect ?? null
  const answered = phase === 'answered' || phase === 'next'
  const done = finished ? total : Math.min(total, index + (answered ? 1 : 0))

  const pauseDialog = (
    <Dialog open={pauseOpen} onOpenChange={setPauseOpen}>
      <DialogContent className="play-deck">
        <DialogHeader>
          <DialogTitle>{finished ? 'انتهت الجولة' : 'إيقاف مؤقت'}</DialogTitle>
          <DialogDescription>
            {challengeName} · {subjectName}
            {!finished ? '. يمكنك العودة لاحقاً من «أكمل من حيث توقفت» ما لم تبدأ تحدياً جديداً.' : ''}
            {!finished && session.timed ? ' في الوضع بالمؤقت يستمر الوقت في العدّ.' : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <button type="button" role="switch" aria-checked={sound} onClick={toggleSound} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-[14px] border border-border px-4 py-2 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="inline-flex items-center gap-2">
              {sound ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />} أصوات التصحيح
            </span>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', sound ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>{sound ? 'مفعّلة' : 'معطّلة'}</span>
          </button>
          {current && !finished ? (
            <button
              type="button"
              onClick={() => {
                setPauseOpen(false)
                setReportOpen(true)
              }}
              className="flex min-h-11 w-full items-center gap-2 rounded-[14px] border border-border px-4 py-2 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Flag className="size-4" aria-hidden /> الإبلاغ عن خطأ في هذا السؤال
            </button>
          ) : null}
        </div>
        <DialogFooter className="gap-2">
          {finished ? (
            <Button variant="outline" onClick={() => router.push('/student/play')}>
              العودة إلى لعبة الأسئلة
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setPauseOpen(false)}>
                متابعة اللعب
              </Button>
              <Button variant="secondary" onClick={() => router.push('/student/play')}>
                حفظ والعودة
              </Button>
              <Button variant="destructive" loading={leaving} onClick={endChallenge}>
                إنهاء التحدي
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  const topBar = <DeckTopBar position={finished ? total : index + 1} total={total} done={finished ? total : Math.max(done, index + 1)} points={standing.xpTotal} onPause={() => setPauseOpen(true)} />

  /* ------------------------------ نتيجة الجولة (06) ------------------------------ */
  if (finished || !current) {
    const streak = longestStreak(questions.map(outcomeOf))
    const wrong = questions.filter((q) => q.answered && !q.answered.isCorrect)
    const lvl = standing.level
    return (
      <DeckShell>
        <PlayImmersive />
        {topBar}
        <section className={cn('pt-4', motion && 'animate-scale-in')} aria-labelledby="round-result-title">
          <h2 id="round-result-title" className="sr-only">
            {expired ? 'انتهى الوقت' : 'نتيجة الجولة'}
          </h2>
          <TrophyArt className="mx-auto w-[82%] max-w-[18rem]" />
          {expired ? <p className="mt-1 text-center text-sm font-bold text-destructive">انتهى الوقت</p> : null}
          <dl className="mt-4 divide-y divide-[#E1E8F5] rounded-[22px] border border-[#D3E0F5] bg-white px-4 shadow-[0_16px_32px_-20px_rgba(20,87,197,0.45)]">
            <ResultRow icon={<ResultBadge ok className="size-8" />} label="الإجابات الصحيحة" value={tally.correct} suffix={`من ${total}`} />
            <ResultRow icon={<CoinsArt className="h-8 w-9" />} label="النقاط المحصلة" value={tally.xp} />
            <ResultRow icon={<Flame className="size-8 fill-[#FF8A1F] text-[#E8541B]" strokeWidth={1.4} />} label="السلسلة المتتالية" value={streak} />
          </dl>
        </section>
        <div className="space-y-3 pt-4">
          <StartButton target={retry} timed={session.timed} className={DECK_BUTTON}>
            <ChevronRight className="size-6" strokeWidth={3} aria-hidden /> تابع اللعب
          </StartButton>
          <Link href={backHref} className="mx-auto flex min-h-11 w-fit items-center rounded-full px-4 text-sm font-bold text-primary hover:underline">
            {backHref === '/student/play' ? 'العودة إلى المواد' : 'العودة للدروس'}
          </Link>
        </div>
        {lvl ? (
          <div className="rounded-[18px] border border-[#D3E0F5] bg-white p-4">
            <div className="flex items-baseline justify-between gap-2 text-sm font-bold">
              <span>مستواك: {lvl.title}</span>
              <span className="tabular-nums text-muted-foreground">{standing.xpTotal} نقطة</span>
            </div>
            <div dir="ltr" className="mt-2 h-2 overflow-hidden rounded-full bg-[#DCE6F7]" role="progressbar" aria-label="التقدّم نحو المستوى التالي" aria-valuenow={lvl.progressPct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-gradient-to-r from-[#4C8DF0] to-primary" style={{ width: `${lvl.progressPct}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{lvl.nextMinXp !== null ? `${Math.max(0, lvl.nextMinXp - standing.xpTotal)} نقطة للمستوى التالي` : 'بلغتَ أعلى مستوى'}</p>
            {newBadges.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {newBadges.map((b) => (
                  <span key={b.code} className="inline-flex items-center gap-1 rounded-full border border-deck-gold/50 bg-deck-gold/15 px-3 py-1 text-sm font-bold text-deck-gold-ink">
                    <LucideIcon name={b.icon} className="size-4" /> {b.nameAr}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {wrong.length ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold">الأسئلة التي أخطأت فيها</h3>
              <Link href="/student/play/mistakes" className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-semibold text-primary hover:underline">
                راجع أخطاءك
              </Link>
            </div>
            {wrong.map((q) => (
              <div key={q.id} className="rounded-[18px] border border-[#D3E0F5] bg-white p-4 text-sm">
                <RichText text={q.questionText} className="font-semibold" as="p" />
                <p className="mt-2 text-success">
                  الإجابة الصحيحة: <strong>{q.answered!.correctText}</strong>
                </p>
                <p className="mt-1 text-muted-foreground">{q.answered!.explanation}</p>
              </div>
            ))}
          </div>
        ) : null}
        {pauseDialog}
      </DeckShell>
    )
  }

  /* --------------------------------- الجولة (02–05) --------------------------------- */
  const shown: ShownResult | null = result ?? (current.answered ? { ...current.answered, lessonMastered: false } : null)
  const isMcq = current.payload.type === 'MCQ'
  const cardProps = { payload: current.payload, disabled: answered || card.submitting, onChange: setAnswer, result: shown ? { isCorrect: shown.isCorrect, correctText: shown.correctText } : null, motion, bare: true }
  const isLast = index + 1 >= total
  const pickedKey = answer?.type === 'MCQ' ? answer.key : null

  return (
    <DeckShell>
      <PlayImmersive />
      {topBar}

      {!online ? (
        <div role="alert" className="flex items-start gap-2 rounded-[14px] border border-warning/30 bg-warning/10 p-3 text-sm">
          <WifiOff className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <span>لا يوجد اتصال بالإنترنت. إجاباتك السابقة محفوظة؛ أكمل عند عودة الاتصال.</span>
        </div>
      ) : null}

      <div className={phase === 'covered' || phase === 'flipping' ? 'pt-7' : 'pt-6'}>
      <FlipCard key={current.id} phase={phase} position={index + 1} total={total} motion={motion} onReveal={reveal} onFlipEnd={flipEnd} backRef={backRef} className={cn(motion && 'animate-fade-in')}>
        <span className="deck-tab" aria-hidden>
          <BookTabIcon className="h-8 w-11" />
        </span>
        <div className="space-y-4 px-4 pb-5 pt-9 sm:px-5">
          <div className="relative">
            <div ref={questionRef} tabIndex={-1} className={cn('outline-none', answered && 'deck-dim min-h-[10.5rem]')}>
              {current.payload.type !== 'FILL_BLANK' ? (
                <RichText as="p" text={current.questionText} className="text-center text-[1.4rem] font-extrabold leading-[1.7] text-[#172B50] [overflow-wrap:anywhere]" />
              ) : (
                <p className="text-center text-base font-extrabold text-[#3B4C6B]">أكمل الفراغ بالكلمة المناسبة:</p>
              )}
            </div>
            {shown && answered ? <ResultPanel result={shown} /> : null}
          </div>
          <div className={cn(answered && 'deck-answered')}>
            {isMcq ? (
              <DeckMcq payload={current.payload} picked={pickedKey} disabled={answered || card.submitting || phase !== 'question'} result={shown && answered ? { correctText: shown.correctText } : null} onPick={pickOption} />
            ) : current.payload.type === 'FILL_BLANK' ? (
              <FillBlankCard {...cardProps} />
            ) : current.payload.type === 'MATCHING' ? (
              <MatchingCard {...cardProps} />
            ) : (
              <OrderingCard {...cardProps} />
            )}
          </div>
          {shown && answered && shown.explanation ? (
            <p className="rounded-[16px] bg-[#F2F6FD] px-4 py-3 text-sm leading-relaxed text-[#3B4C6B]">
              <strong className="text-[#172B50]">الشرح: </strong>
              {shown.explanation}
            </p>
          ) : null}
          {shown && answered && shown.lessonMastered ? (
            <p className="flex items-center justify-center gap-1 text-sm font-bold text-primary">
              <Sparkles className="size-4" aria-hidden /> أتقنتَ هذا الدرس! نقاط إضافية
            </p>
          ) : null}
        </div>
      </FlipCard>
      </div>

      {/* تحت البطاقة */}
      {phase === 'covered' || phase === 'flipping' ? (
        <div className="flex flex-col items-center gap-2 pt-3" aria-hidden>
          <TapHandArt className="h-14 w-12" />
          <p className="text-[1.15rem] font-extrabold text-[#172B50]">اضغط على البطاقة لعرض السؤال</p>
        </div>
      ) : (
        <>
          {answered ? (
            <div ref={actionRef} className="sticky bottom-[calc(env(safe-area-inset-bottom)+12px)] z-20 pt-2">
              <button type="button" onClick={next} disabled={phase === 'next'} className={DECK_BUTTON}>
                <ChevronRight className="size-6" strokeWidth={3} aria-hidden /> {isLast ? 'عرض النتيجة' : 'السؤال التالي'}
              </button>
            </div>
          ) : !isMcq ? (
            <div ref={actionRef} className="sticky bottom-[calc(env(safe-area-inset-bottom)+12px)] z-20 pt-2">
              <button type="button" onClick={() => submit()} disabled={!answerReady(current.payload, answer) || !online || card.submitting} className={DECK_BUTTON} aria-busy={card.submitting || undefined}>
                {card.submitting ? 'جارٍ التحقق…' : 'تحقّق من الإجابة'}
              </button>
            </div>
          ) : null}
          {answered ? null : (
            <div className="flex items-center justify-end pt-1">
              <span dir="ltr" className="inline-flex h-12 items-center gap-2 rounded-full border border-[#D3E0F5] bg-white px-4 shadow-[0_6px_16px_-10px_rgba(20,87,197,0.45)]" aria-label={remaining !== null ? `الوقت المتبقي ${clock(remaining)}` : `الوقت المنقضي على هذا السؤال ${clock(elapsed)}`} role="timer">
                <Timer className={cn('size-7', remaining !== null && remaining <= 30 ? 'text-destructive' : 'text-[#172B50]')} strokeWidth={2.4} aria-hidden />
                <span dir="ltr" className={cn('text-[1.35rem] font-extrabold tabular-nums', remaining !== null && remaining <= 30 ? 'text-destructive' : 'text-[#172B50]')} aria-hidden>
                  {clock(remaining ?? elapsed)}
                </span>
              </span>
            </div>
          )}
        </>
      )}

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} questionId={current.id} sessionId={session.id} />
      {pauseDialog}
    </DeckShell>
  )
}

/** الشريط العلوي (02–06): النقاط يمينًا، رقم السؤال في الوسط، الإيقاف يسارًا، ثم شريط التقدّم */
function DeckTopBar({ position, total, done, points, onPause }: { position: number; total: number; done: number; points: number; onPause: () => void }) {
  const pct = Math.round((done / Math.max(1, total)) * 100)
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span dir="ltr" className="inline-flex min-w-[4.5rem] items-center gap-1 text-[0.95rem] font-extrabold tabular-nums text-[#172B50]" aria-label={`نقاطك: ${points}`}>
          <TrophyGlyph className="size-6" />
          <span aria-hidden>{points}</span>
          <CoinDot className="size-3.5" />
        </span>
        <div className="flex min-w-0 flex-1 justify-center">
          <span className="truncate rounded-full bg-[#E6EDF9] px-5 py-1.5 text-[0.95rem] font-extrabold tabular-nums text-[#172B50]">
            السؤال {position} من {total}
          </span>
        </div>
        <div className="flex min-w-[4.5rem] justify-end">
          <button type="button" onClick={onPause} className="flex size-11 items-center justify-center rounded-full text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/35" aria-label="إيقاف مؤقت">
            <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-b from-[#3D84F0] to-[#1457C5] shadow-[0_6px_14px_-6px_rgba(20,87,197,0.8)]">
              <Pause className="size-4" fill="currentColor" strokeWidth={0} aria-hidden />
            </span>
          </button>
        </div>
      </div>
      <div dir="ltr" className="h-2.5 overflow-hidden rounded-full bg-[#DCE6F7]" role="progressbar" aria-label="تقدّم الجولة" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total} aria-valuetext={`${done} من ${total}`}>
        <div className="h-full rounded-full bg-gradient-to-r from-[#4C8DF0] to-[#1457C5] transition-[width] duration-500" style={{ width: `${Math.max(pct, done > 0 ? 6 : 0)}%` }} />
      </div>
    </div>
  )
}

/** خلفية اللعبة الفاتحة: كامل الشاشة على الهاتف واللوحي، ولوحة في وسط الصفحة على الحاسوب */
function DeckShell({ children }: { children: ReactNode }) {
  return (
    <div className="play-deck -mx-4 min-h-[100svh] bg-[linear-gradient(180deg,#F7F9FF_0%,#EEF3FB_100%)] px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-[calc(env(safe-area-inset-top)+16px)] lg:mx-auto lg:min-h-0 lg:max-w-2xl lg:rounded-[32px] lg:border lg:border-[#D3E0F5] lg:px-10 lg:py-8">
      <div className="mx-auto w-full max-w-[24rem] space-y-4 lg:max-w-[26rem]">{children}</div>
    </div>
  )
}

/** لوحة النتيجة فوق البطاقة (05): الشارة، «إجابة صحيحة»، والنقاط */
function ResultPanel({ result }: { result: ShownResult }) {
  const ok = result.isCorrect
  return (
    <div className={cn('absolute inset-x-[6%] top-2 z-10 rounded-[22px] border px-4 pb-4 pt-9 text-center shadow-[0_18px_30px_-18px_rgba(20,87,197,0.55)]', ok ? 'border-[#BFE6C8] bg-gradient-to-b from-[#ECF9EF] to-[#DDF3E3]' : 'border-[#F2C6C6] bg-gradient-to-b from-[#FFF3F3] to-[#FBE3E3]')} data-testid="card-correction">
      <ResultBadge ok={ok} className="absolute -top-7 left-1/2 size-14 -translate-x-1/2 drop-shadow-[0_6px_10px_rgba(0,0,0,0.18)]" />
      <p className={cn('text-[1.9rem] font-extrabold leading-tight', ok ? 'text-[#1C7A3A]' : 'text-[#B3261E]')}>{ok ? 'إجابة صحيحة' : 'إجابة خاطئة'}</p>
      <div className={cn('mx-auto my-3 h-px w-4/5', ok ? 'bg-[#BFE6C8]' : 'bg-[#F2C6C6]')} />
      {ok ? (
        <p className="flex items-center justify-center gap-2 text-[1.5rem] font-extrabold text-[#1C7A3A]">
          {result.xp > 0 ? (
            <>
              <bdi dir="ltr">+{result.xp}</bdi> نقطة <CoinsArt className="h-8 w-10" />
            </>
          ) : (
            'أحسنت!'
          )}
        </p>
      ) : (
        <p className="text-base font-bold text-[#7A2E2E]">الإجابة الصحيحة موضّحة أدناه</p>
      )}
    </div>
  )
}

function ResultRow({ icon, label, value, suffix }: { icon: ReactNode; label: string; value: number; suffix?: string }) {
  return (
    <div className="flex items-center gap-3 py-4">
      <span aria-hidden className="flex w-10 justify-center">
        {icon}
      </span>
      <dt className="flex-1 text-[1.15rem] font-extrabold text-[#172B50]">{label}</dt>
      <dd className="min-w-14 text-center text-[1.65rem] font-extrabold tabular-nums text-[#172B50]">
        {value}
        {suffix ? <span className="ms-1 text-xs font-bold text-muted-foreground">{suffix}</span> : null}
      </dd>
    </div>
  )
}
