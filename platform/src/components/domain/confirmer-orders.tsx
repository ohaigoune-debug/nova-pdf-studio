import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { listOrdersAdmin } from '@/server/services/store.service'
import { ORDER_STATUS_AR, PAYMENT_AR } from '@/server/services/store.service'
import type { OrderStatus, PaymentMethod } from '@/server/db/schema/enums'
import { OrderRowActions } from './store-admin'

/** قائمة طلبات الموظف: الحقول والإجراءات نفسها؛ بطاقات على الهاتف وجدول على الشاشات الأعرض */
export function ConfirmerOrders({ orders, ecotrack }: { orders: Awaited<ReturnType<typeof listOrdersAdmin>>; ecotrack: boolean }) {
  return <div className="space-y-6">
    <PageHeader title="الطلبات" description="طلبات التوصيل عند الاستلام. تأكيد العميل والمتابعة قبل الشحن." actions={<Button asChild variant="outline"><Link href="/admin/store/confirm">طابور التأكيد</Link></Button>} />
    {orders.length === 0 ? <p className="text-muted-foreground">لا طلبات.</p> : <>
      <ul className="space-y-3 md:hidden">
        {orders.map((order) => <li key={order.id} className="rounded-lg border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <span dir="ltr" className="font-mono text-sm font-semibold">{order.number}</span>
            <Badge>{ORDER_STATUS_AR[order.status as OrderStatus]}</Badge>
          </div>
          <p className="mt-2 font-semibold">{order.customerName}</p>
          <a href={`tel:${order.phone}`} dir="ltr" className="inline-flex min-h-11 items-center text-base font-semibold text-primary">{order.phone}</a>
          <p className="text-sm text-muted-foreground">{[order.wilayaName, order.commune].filter(Boolean).join(' · ')}</p>
          <p className="mt-1 text-sm">{order.totalDzd} دج · {PAYMENT_AR[order.paymentMethod as PaymentMethod]}</p>
          <div className="mt-3"><OrderRowActions id={order.id} status={order.status} needsShipping={order.needsShipping} ecotrack={ecotrack} confirmer /></div>
        </li>)}
      </ul>
      <div className="hidden md:block">
        <Table><TableHeader><TableRow><TableHead>الطلب</TableHead><TableHead>العميل</TableHead><TableHead>المبلغ</TableHead><TableHead>الحالة</TableHead><TableHead /></TableRow></TableHeader><TableBody>{orders.map((order) => <TableRow key={order.id}>
          <TableCell><span dir="ltr" className="font-mono text-xs">{order.number}</span></TableCell>
          <TableCell><span className="font-semibold">{order.customerName}</span><a href={`tel:${order.phone}`} dir="ltr" className="block text-primary">{order.phone}</a><span className="text-xs text-muted-foreground">{[order.wilayaName, order.commune].filter(Boolean).join(' · ')}</span></TableCell>
          <TableCell>{order.totalDzd} دج <span className="block text-xs">{PAYMENT_AR[order.paymentMethod as PaymentMethod]}</span></TableCell>
          <TableCell><Badge>{ORDER_STATUS_AR[order.status as OrderStatus]}</Badge></TableCell>
          <TableCell><OrderRowActions id={order.id} status={order.status} needsShipping={order.needsShipping} ecotrack={ecotrack} confirmer /></TableCell>
        </TableRow>)}</TableBody></Table>
      </div>
    </>}
  </div>
}
