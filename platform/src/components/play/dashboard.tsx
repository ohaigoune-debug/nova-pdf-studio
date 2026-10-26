'use client'

import { Award, BookOpenCheck, CalendarDays, ChevronLeft, Flame, PlayCircle, RotateCcw, Settings2, Sparkles, Target, Zap } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn, formatShortDate } from '@/lib/utils'
import { CHALLENGE_NAMES, type PlayChallengeType, streamName, subjectName } from '@/server/play/constants'
import type { getPlayDashboard } from '@/server/services/play.service'
import { StartButton, TimedToggle, useTimedPref } from './challenge-launcher'
import { LucideIcon, ProgressRing, SubjectBubble, tone } from './visuals'

type Dashboard = Awaited<ReturnType<typeof getPlayDashboard>>

export function PlayDashboard({ data, studentName }: { data: Dashboard; studentName: string }) {
  const [timed, setTimed] = useTimedPref()
  const accuracy = data.stats.answeredTotal ? Math.round((data.stats.correctTotal / data.stats.answeredTotal) * 100) : 0
  const earned = data.badges.filter((b) => b.earnedAt)
  return (
    <div className="space-y-6">
      {/* البطاقة الرئيسية */}
      <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/15 via-card to-accent/10 p-5 shadow-sm sm:p-6">
        <div className="pointer-events-none absolute -end-10 -top-10 size-40 rounded-full bg-primary/10 blur-2xl" aria-hidden />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <ProgressRing value={data.level.progressPct} size={112} stroke={11} tone="accent">
            <div className="text-center">
              <p className="text-2xl font-extrabold tabular-nums">{data.stats.xpTotal}</p>
              <p className="text-[10px] font-bold text-muted-foreground">XP</p>
            </div>
          </ProgressRing>
          <div className="flex-1 space-y-1">
            <p className="text-sm text-muted-foreground">مرحباً {studentName.split(' ')[0]} 👋</p>
            <h1 className="text-2xl font-extrabold">
              المستوى: <span className="text-primary">{data.level.title}</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              {data.level.nextMinXp ? `${data.level.nextMinXp - data.stats.xpTotal} XP للمستوى التالي` : 'وصلتَ أعلى مستوى!'} · {data.grade?.shortAr}
              {data.profile.streamCode ? ` · ${streamName(data.profile.streamCode)}` : ''}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Chip icon={<Flame className="size-3.5 text-orange-500" />} label={`${data.stats.streakDays} يوم متتالٍ`} />
              <Chip icon={<Target className="size-3.5 text-primary" />} label={`${accuracy}% دقة`} />
              <Chip icon={<BookOpenCheck className="size-3.5 text-success" />} label={`${data.stats.lessonsMastered} درس متقن`} />
              <Chip icon={<Award className="size-3.5 text-amber-600" />} label={`${earned.length} شارة`} />
            </div>
          </div>
          <Link href="/student/play/setup" className="inline-flex items-center gap-1 self-start rounded-full border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted">
            <Settings2 className="size-3.5" /> تغيير السنة/الشعبة
          </Link>
        </div>
      </section>

      {/* الإجراءات السريعة */}
      <section className="grid gap-3 sm:grid-cols-3">
        {data.activeSession ? (
          <Link href={`/student/play/session/${data.activeSession.id}`} className="group rounded-2xl border-2 border-primary/40 bg-primary/5 p-4 transition-all hover:border-primary hover:shadow-md">
            <PlayCircle className="mb-2 size-7 text-primary" />
            <p className="font-extrabold">أكمل من حيث توقفت</p>
            <p className="text-xs text-muted-foreground">
              {CHALLENGE_NAMES[data.activeSession.challengeType as PlayChallengeType]} · {data.activeSession.answeredCount}/{data.activeSession.total}
              {data.activeSession.subjectCode ? ` · ${subjectName(data.activeSession.subjectCode)}` : ''}
            </p>
          </Link>
        ) : (
          <div className="rounded-2xl border-2 border-dashed p-4 text-muted-foreground">
            <PlayCircle className="mb-2 size-7" />
            <p className="font-bold text-foreground">لا تحدٍّ جارٍ</p>
            <p className="text-xs">اختر مادة بالأسفل لتبدأ.</p>
          </div>
        )}
        <div className={cn('rounded-2xl border-2 p-4', data.dailyDone ? 'border-success/40 bg-success/5' : 'border-accent/50 bg-accent/10')}>
          <CalendarDays className={cn('mb-2 size-7', data.dailyDone ? 'text-success' : 'text-amber-600')} />
          <p className="font-extrabold">التحدي اليومي</p>
          <p className="mb-2 text-xs text-muted-foreground">{data.dailyDone ? 'أنجزتَ تحدي اليوم. عُد غداً!' : '8 أسئلة من مواد مختلفة'}</p>
          {!data.dailyDone ? (
            <StartButton target={{ challengeType: 'DAILY' }} timed={timed} size="sm" disabled={!data.subjects.some((s) => s.questions > 0)}>
              <Zap className="size-4" /> ابدأ
            </StartButton>
          ) : null}
        </div>
        <div className={cn('rounded-2xl border-2 p-4', data.mistakesDue > 0 ? 'border-destructive/30 bg-destructive/5' : 'border-border')}>
          <RotateCcw className={cn('mb-2 size-7', data.mistakesDue > 0 ? 'text-destructive' : 'text-muted-foreground')} />
          <p className="font-extrabold">راجع أخطاءك</p>
          <p className="mb-2 text-xs text-muted-foreground">{data.mistakesDue > 0 ? `${data.mistakesDue} سؤالاً مستحقاً للمراجعة` : 'لا أخطاء مستحقة الآن'}</p>
          <div className="flex gap-2">
            {data.mistakesDue > 0 ? (
              <StartButton target={{ challengeType: 'MISTAKES' }} size="sm" variant="destructive">
                عالج الآن
              </StartButton>
            ) : null}
            <Button asChild size="sm" variant="outline">
              <Link href="/student/play/mistakes">التفاصيل</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* المواد */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold">موادك</h2>
          <TimedToggle value={timed} onChange={setTimed} />
        </div>
        {data.subjects.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">لا توجد مواد بعد لهذه السنة. اختر سنة أخرى أو عُد لاحقاً.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.subjects.map((s) => {
              const acc = s.answered ? Math.round((s.correct / s.answered) * 100) : 0
              const t = tone(s.color)
              return (
                <Link key={s.code} href={`/student/play/subject/${s.code}`} className={cn('group flex items-center gap-3 rounded-2xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md', s.questions === 0 && 'opacity-60')}>
                  <SubjectBubble color={s.color} icon={s.icon} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-extrabold">{s.nameAr}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.questions} سؤال · {s.lessons} درس
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className={cn('h-full rounded-full', t.bg)} style={{ width: `${acc}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {s.answered ? `${acc}% دقة · ${s.xp} XP` : 'لم تبدأ بعد'}
                    </p>
                  </div>
                  <ChevronLeft className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5 rtl:rotate-0" />
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* التحديات الخاصة */}
      {data.grade?.code === '3AS' || data.subjects.some((s) => s.questions > 0) ? (
        <section className="grid gap-3 sm:grid-cols-2">
          {data.grade?.code === '3AS' ? (
            <div className="rounded-2xl border bg-card p-4">
              <p className="font-extrabold">تحدي البكالوريا</p>
              <p className="mb-2 text-xs text-muted-foreground">20 سؤالاً من كل مواد شعبتك</p>
              <StartButton target={{ challengeType: 'BAC' }} timed={timed} size="sm" variant="secondary">
                ابدأ تحدي البكالوريا
              </StartButton>
            </div>
          ) : null}
          <div className="rounded-2xl border bg-card p-4">
            <p className="font-extrabold">تحدي الأسئلة الصعبة</p>
            <p className="mb-2 text-xs text-muted-foreground">10 أسئلة صعبة · +15 XP لكل إجابة</p>
            <StartButton target={{ challengeType: 'HARD' }} timed={timed} size="sm" variant="secondary">
              ابدأ
            </StartButton>
          </div>
        </section>
      ) : null}

      {/* الشارات والدروس المتقنة */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-4">
          <h2 className="mb-3 font-extrabold">شارات الإنجاز</h2>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {data.badges.map((b) => (
              <div key={b.code} title={`${b.nameAr}: ${b.descriptionAr}`} className={cn('flex flex-col items-center gap-1 rounded-xl p-2 text-center', b.earnedAt ? 'bg-accent/15' : 'opacity-35 grayscale')}>
                <LucideIcon name={b.icon} className={cn('size-6', b.earnedAt ? 'text-amber-600' : 'text-muted-foreground')} />
                <span className="text-[10px] font-bold leading-tight">{b.nameAr}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <h2 className="mb-3 font-extrabold">دروس أتقنتها</h2>
          {data.masteredLessons.length === 0 ? (
            <p className="text-sm text-muted-foreground">أتقن درساً: أجب عن 8 أسئلة منه بدقة 80% فأكثر.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {data.masteredLessons.map((l, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Sparkles className="size-4 shrink-0 text-success" />
                  <span className="flex-1 truncate">{l.lessonName}</span>
                  <span className="text-xs text-muted-foreground">{subjectName(l.subjectCode)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* آخر الجلسات */}
      {data.recentSessions.length ? (
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-3 font-extrabold">آخر التحديات</h2>
          <ul className="divide-y text-sm">
            {data.recentSessions.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2">
                <span className="flex-1 truncate">
                  {CHALLENGE_NAMES[s.challengeType as PlayChallengeType]}
                  {s.subjectCode ? ` · ${subjectName(s.subjectCode)}` : ''}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {s.correctCount}/{s.total}
                </span>
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-bold text-accent-foreground dark:text-accent">+{s.xpEarned}</span>
                <span className="w-16 text-end text-xs text-muted-foreground">{formatShortDate(s.completedAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function Chip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs font-bold">
      {icon} {label}
    </span>
  )
}
