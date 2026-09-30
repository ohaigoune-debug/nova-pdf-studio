import { ContentOrganizeReview } from '@/components/domain/content-organize-review'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { teacherFormOptions } from '@/server/queries/teacher-form-options'
import { contentOrganizeStatus } from '@/server/services/content-organize.service'

export const dynamic = 'force-dynamic'

export default async function ContentOrganizePage() {
  const actor = await requirePageActor('TEACHER')
  const db = await getDb()
  const [status, opts] = await Promise.all([contentOrganizeStatus(db, actor), teacherFormOptions(db, actor)])
  return (
    <>
      <PageHeader title="تنظيم الفيديوهات بالذكاء الاصطناعي" description="عناوين نظيفة وملخّصات ومحاور لدروسك المصوّرة — تُقترح عليك، وأنت تطبّق ما تريد." />
      <div className="max-w-4xl">
        <ContentOrganizeReview status={status} levels={opts.levels} streams={opts.streams} />
      </div>
    </>
  )
}
