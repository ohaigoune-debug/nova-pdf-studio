import { notFound } from 'next/navigation'
import { BankQuestionForm } from '@/components/domain/bank-question-form'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { bankFormOptions } from '@/server/queries/bank-options'
import { getOwnQuestion } from '@/server/services/question-bank.service'

/** سؤال فرعي تحت تمرين أو نصّ */
export default async function NewSubQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('TEACHER')
  const { id } = await params
  const db = await getDb()
  let parent
  try {
    parent = await getOwnQuestion(db, actor, id)
  } catch (e) {
    if (e instanceof AppError) notFound()
    throw e
  }
  const options = await bankFormOptions(db, actor, { subjectId: parent.subjectId, levelId: parent.levelId, streamId: parent.streamId })
  return (
    <>
      <PageHeader title={`سؤال فرعي تحت: ${parent.title ?? parent.body.slice(0, 60)}`} />
      <div className="max-w-4xl">
        <BankQuestionForm options={options} parentId={parent.id} />
      </div>
    </>
  )
}
