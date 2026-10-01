import { BankImportForm } from '@/components/domain/bank-import-form'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isTextExtractable } from '@/server/lib/doc-text'
import { bankFormOptions } from '@/server/queries/bank-options'
import { extractionStatus } from '@/server/services/question-bank.service'
import { listQuizzesForTeacher } from '@/server/services/quizzes.service'
import { listSourceFiles } from '@/server/services/sources.service'

export const dynamic = 'force-dynamic'

export default async function BankImportPage() {
  const actor = await requirePageActor('TEACHER')
  const db = await getDb()
  const [opts, files, quizzes, extraction] = await Promise.all([bankFormOptions(db, actor), actor.workspaceId ? listSourceFiles(db, actor.workspaceId) : [], listQuizzesForTeacher(db, actor), extractionStatus(db, actor)])
  return (
    <>
      <PageHeader title="استيراد إلى بنك الأسئلة" description="اختبارات قديمة وسلاسل تمارين من ملفاتك، أو أسئلة اختباراتك الإلكترونية." />
      <div className="max-w-4xl">
        <BankImportForm files={files.filter((f) => isTextExtractable(f.mimeType)).map((f) => ({ id: f.id, name: f.name }))} quizzes={quizzes.map((q) => ({ id: q.id, name: q.title }))} subjects={opts.subjects} levels={opts.levels} streams={opts.streams} extraction={extraction} />
      </div>
    </>
  )
}
