import { notFound } from 'next/navigation'
import { ExamBuilder } from '@/components/domain/exam-builder'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { bankFormOptions } from '@/server/queries/bank-options'
import { getExam } from '@/server/services/exams.service'

export const dynamic = 'force-dynamic'

export default async function ExamBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('TEACHER')
  const { id } = await params
  const db = await getDb()
  let exam
  try {
    exam = await getExam(db, actor, id)
  } catch (e) {
    if (e instanceof AppError) notFound()
    throw e
  }
  const opts = await bankFormOptions(db, actor)
  return (
    <>
      <PageHeader title={exam.title} description="اسحب من البنك إلى الورقة، رتّب، عدّل داخل الورقة، وراقب المجموع والصعوبة." />
      <ExamBuilder exam={exam} options={{ subjects: opts.subjects, levels: opts.levels, streams: opts.streams }} />
    </>
  )
}
