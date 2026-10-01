import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DownloadButton } from '@/components/domain/order-downloads'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, PageHeader } from '@/components/ui/misc'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import type { OrderStatus, PaymentMethod } from '@/server/db/schema/enums'
import { AppError } from '@/server/lib/errors'
import { getOrder, ORDER_STATUS_AR, PAYMENT_AR } from '@/server/services/store.service'
import { listingPurchases, listings } from '@/server/db/schema'
import { and, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'تفاصيل الطلب' }

const VARIANT: Record<string, 'secondary' | 'success' | 'warning' | 'muted'> = { PENDING: 'warning', CONFIRMED: 'secondary', SHIPPED: 'secondary', DELIVERED: 'success', CANCELLED: 'muted' }

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor()
  const { id } = await params
  let v
  try {
    v = await getOrder(await getDb(), actor, id)
  } catch (e) {
    if (e instanceof AppError) notFound()
    throw e
  }
  const o = v.order
  const delivered = await (await getDb()).select({ listingId: listings.id, kind: listings.kind, title: listings.title, examId: listings.examId, delivered: listingPurchases.delivered }).from(listingPurchases).innerJoin(listings, eq(listings.id, listingPurchases.listingId)).where(and(eq(listingPurchases.orderId, o.id), eq(listingPurchases.buyerUserId, o.userId)))
  const steps: OrderStatus[] = o.needsShipping ? ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED'] : ['PENDING', 'CONFIRMED', 'DELIVERED']
  const idx = steps.indexOf(o.status as OrderStatus)
  return (
    <div className="container max-w-4xl py-10">
      <PageHeader
        title={`طلب ${o.number}`}
        description={`${formatDateTime(o.createdAt)} · ${PAYMENT_AR[o.paymentMethod as PaymentMethod]}`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={actor.role === 'SUPER_ADMIN' ? '/admin/store' : '/store/orders'}>
              <ArrowRight className="size-4" /> {actor.role === 'SUPER_ADMIN' ? 'إدارة المتجر' : 'طلباتي'}
            </Link>
          </Button>
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge variant={VARIANT[o.status] ?? 'secondary'} className="px-3 py-1 text-sm">
          {ORDER_STATUS_AR[o.status as OrderStatus]}
        </Badge>
        {o.status !== 'CANCELLED' ? (
          <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {steps.map((s, i) => (
              <li key={s} className={i <= idx ? 'font-semibold text-foreground' : ''}>
                {i ? '← ' : ''}
                {ORDER_STATUS_AR[s]}
              </li>
            ))}
          </ol>
        ) : null}
      </div>
      {o.status === 'PENDING' ? <Alert tone="info">{o.paymentMethod === 'TRANSFER' ? 'حوّل المبلغ (CCP / BaridiMob) ثم أرسل الوصل للمشرف؛ عند التأكيد تُفتح التنزيلات هنا.' : 'نتصل بك على رقمك للتأكيد، ثم نشحن الطلب.'}</Alert> : null}
      {o.status === 'CANCELLED' ? <Alert tone="warning">أُلغي الطلب{o.cancelReason ? `: ${o.cancelReason}` : ''}.</Alert> : null}
      {delivered.length ? (
        <Alert tone="success" title="سُلّم من السوق">
          <ul className="space-y-1 text-sm">
            {delivered.map((d) => (
              <li key={d.listingId}>
                {d.title} —{' '}
                {typeof d.delivered.examId === 'string' ? (
                  <Link href={`/teacher/exams/${d.delivered.examId}`} className="underline">
                    نسختك في الامتحانات
                  </Link>
                ) : d.kind === 'EXAM' && d.examId ? (
                  <Link href={`/print/exams/${d.examId}?mode=subject`} className="underline">
                    عرض وطباعة الورقة
                  </Link>
                ) : typeof d.delivered.copied === 'number' ? (
                  <Link href="/teacher/bank" className="underline">
                    {d.delivered.copied} سؤالاً في بنكك
                  </Link>
                ) : (
                  'ملفاته أدناه'
                )}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>العناصر</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {v.items.map((it) => (
                <li key={it.id} className="space-y-2 py-3">
                  <div className="flex items-center justify-between gap-2">
                    {it.slug ? (
                      <Link href={`/store/${it.slug}`} className="font-semibold hover:underline">
                        {it.title}
                      </Link>
                    ) : (
                      <span className="font-semibold">{it.title}</span>
                    )}
                    <span className="tabular">
                      {it.qty} × {it.unitPriceDzd} = {it.lineTotalDzd} دج
                    </span>
                  </div>
                  {it.files.length ? (
                    <div className="flex flex-wrap gap-2">
                      {v.canDownload ? it.files.map((f) => <DownloadButton key={f.id} orderId={o.id} productFileId={f.id} name={f.label ?? f.name} />) : <span className="text-xs text-muted-foreground">{it.files.length} ملف يُتاح بعد التأكيد.</span>}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            <div className="mt-3 space-y-1 border-t pt-3 text-sm">
              <p className="flex justify-between">
                <span>المجموع</span>
                <span className="tabular">{o.subtotalDzd} دج</span>
              </p>
              {o.needsShipping ? (
                <p className="flex justify-between text-muted-foreground">
                  <span>الشحن</span>
                  <span className="tabular">{o.shippingDzd} دج</span>
                </p>
              ) : null}
              <p className="flex justify-between text-base font-bold">
                <span>الإجمالي</span>
                <span className="tabular">{o.totalDzd} دج</span>
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>التوصيل</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-semibold">{o.customerName}</p>
            <p dir="ltr" className="text-start">
              {o.phone}
            </p>
            {o.wilayaName ? <p>{o.wilayaName}</p> : null}
            {o.address ? <p className="whitespace-pre-line text-muted-foreground">{o.address}</p> : null}
            {o.note ? <p className="text-xs text-muted-foreground">ملاحظة: {o.note}</p> : null}
            {actor.role === 'SUPER_ADMIN' && o.customerEmail ? <p className="text-xs text-muted-foreground" dir="ltr">{o.customerEmail}</p> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
