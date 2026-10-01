import { BankQuestionForm } from '@/components/domain/bank-question-form'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { bankFormOptions } from '@/server/queries/bank-options'

export default async function NewBankQuestionPage({ searchParams }: { searchParams: Promise<{ subject?: string; level?: string; stream?: string }> }) {
  const actor = await requirePageActor('TEACHER')
  const q = await searchParams
  const options = await bankFormOptions(await getDb(), actor, { subjectId: q.subject, levelId: q.level, streamId: q.stream })
  return (
    <>
      <PageHeader title="سؤال جديد في البنك" description="صنّفه جيداً: التصنيف هو ما يجعله قابلاً للعثور عليه عند بناء الامتحان." />
      <div className="max-w-4xl">
        <BankQuestionForm options={options} />
      </div>
    </>
  )
}
