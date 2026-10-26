import Link from 'next/link'
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
  return <article className="space-y-6">
    <Link href="/ios" className="inline-flex min-h-11 items-center text-sm text-primary underline">{text.back}</Link>
    <header className="space-y-2"><h1 className="font-display text-3xl font-bold leading-snug">{home.course.title}</h1><p className="text-muted-foreground">{home.course.teacherName} · {home.course.season}</p>{home.course.description ? <p className="leading-relaxed">{home.course.description}</p> : null}</header>
    {[{ title: text.videos, items: home.videos }, { title: text.lessons, items: home.lessons }].map((section) => <section className="space-y-3" key={section.title}><h2 className="text-xl font-bold">{section.title}</h2>{section.items.length ? <ul className="divide-y rounded-xl border bg-card">{section.items.map((item) => <li key={item.id}><Link href={item.href} className="flex min-h-12 items-center p-4 font-semibold text-primary">{item.title}</Link></li>)}</ul> : <p className="text-muted-foreground">{text.noContent}</p>}</section>)}
    {home.upcoming.length ? <section className="space-y-3"><h2 className="text-xl font-bold">{text.upcoming}</h2><ul className="space-y-3">{home.upcoming.map((session) => <li key={session.id} className="rounded-xl border bg-card p-4"><h3 className="font-semibold">{session.title}</h3><p className="text-sm text-muted-foreground">{formatDateTime(session.startsAt)}</p></li>)}</ul></section> : null}
    <p className="text-sm text-muted-foreground">{text.rights}</p>
  </article>
}
