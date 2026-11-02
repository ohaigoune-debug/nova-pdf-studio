import { BookMarked } from 'lucide-react'
import { CourseCatalogCard } from '@/components/academy/course-catalog-card'
import { HubTabs } from '@/components/student/hub-tabs'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { onlinePaymentEnabled } from '@/server/lib/guiddini'
import { listCourseCatalog, type CatalogCourse } from '@/server/services/academy-catalog.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'كتالوج الدورات' }

/** كل عرض بطاقة: «الدورة + الكتاب» و«النسخة الرقمية» منفصلتان؛ المشترك يرى بطاقة واحدة «دخول الدورة» */
function offerCards(c: CatalogCourse, onlinePay: boolean): { key: string; offer?: 'book' | 'digital' }[] {
  if (c.enrollment === 'ACTIVE') return [{ key: c.id }]
  const digital = onlinePay && c.digitalPriceDzd !== null
  if (!digital) return [{ key: c.id }]
  return [...(c.bookOffer ? [{ key: `${c.id}-book`, offer: 'book' as const }] : []), { key: `${c.id}-digital`, offer: 'digital' as const }]
}

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
      <HubTabs hub="courses" />
      <PageHeader title="كتالوج الدورات" description="دورات البكالوريا المتاحة في الأكاديمية: مع الكتاب الورقي، أو نسخة رقمية تُفتح فور الدفع بالبطاقة." />
      {items.length === 0 ? (
        <EmptyState icon={BookMarked} title="لا دورات منشورة بعد" description="تُضاف الدورات مع بداية كل موسم." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.flatMap((c) => offerCards(c, onlinePay).map((card) => <CourseCatalogCard key={card.key} c={c} offer={card.offer} />))}
        </div>
      )}
    </>
  )
}
