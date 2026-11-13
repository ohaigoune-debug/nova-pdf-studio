import { notFound } from 'next/navigation'
import { LessonComments, LessonQuizButton } from '@/components/domain/lesson-extras'
import { LessonView } from '@/components/domain/lesson-view'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { getContentForStudent } from '@/server/services/content.service'
import { lessonQuizForStudent, listLessonComments } from '@/server/services/lesson-extras.service'

/** درس التلميذ: الصفحة الواحدة (LessonView) ومعها اختبار الدرس والتعليقات */
export default async function StudentLessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const actor = await requirePageActor('STUDENT')
  const { slug } = await params
  const db = await getDb()
  let item
  try {
    let decoded = slug
    try {
      decoded = decodeURIComponent(slug)
    } catch {
      notFound()
    }
    item = await getContentForStudent(db, actor, decoded)
  } catch (e) {
    if (isAppError(e)) notFound()
    throw e
  }
  // تحت الوسائط: اختبار QCM المرتبط + التعليقات (بموافقة الأستاذ)
  const [quiz, comments] = await Promise.all([lessonQuizForStudent(db, actor, item.id), listLessonComments(db, actor, item.id)])
  return (
    <LessonView
      item={item}
      actor={actor}
      surface="student"
      back={{ href: '/student/lessons', label: 'الدروس' }}
      extras={quiz ? <LessonQuizButton quiz={quiz} /> : null}
      footer={<LessonComments slug={item.slug} comments={comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))} />}
    />
  )
}
