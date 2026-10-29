import Link from 'next/link'
import { BookOpen, CalendarClock, ChevronLeft, ChevronRight, ClipboardCheck, ClipboardList, FileText, FolderOpen, PlayCircle, type LucideIcon } from 'lucide-react'
import { notFound } from 'next/navigation'
import { TermsGate } from '@/components/courses/terms-gate'
import { getLocale } from '@/i18n/server'
import { formatDateTime } from '@/lib/utils'
import { getCurrentActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { iosCourseHome } from '@/server/services/ios-learning.service'
import { phoneGateFor } from '@/server/services/phone-gate.service'
import { iosLabels } from '../../labels'

export default async function IosCoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const [actor, db, locale, { slug }] = await Promise.all([getCurrentActor(), getDb(), getLocale(), params])
  const text = iosLabels(locale)
  if (actor?.role === 'STUDENT' && (await phoneGateFor(db, actor.userId)).required) return null
  let home
  try { home = await iosCourseHome(db, actor, decodeURIComponent(slug)) }
  catch (error) { if (isAppError(error)) notFound(); throw error }
  if (home.needsTerms) return <TermsGate courseId={home.course.id} slug={home.course.slug} title={home.course.title} termsText={home.course.termsText} />
  const icons: Record<string, LucideIcon> = { lessons: BookOpen, videos: PlayCircle, homework: ClipboardList, tests: ClipboardCheck, files: FolderOpen }
  return <article className="space-y-7">
    <Link href="/ios" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary"><ChevronRight className="size-4 ltr:rotate-180" aria-hidden />{text.back}</Link>
    <header className="space-y-2">
      <h1 className="font-display text-2xl font-bold leading-snug">{home.course.title}</h1>
      <p className="text-sm text-muted-foreground">{home.course.teacherName} · {home.course.season}</p>
      {home.course.description ? <p className="leading-relaxed">{home.course.description}</p> : null}
    </header>
    {home.sections.length ? <nav aria-label={home.course.title} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {home.sections.map((section) => <a key={section.id} href={`#${section.id}`} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border bg-card px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {text.sections[section.id]}<span className="rounded-full bg-primary/15 px-2 text-xs text-primary">{section.items.length}</span>
      </a>)}
    </nav> : <p className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">{text.courseEmpty}</p>}
    {home.sections.map((section) => {
      const Icon = icons[section.id] ?? FileText
      return <section className="scroll-mt-4 space-y-3" key={section.id} id={section.id}>
        <h2 className="text-lg font-bold">{text.sections[section.id]}</h2>
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">{section.items.map((item) => <li key={item.id}>
          <Link href={item.href} className="flex min-h-14 items-center gap-3 p-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {item.session !== null
              ? <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-full bg-primary text-primary-foreground" aria-label={`${text.session} ${item.session}`}><span className="text-[9px] leading-none opacity-80" aria-hidden>{text.session}</span><span className="text-sm font-bold leading-none tabular-nums" aria-hidden>{item.session}</span></span>
              : <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary" aria-hidden><Icon className="size-5" /></span>}
            <span className="min-w-0 flex-1 leading-snug">{item.displayTitle}</span>
            <ChevronLeft className="size-5 shrink-0 text-muted-foreground ltr:rotate-180" aria-hidden />
          </Link>
        </li>)}</ul>
      </section>
    })}
    {home.upcoming.length ? <section className="space-y-3"><h2 className="text-lg font-bold">{text.upcoming}</h2><ul className="space-y-3">{home.upcoming.map((session) => <li key={session.id} className="flex items-center gap-3 rounded-2xl border bg-card p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-cyan/15 text-cyan" aria-hidden><CalendarClock className="size-5" /></span>
      <span><span className="block font-semibold">{session.title}</span><span className="block text-sm text-muted-foreground">{formatDateTime(session.startsAt)}</span></span>
    </li>)}</ul></section> : null}
  </article>
}
