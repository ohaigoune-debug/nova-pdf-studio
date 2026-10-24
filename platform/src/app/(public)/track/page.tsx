import { PhoneTracker } from '@/components/domain/order-tracking'
import { PageHeader } from '@/components/ui/misc'

export const metadata = { title: 'تتبّع طلبيتي' }

/** /track — تتبّع الطلب لحظة بلحظة برقم الهاتف وحده (بلا حساب) */
export default async function TrackPage({ searchParams }: { searchParams: Promise<{ phone?: string }> }) {
  const sp = await searchParams
  return (
    <div className="container max-w-2xl py-10">
      <PageHeader title="تتبّع طلبيتي" description="أدخل رقم الهاتف الذي طلبت به: ترى حالة طلبك لحظة بلحظة، ورقم التتبّع وأحداث شركة التوصيل." />
      <PhoneTracker initialPhone={sp.phone?.slice(0, 20)} />
    </div>
  )
}
