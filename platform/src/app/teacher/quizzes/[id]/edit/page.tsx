import { notFound } from 'next/navigation'
import { QuizBuilder } from '@/components/domain/quiz-builder'
import { toState } from '@/lib/quiz-state'
import { PageHeader } from '@/components/ui/misc'
import { t } from '@/i18n'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { teacherFormOptions } from '@/server/queries/teacher-form-options'
import { getQuizForEdit } from '@/server/services/quizzes.service'

export default async function EditQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('TEACHER')
  const { id } = await params
  const db = await getDb()
  let q
  try {
    q = await getQuizForEdit(db, actor, id)
  } catch (e) {
    if (isAppError(e)) notFound()
    throw e
  }
  const opts = await teacherFormOptions(db, actor)
  return (
    <>
      <PageHeader title={t('quizzes.edit')} description={q.title} />
      <div className="max-w-4xl">
        <QuizBuilder
          quizId={q.id}
          hasAttempts={q.hasAttempts}
          defaults={{ ...q, published: !!q.publishedAt, questions: q.questions.map(toState) }}
          groups={opts.groups}
          students={opts.students}
          skills={opts.skills}
          files={opts.files}
        />
      </div>
    </>
  )
}
