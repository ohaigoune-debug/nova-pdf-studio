import { ExamGenerateForm } from '@/components/domain/exam-generate-form'
import { PageHeader } from '@/components/ui/misc'
import { aiProviderInfo } from '@/server/ai/provider'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { bankFormOptions } from '@/server/queries/bank-options'

export const dynamic = 'force-dynamic'

export default async function GenerateExamPage() {
  const actor = await requirePageActor('TEACHER')
  const opts = await bankFormOptions(await getDb(), actor)
  return (
    <>
      <PageHeader title="ابنِ لي الامتحان" description="حدّد المادة والصف والمدة والصعوبة — أو اكتب طلبك — فتُبنى الورقة من البنك في ثوانٍ، ويُولَّد الناقص بالذكاء الاصطناعي." />
      <div className="max-w-4xl">
        <ExamGenerateForm subjects={opts.subjects} levels={opts.levels} streams={opts.streams} aiConfigured={aiProviderInfo().configured} />
      </div>
    </>
  )
}
