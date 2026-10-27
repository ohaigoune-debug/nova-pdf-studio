import Link from 'next/link'
import type { ComponentType } from 'react'
import { BookOpen, ChevronLeft, FileText, Gamepad2, Gift, ListChecks, LogIn, PencilLine, PlayCircle, ScrollText } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { getLocale } from '@/i18n/server'
import { getCurrentActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { iosLearningHome } from '@/server/services/ios-learning.service'
import { phoneGateFor } from '@/server/services/phone-gate.service'
import { groupLessons } from './group-lessons'
import { iosLabels } from './labels'

const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function lessonIcon(type: string | null | undefined): ComponentType<{ className?: string }> {
  if (type === 'VIDEO') return PlayCircle
  if (type === 'PDF') return FileText
  return BookOpen
}

function SingleLesson({ lesson, label }: { lesson: { href: string; summary: string | null; type: string }; label: string }) {
  const Icon = lessonIcon(lesson.type)
  return (
    <li>
      <Link href={lesson.href} className={`flex items-center gap-3 rounded-2xl border bg-card p-4 ${focus}`}>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary" aria-hidden><Icon className="size-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 font-semibold leading-snug">{label}</span>
          {lesson.summary ? <span className="mt-1 line-clamp-1 text-sm text-muted-foreground">{lesson.summary}</span> : null}
        </span>
        <ChevronLeft className="size-5 shrink-0 text-muted-foreground ltr:rotate-180" aria-hidden />
      </Link>
    </li>
  )
}

export default async function IosLearningPage({ searchParams }: { searchParams: Promise<{ unavailable?: string }> }) {
  const [actor, locale, db] = await Promise.all([getCurrentActor(), getLocale(), getDb()])
  const text = iosLabels(locale)
  // Layout renders the verification form; do not fetch protected content meanwhile.
  if (actor && (actor.role !== 'STUDENT' || (await phoneGateFor(db, actor.userId)).required)) return null
  const home = await iosLearningHome(db, actor)
  const unavailable = ['commerce', 'community', 'role', 'route'].includes((await searchParams).unavailable ?? '')
  const lessons = groupLessons(home.publicLessons)
  const tools = [
    { href: '/student/play', label: text.play, Icon: Gamepad2, tone: 'bg-purple/15 text-purple' },
    { href: '/student/practice', label: text.exercises, Icon: PencilLine, tone: 'bg-primary/15 text-primary' },
    { href: '/student/quizzes', label: text.quizzes, Icon: ListChecks, tone: 'bg-cyan/15 text-cyan' },
    { href: '/student/exams', label: text.exams, Icon: ScrollText, tone: 'bg-brand-lime/25 text-foreground' }
  ]
  return (
    <div className="space-y-8">
      {unavailable ? <p role="status" className="rounded-2xl border bg-muted p-4 text-sm leading-relaxed">{text.unavailableAction}</p> : null}

      {actor ? (
        <section className="space-y-1 pt-2">
          <h1 className="font-display text-2xl font-bold leading-snug">{text.home}</h1>
          <p className="text-sm text-muted-foreground">{text.learnIntro}</p>
        </section>
      ) : (
        <section className="space-y-5 rounded-3xl border bg-card p-6 text-center">
          <Logo width={150} className="mx-auto" priority />
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold leading-snug">{text.welcome}</h1>
            <p className="text-muted-foreground">{text.welcomeIntro}</p>
          </div>
          <Link href="/login?next=/ios" className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground ${focus}`}>
            <LogIn className="size-5" aria-hidden />{text.login}
          </Link>
          <p className="text-sm text-muted-foreground">
            {text.noAccount}{' '}
            <Link href="/register" className={`inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4 ${focus}`}>{text.register}</Link>
          </p>
        </section>
      )}

      {actor ? (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">{text.courses}</h2>
          {home.courses.length ? (
            <ul className="space-y-3">
              {home.courses.map((course) => {
                const active = course.status === 'ACTIVE'
                const body = (
                  <>
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary" aria-hidden><BookOpen className="size-6" /></span>
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="block font-bold leading-snug">{course.title}</span>
                      <span className="block text-sm text-muted-foreground">{active ? `${course.teacherName} · ${course.season}` : text.ended}</span>
                    </span>
                    {active ? <ChevronLeft className="size-5 shrink-0 text-muted-foreground ltr:rotate-180" aria-hidden /> : null}
                  </>
                )
                return (
                  <li key={course.id}>
                    {active
                      ? <Link href={course.href} className={`flex items-center gap-3 rounded-2xl border bg-card p-4 ${focus}`}>{body}</Link>
                      : <div className="flex items-center gap-3 rounded-2xl border bg-card p-4 opacity-70">{body}</div>}
                  </li>
                )
              })}
            </ul>
          ) : <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">{text.noCourses}</p>}
        </section>
      ) : null}

      {actor ? (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">{text.practice}</h2>
          <ul className="grid grid-cols-2 gap-3">
            {tools.map(({ href, label, Icon, tone }) => (
              <li key={href}>
                <Link href={href} className={`flex min-h-24 flex-col justify-between gap-3 rounded-2xl border bg-card p-4 font-semibold ${focus}`}>
                  <span className={`flex size-10 items-center justify-center rounded-xl ${tone}`} aria-hidden><Icon className="size-5" /></span>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Gift className="size-5 text-primary" aria-hidden />{text.freeForAll}
        </h2>
        {lessons.length ? (
          <ul className="space-y-3">
            {lessons.map((entry) => entry.kind === 'group' ? (
              <li key={entry.key} className="overflow-hidden rounded-2xl border bg-card">
                <div className="space-y-1 border-b p-4">
                  <h3 className="font-bold leading-snug">{entry.heading}</h3>
                  {entry.detail ? <p className="text-sm text-muted-foreground">{entry.detail}</p> : null}
                </div>
                <ul className="grid grid-cols-2 gap-2 p-3">
                  {entry.items.map(({ lesson, label }) => (
                    <li key={lesson.id}>
                      <Link href={lesson.href} className={`flex min-h-12 items-center justify-between gap-2 rounded-xl bg-muted px-3 py-2 text-sm font-semibold leading-snug ${focus}`}>
                        <span className="line-clamp-2">{label}</span>
                        <ChevronLeft className="size-4 shrink-0 text-muted-foreground ltr:rotate-180" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ) : <SingleLesson key={entry.lesson.id} lesson={entry.lesson} label={entry.label} />)}
          </ul>
        ) : <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">{text.noLessons}</p>}
      </section>
    </div>
  )
}
