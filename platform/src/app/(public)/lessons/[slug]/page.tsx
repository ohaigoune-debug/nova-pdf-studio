import { notFound } from 'next/navigation'
import { LessonView } from '@/components/domain/lesson-view'
import { OutOfScopeNotice } from '@/components/student/student-scope-ui'
import { getCurrentActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { getPublicContentBySlug } from '@/server/queries/content.queries'
import { contentInScope, studentScopeOf } from '@/server/services/student-scope.service'

export const dynamic = 'force-dynamic'

/**
 * الدرس العام: الصفحة الواحدة (LessonView) كما يراها الزائر. التلميذ المسجَّل لا يفتح هنا درسًا من مستوى أو
 * شعبة أخرى (نفس شرط «دروسي» في الخادم)؛ الزائر والمشرف والأستاذ كما كانوا.
 */
export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let decoded = slug
  try {
    decoded = decodeURIComponent(slug)
  } catch {
    notFound()
  }
  const db = await getDb()
  const item = await getPublicContentBySlug(db, decoded)
  if (!item) notFound()
  const actor = await getCurrentActor()
  const scope = await studentScopeOf(db, actor)
  if (!contentInScope(scope, item)) return <div className="container py-10"><OutOfScopeNotice label={scope?.label ?? null} /></div>
  return <LessonView item={item} actor={actor} surface="public" back={{ href: '/lessons', label: 'الدروس' }} className="container py-10" />
}
