import { QuizBuilder } from '@/components/domain/quiz-builder'
import { PageHeader } from '@/components/ui/misc'
import { t } from '@/i18n'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { teacherFormOptions } from '@/server/queries/teacher-form-options'

export default async function NewQuizPage() {
  const actor = await requirePageActor('TEACHER')
  const opts = await teacherFormOptions(await getDb(), actor)
  return (
    <>
      <PageHeader title={t('quizzes.new')} description="الأسئلة الموضوعية تُصحَّح آلياً فور الإرسال، والمقالية تنتظر تصحيحك." />
      <div className="max-w-4xl">
        <QuizBuilder groups={opts.groups} students={opts.students} skills={opts.skills} files={opts.files} />
      </div>
    </>
  )
}
