import { MyOrdersTracking } from '@/components/domain/order-tracking'
import { HubTabs } from '@/components/student/hub-tabs'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { myTrackedOrders } from '@/server/services/order-tracking.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'تتبّع طلبيتي' }

/** داخل «الدورات»: طلباتي لحظة بلحظة، والإلغاء قبل الشحن */
export default async function StudentOrdersPage() {
  const actor = await requirePageActor('STUDENT')
  const rows = await myTrackedOrders(await getDb(), actor)
  return (
    <>
      <HubTabs hub="courses" />
      <PageHeader title="تتبّع طلبيتي" description="حالة كل طلب لحظة بلحظة. يمكنك إلغاء الطلب ما دام لم يُسلَّم لشركة التوصيل." />
      <MyOrdersTracking orders={rows.map((o) => ({ ...o, createdAt: o.createdAt.toISOString(), timeline: o.timeline.map((t) => ({ ...t, at: t.at.toISOString() })) }))} />
    </>
  )
}
