import { notFound } from 'next/navigation'
import { BankQuestionForm } from '@/components/domain/bank-question-form'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { bankFormOptions } from '@/server/queries/bank-options'
import { getOwnQuestion } from '@/server/services/question-bank.service'

export default async function EditBankQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('TEACHER')
  const { id } = await params
  const db = await getDb()
  let question
  try {
    question = await getOwnQuestion(db, actor, id)
  } catch (e) {
    if (e instanceof AppError) notFound()
    throw e
  }
  const options = await bankFormOptions(db, actor, { subjectId: question.subjectId, levelId: question.levelId, streamId: question.streamId })
  return (
    <>
      <PageHeader title="تعديل سؤال" description={question.status === 'NEEDS_REVIEW' ? 'سؤال مستخرج من ملف: راجعه واحفظه ليُعتمد.' : undefined} />
      <div className="max-w-4xl">
        <BankQuestionForm question={question} options={options} />
      </div>
    </>
  )
}
