import { notFound } from 'next/navigation'
import { ContentForm } from '@/components/domain/content-form'
import { LessonQuizPicker } from '@/components/domain/lesson-extras'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { t } from '@/i18n'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { teacherFormOptions } from '@/server/queries/teacher-form-options'
import { getContentForEdit } from '@/server/services/content.service'
import { lessonQuizForTeacher } from '@/server/services/lesson-extras.service'
import { listQuizzesForTeacher } from '@/server/services/quizzes.service'

export default async function EditContentPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('TEACHER')
  const { id } = await params
  const db = await getDb()
  let c
  try {
    c = await getContentForEdit(db, actor, id)
  } catch (e) {
    if (isAppError(e)) notFound()
    throw e
  }
  const [opts, quizzes, currentQuiz] = await Promise.all([teacherFormOptions(db, actor), listQuizzesForTeacher(db, actor), lessonQuizForTeacher(db, actor, c.id)])
  return (
    <>
      <PageHeader title={t('contentMgmt.edit')} description={c.title} />
      <Card className="max-w-3xl">
        <CardContent className="p-6">
          <ContentForm contentId={c.id} defaults={{ ...c, published: !!c.publishedAt }} groups={opts.groups} students={opts.students} levels={opts.levels} streams={opts.streams} skills={opts.skills} files={opts.files} subjects={opts.subjects} nodes={opts.nodes} />
        </CardContent>
      </Card>
      <Card className="mt-6 max-w-3xl">
        <CardContent className="space-y-2 p-6">
          <p className="font-bold">اختبار QCM تحت الحصة</p>
          <p className="text-xs text-muted-foreground">يظهر للتلميذ زرّاً تحت الفيديو، ويُستهدف تلقائياً بأفواج هذه الحصة. التعليقات تحت الحصة تنتظر موافقتك في «التعليقات».</p>
          <LessonQuizPicker contentId={c.id} quizzes={quizzes.map((q) => ({ id: q.id, title: q.title }))} current={currentQuiz} />
        </CardContent>
      </Card>
    </>
  )
}
