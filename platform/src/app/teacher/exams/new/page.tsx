import { ExamNewForm } from '@/components/domain/exam-new-form'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { bankFormOptions } from '@/server/queries/bank-options'

export default async function NewExamPage() {
  const actor = await requirePageActor('TEACHER')
  const opts = await bankFormOptions(await getDb(), actor)
  return (
    <>
      <PageHeader title="امتحان جديد" description="حدّد التصنيف والمدة، ثم ابنِ الورقة من البنك." />
      <div className="max-w-2xl">
        <ExamNewForm subjects={opts.subjects} levels={opts.levels} streams={opts.streams} />
      </div>
    </>
  )
}
