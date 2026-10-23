import { BookMarked } from 'lucide-react'
import Link from 'next/link'
import { CourseCatalogCard } from '@/components/academy/course-catalog-card'
import { ScopePicker } from '@/components/academy/scope-picker'
import { Button } from '@/components/ui/button'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { browseOptions, browseScope, listCourseCatalog } from '@/server/services/academy-catalog.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'كتالوج الدورات' }

type Q = { level?: string; stream?: string; subject?: string }

/**
 * /student/courses/catalog — كل الدورات المنشورة لأي تلميذ (مشترِك أو لا).
 * الاكتشاف هنا، والدخول إلى المحتوى في /student/courses/[slug] بعد اشتراك سارٍ وقبول الشروط.
 */
export default async function CourseCatalogPage({ searchParams }: { searchParams: Promise<Q> }) {
  const actor = await requirePageActor('STUDENT')
  const sp = await searchParams
  const db = await getDb()
  const scope = await browseScope(db, actor, sp)
  const [items, options] = await Promise.all([listCourseCatalog(db, actor, scope), browseOptions(db, scope)])
  return (
    <>
      <PageHeader
        title="كتالوج الدورات"
        description="كل الدورات المتاحة في الأكاديمية — المجانية والمدفوعة. تصفّح بحرية؛ يُفعَّل الاشتراك عند استلام الكتاب أو برمز التفعيل."
        actions={
          <Button asChild variant="outline">
            <Link href="/student/courses">دوراتي</Link>
          </Button>
        }
      />
      <ScopePicker base="/student/courses/catalog" value={scope} options={options} fromProfile={scope.fromProfile} />
      {items.length === 0 ? (
        <EmptyState icon={BookMarked} title="لا دورات منشورة بهذه المرشّحات" description="جرّب «الكل» في المستوى أو المادة، أو عد لاحقاً: تُضاف الدورات مع بداية كل موسم." className="mt-6" />
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((c) => (
            <CourseCatalogCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </>
  )
}
