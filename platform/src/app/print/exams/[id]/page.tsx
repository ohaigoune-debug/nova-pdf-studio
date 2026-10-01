import { notFound } from 'next/navigation'
import { ExamPrint, type PrintMode } from '@/components/domain/exam-print'
import { PrintToolbar } from '@/components/domain/print-toolbar'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { applyVariant, VARIANTS, type Variant } from '@/server/lib/exam-render'
import { autoTitle, type ExamView } from '@/server/services/exams.service'
import { getExamForReader } from '@/server/services/marketplace.service'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  void id
  return { title: 'طباعة الامتحان' }
}

/** الموضوع أو التصحيح بصيغة A4 جاهزة للطباعة أو الحفظ PDF من المتصفّح */
export default async function ExamPrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mode?: string; variant?: string }> }) {
  const actor = await requirePageActor()
  const { id } = await params
  const q = await searchParams
  const mode: PrintMode = q.mode === 'correction' ? 'correction' : 'subject'
  let exam: ExamView
  let readOnly = false
  try {
    // المالك يطبع ويعدّل؛ مشتري عرض من السوق يطبع فقط
    const r = await getExamForReader(await getDb(), actor, id)
    exam = r.exam
    readOnly = r.readOnly
  } catch (e) {
    if (e instanceof AppError) notFound()
    throw e
  }
  const variant: Variant = (VARIANTS as readonly string[]).includes(q.variant ?? '') ? (q.variant as Variant) : 'A'
  const view: ExamView = variant === 'A' ? exam : renumber({ ...exam, items: applyVariant(exam.items, exam.id, variant) })
  return (
    <>
      <PrintToolbar examId={id} mode={mode} variant={variant} title={exam.title} readOnly={readOnly} />
      <ExamPrint exam={view} mode={mode} variant={variant} />
    </>
  )
}

/** بعد خلط النسخة: ترقيم جديد بترتيب الظهور (العناوين اليدوية تبقى) */
function renumber(view: ExamView): ExamView {
  const numbering: Record<string, string> = {}
  let ex = 0
  let q = 0
  for (const it of view.items) {
    if (it.kind === 'EXERCISE') numbering[it.id] = it.title?.trim() || autoTitle('EXERCISE', ++ex)
    else if (it.kind === 'QUESTION') numbering[it.id] = it.title?.trim() || autoTitle('QUESTION', ++q)
  }
  return { ...view, numbering }
}
