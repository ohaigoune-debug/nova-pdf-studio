import { notFound, redirect } from 'next/navigation'
import { ExamRunner } from '@/components/play/exams/exam-runner'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { getExamAttemptView } from '@/server/services/play-exams.service'

export const dynamic = 'force-dynamic'

export default async function PlayExamAttemptPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params
  const actor = await requirePageActor('STUDENT')
  let view
  try {
    view = await getExamAttemptView(await getDb(), actor, attemptId)
  } catch (e) {
    if (e instanceof AppError) notFound()
    throw e
  }
  if (view.status === 'COMPLETED') redirect(`/student/play/exam/${attemptId}/result`)
  if (view.status !== 'ACTIVE') redirect('/student/play/exams')
  return <ExamRunner view={view} />
}
