import { notFound } from 'next/navigation'
import { Board } from '@/components/studio/board'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { getExam } from '@/server/services/exams.service'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  return { title: 'السبّورة' }
}

/** وضع السبّورة: عرض الورقة على شاشة القسم عنصراً عنصراً */
export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('TEACHER')
  const { id } = await params
  try {
    const exam = await getExam(await getDb(), actor, id)
    return <Board exam={exam} />
  } catch (e) {
    if (e instanceof AppError) notFound()
    throw e
  }
}
