import { notFound } from 'next/navigation'
import { LessonView } from '@/components/domain/lesson-view'
import { getLocale } from '@/i18n/server'
import { getCurrentActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { iosLesson } from '@/server/services/ios-learning.service'
import { phoneGateFor } from '@/server/services/phone-gate.service'
import { iosLabels } from '../../labels'

/** درس تطبيق آيفون: الصفحة الواحدة (LessonView) بلا شارات ولا روابط خارجية ولا أي إشارة إلى شراء */
export default async function IosLessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const [actor, db, locale, { slug }] = await Promise.all([getCurrentActor(), getDb(), getLocale(), params])
  const text = iosLabels(locale)
  if (actor?.role === 'STUDENT' && (await phoneGateFor(db, actor.userId)).required) return null
  let decoded = slug
  try {
    decoded = decodeURIComponent(slug)
  } catch {
    notFound()
  }
  let item
  try {
    item = await iosLesson(db, actor, decoded)
  } catch (error) {
    if (isAppError(error)) notFound()
    throw error
  }
  return <LessonView item={item} actor={actor} surface="ios" back={{ href: '/ios', label: text.back }} />
}
