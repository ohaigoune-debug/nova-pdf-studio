import { ShoppingBag } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import type { OrderStatus, PaymentMethod } from '@/server/db/schema/enums'
import { myOrders, ORDER_STATUS_AR, PAYMENT_AR } from '@/server/services/store.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'طلباتي' }

const VARIANT: Record<string, 'secondary' | 'success' | 'warning' | 'muted'> = { PENDING: 'warning', CONFIRMED: 'secondary', SHIPPED: 'secondary', DELIVERED: 'success', CANCELLED: 'muted' }

export default async function MyOrdersPage() {
  const actor = await requirePageActor()
  const rows = await myOrders(await getDb(), actor)
  return (
    <div className="container py-10">
      <PageHeader title="طلباتي" actions={<Button asChild variant="outline" size="sm"><Link href="/store">المتجر</Link></Button>} />
      {rows.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="لا طلبات بعد" action={<Button asChild><Link href="/store">تصفّح المتجر</Link></Button>} />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {rows.map((o) => (
            <li key={o.id}>
              <Link href={`/store/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm hover:bg-muted/50">
                <span>
                  <span className="font-mono font-semibold" dir="ltr">
                    {o.number}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {formatDateTime(o.createdAt)} · {o.items} عنصر · {PAYMENT_AR[o.paymentMethod as PaymentMethod]}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="tabular font-bold">{o.totalDzd} دج</span>
                  <Badge variant={VARIANT[o.status] ?? 'secondary'}>{ORDER_STATUS_AR[o.status as OrderStatus]}</Badge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
