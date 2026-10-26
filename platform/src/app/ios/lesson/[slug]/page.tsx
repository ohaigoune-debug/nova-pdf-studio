import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LessonMedia } from '@/components/domain/lesson-media'
import { Markdown } from '@/components/domain/markdown'
import { getLocale } from '@/i18n/server'
import { getCurrentActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { iosLesson } from '@/server/services/ios-learning.service'
import { phoneGateFor } from '@/server/services/phone-gate.service'
import { iosLabels } from '../../labels'

export default async function IosLessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const [actor, db, locale, { slug }] = await Promise.all([getCurrentActor(), getDb(), getLocale(), params])
  const text = iosLabels(locale)
  if (actor?.role === 'STUDENT' && (await phoneGateFor(db, actor.userId)).required) return null
  let item
  try { item = await iosLesson(db, actor, decodeURIComponent(slug)) }
  catch (error) { if (isAppError(error)) notFound(); throw error }
  return <article className="space-y-5">
    <Link href="/ios" className="inline-flex min-h-11 items-center text-sm text-primary underline">{text.back}</Link>
    <h1 className="font-display text-3xl font-bold leading-snug">{item.title}</h1>
    {item.summary ? <p className="rounded-xl border bg-card p-4 leading-relaxed text-muted-foreground">{item.summary}</p> : null}
    <LessonMedia item={item} actor={actor} />
    {item.body ? <Markdown body={item.body} /> : null}
    <p className="text-sm text-muted-foreground">{text.rights}</p>
  </article>
}
