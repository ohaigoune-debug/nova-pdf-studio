import Link from 'next/link'
import { getLocale } from '@/i18n/server'
import { getCurrentActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { iosLearningHome } from '@/server/services/ios-learning.service'
import { phoneGateFor } from '@/server/services/phone-gate.service'
import { iosLabels } from './labels'

export default async function IosLearningPage({ searchParams }: { searchParams: Promise<{ unavailable?: string }> }) {
  const [actor, locale, db] = await Promise.all([getCurrentActor(), getLocale(), getDb()])
  const text = iosLabels(locale)
  // Layout renders the verification form; do not fetch protected content meanwhile.
  if (actor && (actor.role !== 'STUDENT' || (await phoneGateFor(db, actor.userId)).required)) return null
  const home = await iosLearningHome(db, actor)
  const unavailable = ['commerce', 'community', 'role', 'route'].includes((await searchParams).unavailable ?? '')
  return (
    <div className="space-y-7">
      {unavailable ? <p role="status" className="rounded-xl border bg-muted p-4 text-sm leading-relaxed">{text.unavailableAction}</p> : null}
      <section className="space-y-3">
        <h1 className="font-display text-3xl font-bold leading-snug">{text.home}</h1>
        <p className="text-base leading-relaxed text-muted-foreground">{text.intro}</p>
        {!actor ? <div className="flex flex-wrap gap-3"><Link href="/login?next=/ios" className="inline-flex min-h-12 items-center rounded-md bg-primary px-5 font-semibold text-primary-foreground">{text.login}</Link><Link href="/register" className="inline-flex min-h-12 items-center rounded-md border px-5 font-semibold">{text.register}</Link></div> : null}
      </section>
      {actor ? <section className="space-y-3">
        <h2 className="text-2xl font-bold">{text.courses}</h2>
        {home.courses.length ? <ul className="grid gap-4 sm:grid-cols-2">{home.courses.map((course) => <li key={course.id} className="space-y-3 rounded-xl border bg-card p-5">
          <h3 className="text-xl font-bold">{course.title}</h3><p className="text-sm text-muted-foreground">{course.teacherName} · {course.season}</p>
          {course.status === 'ACTIVE' ? <Link href={course.href} className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4">{text.open}</Link> : <p className="text-sm text-muted-foreground">{text.ended}</p>}
        </li>)}</ul> : <p className="rounded-xl border bg-card p-5 text-muted-foreground">{text.noCourses}</p>}
      </section> : null}
      {actor ? <section className="space-y-3">
        <h2 className="text-2xl font-bold">{text.practice}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{text.webTools}</p>
        <ul className="grid grid-cols-2 gap-3">
          {[
            { href: '/student/play', label: text.play },
            { href: '/student/practice', label: text.exercises },
            { href: '/student/quizzes', label: text.quizzes },
            { href: '/student/exams', label: text.exams }
          ].map((tool) => <li key={tool.href}><Link href={tool.href} className="flex min-h-14 items-center rounded-xl border bg-card p-4 font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{tool.label}</Link></li>)}
        </ul>
      </section> : null}
      <section className="space-y-3">
        <h2 className="text-2xl font-bold">{text.publicLessons}</h2>
        {home.publicLessons.length ? <ul className="divide-y rounded-xl border bg-card">{home.publicLessons.map((lesson) => <li key={lesson.id}><Link href={lesson.href} className="block space-y-1 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><h3 className="font-bold">{lesson.title}</h3>{lesson.summary ? <p className="line-clamp-2 text-sm text-muted-foreground">{lesson.summary}</p> : null}</Link></li>)}</ul> : <p className="text-muted-foreground">{text.noLessons}</p>}
      </section>
    </div>
  )
}
