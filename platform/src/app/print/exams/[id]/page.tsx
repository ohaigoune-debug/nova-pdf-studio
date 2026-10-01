import { notFound } from 'next/navigation'
import { ExamPrint, type PrintMode } from '@/components/domain/exam-print'
import { PrintToolbar } from '@/components/domain/print-toolbar'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { getExam } from '@/server/services/exams.service'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  void id
  return { title: 'طباعة الامتحان' }
}

/** الموضوع أو التصحيح بصيغة A4 جاهزة للطباعة أو الحفظ PDF من المتصفّح */
export default async function ExamPrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mode?: string }> }) {
  const actor = await requirePageActor('TEACHER')
  const { id } = await params
  const q = await searchParams
  const mode: PrintMode = q.mode === 'correction' ? 'correction' : 'subject'
  let exam
  try {
    exam = await getExam(await getDb(), actor, id)
  } catch (e) {
    if (e instanceof AppError) notFound()
    throw e
  }
  return (
    <>
      <PrintToolbar examId={id} mode={mode} title={exam.title} />
      <ExamPrint exam={exam} mode={mode} />
    </>
  )
}
