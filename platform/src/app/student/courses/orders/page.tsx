import { MyOrdersTracking } from '@/components/domain/order-tracking'
import { AdPixels } from '@/components/landing/ad-pixels'
import { HubTabs } from '@/components/student/hub-tabs'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { recentLandingConversions } from '@/server/services/ad-pixels.service'
import { myTrackedOrders } from '@/server/services/order-tracking.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'طلباتي' }

/** داخل «الدورات»: طلباتي لحظة بلحظة، والإلغاء قبل الشحن */
export default async function StudentOrdersPage() {
  const actor = await requirePageActor('STUDENT')
  const db = await getDb()
  const [rows, conversions] = await Promise.all([myTrackedOrders(db, actor), recentLandingConversions(db, actor.userId)])
  return (
    <>
      {/* طلب جاء من صفحة هبوط: يُبلَّغ لبكسل الإعلانات (إن كان مضبوطًا) — رقم الطلب يمنع التكرار */}
      {conversions.length ? <AdPixels events={conversions} /> : null}
      <HubTabs hub="courses" />
      <PageHeader title="طلباتي" description="حالة كل طلب لحظة بلحظة. يمكنك إلغاء الطلب ما دام لم يُسلَّم لشركة التوصيل." />
      <MyOrdersTracking orders={rows.map((o) => ({ ...o, createdAt: o.createdAt.toISOString(), timeline: o.timeline.map((t) => ({ ...t, at: t.at.toISOString() })) }))} />
    </>
  )
}
