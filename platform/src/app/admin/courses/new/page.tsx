import { CourseForm } from '@/components/courses/course-form'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { bankFormOptions } from '@/server/queries/bank-options'
import { listCourseWorkspaces } from '@/server/services/courses.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'دورة جديدة' }

export default async function NewCoursePage() {
  const actor = await requirePageActor('SUPER_ADMIN')
  const db = await getDb()
  const [opts, workspaces] = await Promise.all([bankFormOptions(db, actor), listCourseWorkspaces(db, actor)])
  return (
    <>
      <PageHeader title="دورة جديدة" description="املأ البيانات، وأرفق كتابًا إن شئت. بعد الإنشاء تنتقل إلى صفحة الدورة فتضيف دروسها من زر «أضف درسًا»." />
      <div className="max-w-3xl">
        <CourseForm options={{ workspaces, subjects: opts.subjects, levels: opts.levels, streams: opts.streams }} />
      </div>
    </>
  )
}
