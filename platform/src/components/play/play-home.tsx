'use client'

import { Check, ChevronRight, Play, PlayCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { setPlayPrefsAction } from '@/server/actions/play.actions'
import { CHALLENGE_NAMES, streamName, type PlayChallengeType } from '@/server/play/constants'
import type { getPlayDashboard, listLessonsFor } from '@/server/services/play.service'
import { StartButton, type LaunchTarget, useTimedPref } from './challenge-launcher'
import { DECK_BUTTON } from './deck-ui'
import { BooksArt, CapArt, GamepadArt, GearArt, LessonDocArt, StatsArt, TrophyGlyph } from './play-art'

type Dashboard = Awaited<ReturnType<typeof getPlayDashboard>>
type Units = Awaited<ReturnType<typeof listLessonsFor>>

type Pick = { kind: 'subject' } | { kind: 'unit'; unitCode: string; name: string } | { kind: 'lesson'; lessonId: string; unitCode: string; name: string }

/** الاختيار الافتراضي: أول درس فيه أسئلة ولم يُتقن بعد، وإلا كل دروس المادة */
function defaultPick(units: Units): Pick {
  for (const u of units) for (const l of u.lessons) if (l.questions > 0 && !l.mastered) return { kind: 'lesson', lessonId: l.id, unitCode: u.unitCode, name: l.lessonName }
  return { kind: 'subject' }
}

/**
 * الشاشة الأولى للعبة كما في 01: العنوان، ثم السنة والمادة والدرس، ثم «ابدأ اللعب» والبلاطات الثلاث.
 * البيانات حقيقية (ملف التلميذ، مواد سنته، دروس المادة)، والبدء عبر startPlaySessionAction نفسه.
 */
export function PlayHome({ data, subjectCode, units }: { data: Dashboard; subjectCode: string | null; units: Units }) {
  const router = useRouter()
  const [timed, setTimed] = useTimedPref()
  const [sheet, setSheet] = useState<'subject' | 'lesson' | 'settings' | null>(null)
  const [pick, setPick] = useState<Pick>(() => defaultPick(units))
  const [switching, startSwitch] = useTransition()
  const [prefs, setPrefs] = useState({ sound: data.profile.prefs?.sound ?? false, motion: data.profile.prefs?.motion ?? true })
  const subject = data.subjects.find((s) => s.code === subjectCode) ?? null
  const unitOf = useMemo(() => new Map(units.map((u) => [u.unitCode, u])), [units])
  const safePick: Pick = pick.kind !== 'subject' && !unitOf.has(pick.unitCode) ? defaultPick(units) : pick

  // «الثالثة ثانوي» كما في المرجع (بلا «السنة» ولا ما بين القوسين)، ثم الشعبة إن وُجدت
  const gradeLabel = data.grade ? `${data.grade.nameAr.replace(/^السنة\s+/, '').replace(/\s*\(.*\)\s*$/, '')}${data.profile.streamCode ? ` · ${streamName(data.profile.streamCode)}` : ''}` : 'اختر سنتك الدراسية'
  const lessonLabel = !subject ? 'اختر المادة أولًا' : safePick.kind === 'lesson' ? safePick.name : safePick.kind === 'unit' ? `${safePick.name} (مراجعة)` : 'كل دروس المادة'
  const target: LaunchTarget | null = !subject
    ? null
    : safePick.kind === 'lesson'
      ? { challengeType: 'LESSON_MASTERY', subjectCode: subject.code, lessonId: safePick.lessonId }
      : safePick.kind === 'unit'
        ? { challengeType: 'UNIT_REVIEW', subjectCode: subject.code, unitCode: safePick.unitCode }
        : { challengeType: 'QUICK10', subjectCode: subject.code }

  const chooseSubject = (code: string) => {
    setSheet(null)
    if (code === subjectCode) return
    setPick({ kind: 'subject' })
    startSwitch(() => router.replace(`/student/play?subject=${encodeURIComponent(code)}`, { scroll: false }))
  }
  const savePref = (patch: Partial<typeof prefs>) => {
    setPrefs((p) => ({ ...p, ...patch }))
    void setPlayPrefsAction(patch)
  }

  return (
    <section className="play-deck relative -mx-4 overflow-hidden bg-[linear-gradient(180deg,#FFFFFF_0%,#F5F8FF_38%,#E9F0FC_100%)] px-5 pb-6 pt-6 sm:mx-auto sm:max-w-xl sm:rounded-[32px] sm:border sm:border-[#D3E0F5]" aria-labelledby="play-home-title">
      <svg className="pointer-events-none absolute inset-x-0 top-0 h-40 w-full" viewBox="0 0 400 160" preserveAspectRatio="none" aria-hidden>
        <path d="M0 0 H400 V96 C320 130 250 70 170 92 C100 112 50 130 0 112 Z" fill="#FFFFFF" />
        <path d="M0 112 C50 130 100 112 170 92 C250 70 320 130 400 96" fill="none" stroke="#DCE6F7" strokeWidth={2} />
      </svg>
      <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-44 w-full" viewBox="0 0 400 176" preserveAspectRatio="none" aria-hidden>
        <path d="M0 60 C90 20 170 78 260 50 C320 32 360 40 400 54 V176 H0 Z" fill="#DCE8FB" fillOpacity={0.7} />
      </svg>

      <div className="relative mx-auto max-w-[24rem]">
        <div className="flex items-center justify-center gap-3">
          <GamepadArt className="h-10 w-14" />
          <h1 id="play-home-title" className="text-[2rem] font-extrabold leading-tight text-[#1B4DB1]">
            لعبة الأسئلة
          </h1>
        </div>
        <p className="mt-1 text-center text-base font-bold text-[#172B50]">تدرّب واختبر معارفك</p>

        <div className="mt-6 space-y-3">
          <HomeRow icon={<CapArt className="h-8 w-9" />} label={gradeLabel} href="/student/play/setup" />
          <HomeRow icon={<BooksArt className="h-8 w-9" />} label={subject?.nameAr ?? 'اختر المادة'} onClick={() => setSheet('subject')} busy={switching} />
          <HomeRow icon={<LessonDocArt className="h-8 w-8" />} label={lessonLabel} onClick={() => setSheet('lesson')} disabled={!subject || switching} />
        </div>

        <div className="mt-7">
          {target ? (
            <StartButton target={target} timed={timed} className={cn(DECK_BUTTON, 'w-[72%]')} disabled={!subject || subject.questions === 0 || switching}>
              <Play className="size-6" fill="currentColor" strokeWidth={0} aria-hidden /> ابدأ اللعب
            </StartButton>
          ) : (
            <button type="button" className={cn(DECK_BUTTON, 'w-[72%]')} onClick={() => setSheet('subject')}>
              <ChevronRight className="size-6" strokeWidth={3} aria-hidden /> اختر المادة
            </button>
          )}
          {data.activeSession ? (
            <Link href={`/student/play/session/${data.activeSession.id}`} className="mx-auto mt-3 flex min-h-11 w-fit items-center gap-1.5 rounded-full px-4 text-sm font-bold text-[#1457C5] hover:underline">
              <PlayCircle className="size-4" aria-hidden /> أكمل من حيث توقفت: {CHALLENGE_NAMES[data.activeSession.challengeType as PlayChallengeType]} ({data.activeSession.answeredCount}/{data.activeSession.total})
            </Link>
          ) : null}
        </div>

        <nav className="mt-8 grid grid-cols-3 gap-3" aria-label="أدوات اللعبة">
          <HomeTile icon={<GearArt className="size-10" />} label="الإعدادات" onClick={() => setSheet('settings')} />
          <HomeTile icon={<StatsArt className="h-10 w-11" />} label="إحصائيات" href="#play-stats" />
          <HomeTile icon={<TrophyGlyph className="size-11" />} label="الترتيب" href="#play-standing" />
        </nav>
      </div>

      {/* اختيار المادة */}
      <Dialog open={sheet === 'subject'} onOpenChange={(o) => setSheet(o ? 'subject' : null)}>
        <DialogContent className="play-deck max-h-[85svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>اختر المادة</DialogTitle>
            <DialogDescription>{data.grade?.nameAr ?? ''}</DialogDescription>
          </DialogHeader>
          <ul className="space-y-2">
            {data.subjects.map((s) => (
              <li key={s.code}>
                <SheetOption selected={s.code === subjectCode} disabled={s.questions === 0} onClick={() => chooseSubject(s.code)} title={s.nameAr} meta={`${s.questions} سؤال · ${s.lessons} درس`} />
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      {/* اختيار الدرس أو الوحدة */}
      <Dialog open={sheet === 'lesson'} onOpenChange={(o) => setSheet(o ? 'lesson' : null)}>
        <DialogContent className="play-deck max-h-[85svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>اختر الدرس</DialogTitle>
            <DialogDescription>{subject?.nameAr ?? ''}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <SheetOption
              selected={safePick.kind === 'subject'}
              onClick={() => {
                setPick({ kind: 'subject' })
                setSheet(null)
              }}
              title="كل دروس المادة"
              meta="تحدي 10 أسئلة"
            />
            {units.map((u) => {
              const unitQuestions = u.lessons.reduce((a, l) => a + l.questions, 0)
              return (
                <div key={u.unitCode} className="space-y-2">
                  <p className="text-sm font-extrabold text-[#1B4DB1]">{u.unitName}</p>
                  <SheetOption
                    selected={safePick.kind === 'unit' && safePick.unitCode === u.unitCode}
                    disabled={unitQuestions === 0}
                    onClick={() => {
                      setPick({ kind: 'unit', unitCode: u.unitCode, name: u.unitName })
                      setSheet(null)
                    }}
                    title="مراجعة الوحدة كاملة"
                    meta={`${unitQuestions} سؤال`}
                  />
                  {u.lessons.map((l) => (
                    <SheetOption
                      key={l.id}
                      selected={safePick.kind === 'lesson' && safePick.lessonId === l.id}
                      disabled={l.questions === 0}
                      onClick={() => {
                        setPick({ kind: 'lesson', lessonId: l.id, unitCode: u.unitCode, name: l.lessonName })
                        setSheet(null)
                      }}
                      title={l.lessonName}
                      meta={`${l.questions} سؤال${l.answered ? ` · إتقان ${l.masteryPct}%` : ''}${l.mastered ? ' · متقن' : ''}`}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* الإعدادات */}
      <Dialog open={sheet === 'settings'} onOpenChange={(o) => setSheet(o ? 'settings' : null)}>
        <DialogContent className="play-deck">
          <DialogHeader>
            <DialogTitle>الإعدادات</DialogTitle>
            <DialogDescription>تُحفظ لحسابك وتعمل في كل جولة.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <SettingSwitch label="أصوات التصحيح" value={prefs.sound} onChange={(v) => savePref({ sound: v })} />
            <SettingSwitch label="حركة دوران البطاقة" value={prefs.motion} onChange={(v) => savePref({ motion: v })} />
            <SettingSwitch label="اللعب بالمؤقت" hint="45 ثانية لكل سؤال" value={timed} onChange={setTimed} />
            <Link href="/student/play/setup" className="flex min-h-11 items-center justify-between rounded-[14px] border border-[#D3E0F5] px-4 py-2 text-sm font-bold hover:bg-[#F3F7FF]">
              تغيير السنة أو الشعبة <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function HomeRow({ icon, label, href, onClick, disabled, busy }: { icon: React.ReactNode; label: string; href?: string; onClick?: () => void; disabled?: boolean; busy?: boolean }) {
  const cls = cn(
    'flex min-h-[3.25rem] w-full items-center gap-3 rounded-[16px] border-[1.5px] border-[#CCD9EF] bg-white px-4 py-2 text-start shadow-[0_6px_14px_-12px_rgba(20,87,197,0.6)] transition-colors hover:border-[#8FAAFF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1457C5]/25 disabled:opacity-60',
    busy && 'animate-pulse'
  )
  // كما في 01: السهم في أول السطر، ثم الاسم، والأيقونة في آخره
  const inner = (
    <>
      <ChevronRight className="size-5 shrink-0 text-[#172B50]" strokeWidth={2.6} aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[1.1rem] font-extrabold text-[#172B50]">{label}</span>
      <span className="flex w-9 shrink-0 justify-center" aria-hidden>
        {icon}
      </span>
    </>
  )
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" className={cls} onClick={onClick} disabled={disabled} aria-haspopup="dialog">
      {inner}
    </button>
  )
}

function HomeTile({ icon, label, href, onClick }: { icon: React.ReactNode; label: string; href?: string; onClick?: () => void }) {
  const cls = 'flex min-h-[5.75rem] flex-col items-center justify-center gap-2 rounded-[20px] border border-[#D3E0F5] bg-white px-2 py-3 text-[0.95rem] font-extrabold text-[#172B50] shadow-[0_10px_20px_-14px_rgba(20,87,197,0.55)] transition-colors hover:border-[#8FAAFF] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1457C5]/25'
  const inner = (
    <>
      <span aria-hidden>{icon}</span>
      {label}
    </>
  )
  return href ? (
    <a href={href} className={cls}>
      {inner}
    </a>
  ) : (
    <button type="button" className={cls} onClick={onClick} aria-haspopup="dialog">
      {inner}
    </button>
  )
}

function SheetOption({ title, meta, selected, disabled, onClick }: { title: string; meta?: string; selected: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn('flex min-h-12 w-full items-center gap-3 rounded-[14px] border-[1.5px] px-4 py-2 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1457C5]/40 disabled:opacity-45', selected ? 'border-[#6E9DEB] bg-[#D5E4FC]' : 'border-[#D3E0F5] bg-white hover:border-[#8FAAFF]')}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-extrabold text-[#172B50]">{title}</span>
        {meta ? <span className="block text-xs text-[#5B6B88]">{meta}</span> : null}
      </span>
      {selected ? <Check className="size-5 shrink-0 text-[#1457C5]" aria-hidden /> : null}
    </button>
  )
}

function SettingSwitch({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={value} onClick={() => onChange(!value)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-[14px] border border-[#D3E0F5] px-4 py-2 text-start text-sm font-bold hover:bg-[#F3F7FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1457C5]/40">
      <span>
        {label}
        {hint ? <span className="block text-xs font-medium text-[#5B6B88]">{hint}</span> : null}
      </span>
      <span className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', value ? 'bg-[#1457C5]' : 'bg-[#C9D5EA]')} aria-hidden>
        <span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-[inset-inline-start]', value ? 'start-[1.375rem]' : 'start-0.5')} />
      </span>
    </button>
  )
}
