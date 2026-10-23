'use client'

import { BookOpen, CheckCircle2, ChevronLeft, Layers, Zap } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { listLessonsFor } from '@/server/services/play.service'
import { StartButton, TimedToggle, useTimedPref } from './challenge-launcher'
import { SubjectBubble, tone } from './visuals'

type Units = Awaited<ReturnType<typeof listLessonsFor>>

export function SubjectView({ subject, units }: { subject: { code: string; nameAr: string; color: string; icon: string; questions: number }; units: Units }) {
  const [timed, setTimed] = useTimedPref()
  const t = tone(subject.color)
  const totalLessons = units.reduce((a, u) => a + u.lessons.length, 0)
  const mastered = units.reduce((a, u) => a + u.lessons.filter((l) => l.mastered).length, 0)
  return (
    <div className="space-y-5">
      <Link href="/student/play" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4 rotate-180" /> العودة إلى PLAY
      </Link>
      <section className={cn('flex flex-col gap-4 rounded-3xl border p-5 sm:flex-row sm:items-center', t.soft)}>
        <SubjectBubble color={subject.color} icon={subject.icon} size="lg" />
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold">{subject.nameAr}</h1>
          <p className="text-sm text-muted-foreground">
            {subject.questions} سؤال · {totalLessons} درس · {mastered} متقن
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <TimedToggle value={timed} onChange={setTimed} />
          <StartButton target={{ challengeType: 'QUICK10', subjectCode: subject.code }} timed={timed} size="lg" disabled={subject.questions === 0}>
            <Zap className="size-4" /> تحدي 10 أسئلة
          </StartButton>
        </div>
      </section>

      {units.length === 0 ? <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">لا دروس لهذه المادة بعد.</p> : null}

      {units.map((u) => {
        const unitQuestions = u.lessons.reduce((a, l) => a + l.questions, 0)
        return (
          <section key={u.unitCode} className="rounded-2xl border bg-card">
            <header className="flex items-center gap-3 border-b p-4">
              <Layers className={cn('size-5 shrink-0', t.text)} />
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-extrabold">{u.unitName}</h2>
                <p className="text-xs text-muted-foreground">
                  {u.lessons.length} درس · {unitQuestions} سؤال
                </p>
              </div>
              <StartButton target={{ challengeType: 'UNIT_REVIEW', subjectCode: subject.code, unitCode: u.unitCode }} timed={timed} size="sm" variant="secondary" disabled={unitQuestions === 0}>
                مراجعة الوحدة
              </StartButton>
            </header>
            <ul className="divide-y">
              {u.lessons.map((l) => (
                <li key={l.id} className="flex items-center gap-3 p-3 sm:p-4">
                  <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', l.mastered ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground')}>{l.mastered ? <CheckCircle2 className="size-5" /> : <BookOpen className="size-4" />}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{l.lessonName}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
                        <div className={cn('h-full rounded-full', l.mastered ? 'bg-success' : t.bg)} style={{ width: `${l.masteryPct}%` }} />
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {l.answered ? `${l.masteryPct}%` : '—'} · {l.questions} سؤال
                        {!l.verified ? ' · قيد المراجعة' : ''}
                      </span>
                    </div>
                  </div>
                  <StartButton target={{ challengeType: 'LESSON_MASTERY', subjectCode: subject.code, lessonId: l.id }} timed={timed} size="sm" variant={l.mastered ? 'outline' : 'default'} disabled={l.questions === 0}>
                    {l.mastered ? 'تدرّب' : 'أتقن'}
                  </StartButton>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
