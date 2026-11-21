import { BookMarked } from 'lucide-react'
import { CourseCatalogCard } from '@/components/academy/course-catalog-card'
import { HubTabs } from '@/components/student/hub-tabs'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { onlinePaymentEnabled } from '@/server/lib/guiddini'
import { listCourseCatalog } from '@/server/services/academy-catalog.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'الكتب والدورات' }

/**
 * /student/courses/catalog — كل الدورات المنشورة مباشرة، بلا مرشّحات (الدورات حالياً للبكالوريا فقط).
 * الاكتشاف هنا، والدخول إلى المحتوى في /student/courses/[slug] بعد اشتراك سارٍ وقبول الشروط.
 */
export default async function CourseCatalogPage() {
  const actor = await requirePageActor('STUDENT')
  const db = await getDb()
  const [items, onlinePay] = await Promise.all([listCourseCatalog(db, actor), onlinePaymentEnabled(db)])
  return (
    <>
      <HubTabs hub="shop" />
      <PageHeader title="الكتب والدورات" description="اختر النسخة الرقمية أو الدورة مع الكتاب الورقي." />
      {items.length === 0 ? (
        <EmptyState icon={BookMarked} title="لا دورات منشورة بعد" description="تُضاف الدورات مع بداية كل موسم." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((c) => <CourseCatalogCard key={c.id} c={c} onlinePay={onlinePay} />)}
        </div>
      )}
    </>
  )
}
