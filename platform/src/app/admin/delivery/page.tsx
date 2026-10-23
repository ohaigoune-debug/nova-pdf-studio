import { AlertTriangle, PackageCheck, Truck, Unplug } from 'lucide-react'
import Link from 'next/link'
import { WebhookSecretForm } from '@/components/delivery/delivery-forms'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, PageHeader, StatCard } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import type { DeliveryEventStatus } from '@/server/db/schema/enums'
import { deliverySecretStatus, deliveryStats, listDeliveryEvents } from '@/server/services/delivery.service'

export const dynamic = 'force-dynamic'

const STATUS_AR: Record<DeliveryEventStatus, string> = { CREATED: 'أُنشئت', IN_TRANSIT: 'في الطريق', DELIVERED: 'سُلِّمت', RETURNED: 'مرتجعة', CANCELLED: 'ملغاة', UNKNOWN: 'غير معروفة' }
const STATUS_VARIANT: Record<DeliveryEventStatus, 'secondary' | 'success' | 'warning' | 'muted' | 'destructive'> = { CREATED: 'secondary', IN_TRANSIT: 'secondary', DELIVERED: 'success', RETURNED: 'warning', CANCELLED: 'muted', UNKNOWN: 'muted' }

/** سجلّ أحداث شركة التوصيل (آخر 200) + ضبط سرّ الـwebhook */
export default async function AdminDeliveryPage() {
  const actor = await requirePageActor('SUPER_ADMIN')
  const db = await getDb()
  const [events, stats, secret] = await Promise.all([listDeliveryEvents(db, actor, 200), deliveryStats(db, actor), deliverySecretStatus(db)])
  return (
    <div className="space-y-6">
      <PageHeader title="التوصيل" description="أحداث شركة التوصيل الواردة عبر webhook. عند «سُلِّمت» يُسلَّم الطلب وتُفعَّل الدورة المرتبطة بالكتاب تلقائياً، أو يُرسَل رمز مطالبة بالـSMS إلى وليّ الأمر." />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="كل الأحداث" value={stats.total} icon={Truck} />
        <StatCard label="تسليمات" value={stats.delivered} icon={PackageCheck} tone="success" />
        <StatCard label="بلا طلب مطابق" value={stats.unmatched} icon={Unplug} tone={stats.unmatched ? 'warning' : 'default'} />
        <StatCard label="أخطاء معالجة" value={stats.failed} icon={AlertTriangle} tone={stats.failed ? 'destructive' : 'default'} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>إعداد الـwebhook</CardTitle>
          <CardDescription>
            العنوان: <code dir="ltr">POST /api/v1/delivery/webhook?provider=yalidine</code> (أو <code>generic</code>). المصادقة بترويسة <code dir="ltr">x-webhook-secret</code> أو توقيع <code dir="ltr">x-signature</code> = HMAC-SHA256 للجسم. المطابقة برقم التتبّع المسجَّل على الطلب، وإلا برقم الطلب في الحمولة.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WebhookSecretForm source={secret.source} hint={secret.hint} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>آخر الأحداث</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <EmptyState icon={Truck} title="لا أحداث بعد" description="حين تُرسل شركة التوصيل أول حدث سيظهر هنا." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الوقت</TableHead>
                  <TableHead>المزوّد</TableHead>
                  <TableHead>التتبّع</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الطلب</TableHead>
                  <TableHead>النتيجة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(e.receivedAt)}</TableCell>
                    <TableCell className="text-xs">{e.provider}</TableCell>
                    <TableCell className="font-mono text-xs" dir="ltr">
                      {e.trackingId ?? '—'}
                      <span className="block text-[10px] text-muted-foreground">{e.externalId}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[e.status as DeliveryEventStatus] ?? 'secondary'}>{STATUS_AR[e.status as DeliveryEventStatus] ?? e.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {e.orderId ? (
                        <Link href={`/store/orders/${e.orderId}`} className="font-mono text-xs hover:underline" dir="ltr">
                          {e.orderNumber}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{e.error ? <span className="text-destructive">{e.error}</span> : e.processedAt ? <span className="text-success">عولج</span> : <span className="text-muted-foreground">مسجَّل</span>}</TableCell>
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
