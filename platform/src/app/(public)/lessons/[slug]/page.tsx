import { notFound } from 'next/navigation'
import { LessonView } from '@/components/domain/lesson-view'
import { getCurrentActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { getPublicContentBySlug } from '@/server/queries/content.queries'

export const dynamic = 'force-dynamic'

/** الدرس العام: الصفحة الواحدة (LessonView) كما يراها الزائر */
export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let decoded = slug
  try {
    decoded = decodeURIComponent(slug)
  } catch {
    notFound()
  }
  const item = await getPublicContentBySlug(await getDb(), decoded)
  if (!item) notFound()
  const actor = await getCurrentActor()
  return <LessonView item={item} actor={actor} surface="public" back={{ href: '/lessons', label: 'الدروس' }} className="container py-10" />
}
