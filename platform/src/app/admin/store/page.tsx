import { Package, Plus, ShoppingBag, Truck, Wallet } from 'lucide-react'
import Link from 'next/link'
import { OrderRowActions, ProductRowActions } from '@/components/domain/store-admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, PageHeader, StatCard } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn, formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { ORDER_STATUSES, type OrderStatus } from '@/server/db/schema/enums'
import { listOrdersAdmin, listProductsAdmin, ORDER_STATUS_AR, PAYMENT_AR, PRODUCT_TYPE_AR, shippingFeeDzd, storeStats } from '@/server/services/store.service'

export const dynamic = 'force-dynamic'

const STATUS_VARIANT: Record<string, 'secondary' | 'success' | 'warning' | 'muted' | 'destructive'> = { PENDING: 'warning', CONFIRMED: 'secondary', SHIPPED: 'secondary', DELIVERED: 'success', CANCELLED: 'muted' }

/** إدارة المتجر (المرحلة 10): الطلبات بحالاتها، والمنتجات */
export default async function AdminStorePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const actor = await requirePageActor('SUPER_ADMIN')
  const sp = await searchParams
  const status = ORDER_STATUSES.includes(sp.status as OrderStatus) ? (sp.status as OrderStatus) : null
  const db = await getDb()
  const [stats, orders, products] = await Promise.all([storeStats(db, actor), listOrdersAdmin(db, actor, { status }), listProductsAdmin(db, actor)])
  return (
    <div className="space-y-6">
      <PageHeader
        title="المتجر"
        description={`رسوم الشحن الحالية: ${shippingFeeDzd()} دج (STORE_SHIPPING_DZD في البيئة) · الدفع عند الاستلام للورقي، وتحويل يؤكَّد يدوياً للرقمي.`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/store" target="_blank">
                <ShoppingBag className="size-4" /> المتجر العام
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/store/products/new">
                <Plus className="size-4" /> منتج جديد
              </Link>
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatCard label="بانتظار التأكيد" value={stats.pending} icon={ShoppingBag} tone={stats.pending ? 'warning' : 'default'} />
        <StatCard label="مؤكَّدة / في الطريق" value={stats.confirmed + stats.shipped} icon={Truck} />
        <StatCard label="سُلّمت" value={stats.delivered} icon={Package} tone="success" />
        <StatCard label="إيراد المسلَّم" value={`${stats.revenueDzd} دج`} icon={Wallet} />
        <StatCard label="المنتجات" value={stats.products} hint={`${stats.published} منشور · ${stats.downloads} تنزيلاً`} icon={Package} />
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>الطلبات</CardTitle>
          <nav className="flex flex-wrap gap-1 text-xs">
            <Link href="/admin/store" className={cn('rounded-full border px-2.5 py-1', !status ? 'border-primary bg-primary text-primary-foreground' : '')}>
              الكل
            </Link>
            {ORDER_STATUSES.map((s) => (
              <Link key={s} href={`/admin/store?status=${s}`} className={cn('rounded-full border px-2.5 py-1', status === s ? 'border-primary bg-primary text-primary-foreground' : '')}>
                {ORDER_STATUS_AR[s]}
              </Link>
            ))}
          </nav>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <EmptyState icon={ShoppingBag} title="لا طلبات" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الرقم</TableHead>
                  <TableHead>العميل</TableHead>
                  <TableHead>الدفع</TableHead>
                  <TableHead>الإجمالي</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link href={`/store/orders/${o.id}`} className="font-mono text-xs font-semibold hover:underline" dir="ltr">
                        {o.number}
                      </Link>
                      <span className="block text-[11px] text-muted-foreground">{o.items} عنصر</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">{o.customerName}</span>
                      <span className="block text-xs text-muted-foreground" dir="ltr">
                        {o.phone}
                      </span>
                      {o.wilayaName ? <span className="block text-xs text-muted-foreground">{o.wilayaName}</span> : null}
                    </TableCell>
                    <TableCell className="text-xs">{PAYMENT_AR[o.paymentMethod as keyof typeof PAYMENT_AR]}</TableCell>
                    <TableCell className="tabular">{o.totalDzd} دج</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[o.status] ?? 'secondary'}>{ORDER_STATUS_AR[o.status as OrderStatus]}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</TableCell>
                    <TableCell>
                      <OrderRowActions id={o.id} status={o.status} needsShipping={o.needsShipping} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>المنتجات</CardTitle>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <EmptyState icon={Package} title="لا منتجات بعد" action={<Button asChild><Link href="/admin/store/products/new">منتج جديد</Link></Button>} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المنتج</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>السعر</TableHead>
                  <TableHead>المخزون</TableHead>
                  <TableHead>مبيعات</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map(({ p, subjectName, levelName, filesCount }) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/admin/store/products/${p.id}`} className="font-semibold hover:underline">
                        {p.title}
                      </Link>
                      <span className="block text-xs text-muted-foreground">{[subjectName, levelName].filter(Boolean).join(' · ') || '—'}</span>
                    </TableCell>
                    <TableCell className="text-xs">
                      {PRODUCT_TYPE_AR[p.type as keyof typeof PRODUCT_TYPE_AR]}
                      {filesCount ? ` · ${filesCount} ملف` : ''}
                    </TableCell>
                    <TableCell className="tabular">{p.priceDzd} دج</TableCell>
                    <TableCell className="tabular">{p.stock ?? '∞'}</TableCell>
                    <TableCell className="tabular">{p.salesCount}</TableCell>
                    <TableCell>{p.status === 'PUBLISHED' ? <Badge variant="success">منشور</Badge> : p.status === 'ARCHIVED' ? <Badge variant="muted">مؤرشف</Badge> : <Badge variant="secondary">مسودة</Badge>}</TableCell>
                    <TableCell>
                      <ProductRowActions id={p.id} status={p.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
