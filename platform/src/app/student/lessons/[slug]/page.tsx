import { notFound } from 'next/navigation'
import { LessonPracticeCard } from '@/components/domain/lesson-practice-card'
import { lessonPracticeForStudent } from '@/server/services/lesson-practice.service'
import { LessonComments, LessonQuizButton } from '@/components/domain/lesson-extras'
import { LessonView } from '@/components/domain/lesson-view'
import { OutOfScopeNotice } from '@/components/student/student-scope-ui'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { getContentForStudent } from '@/server/services/content.service'
import { lessonQuizForStudent, listLessonComments } from '@/server/services/lesson-extras.service'
import { studentScope } from '@/server/services/student-scope.service'

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
    // درس لمستوى أو شعبة أخرى (رابط معدَّل أو قديم): رسالة واضحة بدل «غير موجود»
    if (isAppError(e) && e.code === 'LESSON_OUT_OF_SCOPE') return <OutOfScopeNotice label={(await studentScope(db, actor.studentId!)).label} />
    if (isAppError(e)) notFound()
    throw e
  }
  // تحت الوسائط: اختبار QCM المرتبط + التعليقات (بموافقة الأستاذ)
  const [quiz, comments, practice] = await Promise.all([lessonQuizForStudent(db, actor, item.id), listLessonComments(db, actor, item.id), lessonPracticeForStudent(db, actor, item.id)])
  return (
    <LessonView
      item={item}
      actor={actor}
      surface="student"
      back={{ href: '/student/courses', label: 'دوراتي' }}
      extras={
        quiz || practice?.length ? (
          <>
            {quiz ? <LessonQuizButton quiz={quiz} /> : null}
            {/* تمارين من بنك مدرسة تحت الدرس: لمشتركي الدورة */}
            {practice?.length ? <LessonPracticeCard items={practice} /> : null}
          </>
        ) : null
      }
      footer={<LessonComments slug={item.slug} comments={comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))} />}
    />
  )
}
