import { CourseCodesPanel } from '@/components/courses/course-codes-panel'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listCourseCodeBatches } from '@/server/services/course-codes.service'
import { listCoursesAdmin } from '@/server/services/courses.service'

export const dynamic = 'force-dynamic'

/** أكواد تفعيل الدورات: دفعة لكل دورة، كل كود يفتح الدورة الموجّه لها مرة واحدة */
export default async function CourseCodesPage({ searchParams }: { searchParams: Promise<{ course?: string }> }) {
  const actor = await requirePageActor('SUPER_ADMIN')
  const sp = await searchParams
  const db = await getDb()
  const [courses, batches] = await Promise.all([listCoursesAdmin(db, actor), listCourseCodeBatches(db, actor)])
  const live = courses.filter((c) => c.status !== 'ARCHIVED')
  return (
    <div className="space-y-6">
      <PageHeader title="أكواد تفعيل الدورات" description="ولّد أكواداً لدورة بعينها (للبيع اليدوي، أو حين يفشل التفعيل بالتسليم). يُدخلها التلميذ في «تفعيل دورة»." />
      <CourseCodesPanel
        courses={live.map((c) => ({ id: c.id, title: c.title }))}
        defaultCourseId={live.some((c) => c.id === sp.course) ? sp.course : undefined}
        batches={batches.map((b) => ({ ...b, expiresAt: b.expiresAt ? b.expiresAt.toISOString() : null, createdAt: b.createdAt.toISOString() }))}
      />
    </div>
  )
}
