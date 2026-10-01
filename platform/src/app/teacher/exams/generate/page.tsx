import { asc, isNull } from 'drizzle-orm'
import { BacGenerateCard } from '@/components/domain/bac-generate-card'
import { ExamGenerateForm } from '@/components/domain/exam-generate-form'
import { PageHeader } from '@/components/ui/misc'
import { aiProviderInfo } from '@/server/ai/provider'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { streams, subjects } from '@/server/db/schema'
import { bankFormOptions } from '@/server/queries/bank-options'

export const dynamic = 'force-dynamic'

export default async function GenerateExamPage() {
  const actor = await requirePageActor('TEACHER')
  const db = await getDb()
  const [opts, subjectRows, streamRows] = await Promise.all([bankFormOptions(db, actor), db.select({ id: subjects.id, name: subjects.nameAr, code: subjects.code }).from(subjects).orderBy(asc(subjects.sortOrder)), db.select({ id: streams.id, name: streams.nameAr, code: streams.code }).from(streams).where(isNull(streams.parentId)).orderBy(asc(streams.sortOrder))])
  return (
    <>
      <PageHeader title="ابنِ لي الامتحان" description="حدّد المادة والصف والمدة والصعوبة — أو اكتب طلبك — فتُبنى الورقة من البنك في ثوانٍ، ويُولَّد الناقص بالذكاء الاصطناعي." />
      <div className="max-w-4xl space-y-6">
        <ExamGenerateForm subjects={opts.subjects} levels={opts.levels} streams={opts.streams} aiConfigured={aiProviderInfo().configured} />
        <BacGenerateCard subjects={subjectRows} streams={streamRows.filter((s) => !s.code.startsWith('TC_'))} />
      </div>
    </>
  )
}
