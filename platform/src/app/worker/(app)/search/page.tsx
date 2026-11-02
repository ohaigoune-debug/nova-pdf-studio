import { Search } from 'lucide-react'
import { WorkerOrderCard } from '@/components/worker/worker-orders'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getCurrentActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { ecotrackOperatorStatus, ecotrackStatus } from '@/server/services/ecotrack.service'
import { searchOrdersForWorker } from '@/server/services/store.service'
import { toWorkerOrder } from '../worker-order'

export const dynamic = 'force-dynamic'

/**
 * «بحث وتفعيل»: الزبون يتصل ليقول وصل الكتاب، أو يطلب كود التفعيل — يُبحث برقم هاتفه أو رقم الطلب،
 * ثم «سُلِّم وتفعيل»، أو «كود التفعيل»، أو الإرسال إلى الناقل، أو نتيجة المكالمة لطلب لم يُؤكَّد بعد.
 */
export default async function WorkerSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = (await getCurrentActor())!
  const db = await getDb()
  const q = ((await searchParams).q ?? '').slice(0, 40)
  const [rows, eco] = await Promise.all([searchOrdersForWorker(db, actor, q), actor.role === 'CONFIRMER' ? ecotrackOperatorStatus(db, actor) : ecotrackStatus(db)])
  return (
    <div className="space-y-4">
      <form className="flex gap-2" action="/worker/search">
        <Input name="q" defaultValue={q} type="search" inputMode="tel" dir="ltr" placeholder="رقم الهاتف أو رقم الطلب" className="h-12 text-lg" autoFocus={!q} />
        <Button type="submit" className="h-12 shrink-0" aria-label="بحث">
          <Search className="size-5" />
        </Button>
      </form>
      {!q ? (
        <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">اكتب رقم هاتف الزبون (10 أرقام) أو جزءًا من رقم الطلب.</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">لا طلبات بهذا الرقم.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <WorkerOrderCard key={r.id} order={toWorkerOrder(r, actor)} ecotrack={eco.enabled} />
          ))}
        </ul>
      )}
    </div>
  )
}
