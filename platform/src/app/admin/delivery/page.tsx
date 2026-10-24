import { AlertTriangle, PackageCheck, Truck, Unplug } from 'lucide-react'
import Link from 'next/link'
import { WebhookSecretForm } from '@/components/delivery/delivery-forms'
import { EcotrackSettingsForm } from '@/components/delivery/ecotrack-forms'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, PageHeader, StatCard } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import type { DeliveryEventStatus } from '@/server/db/schema/enums'
import { deliverySecretStatus, deliveryStats, listDeliveryEvents } from '@/server/services/delivery.service'
import { ecotrackStatus, listEcotrackFees } from '@/server/services/ecotrack.service'

export const dynamic = 'force-dynamic'

const STATUS_AR: Record<DeliveryEventStatus, string> = { CREATED: 'أُنشئت', IN_TRANSIT: 'في الطريق', FAILED_ATTEMPT: 'محاولة فاشلة', DELIVERED: 'سُلِّمت', RETURNED: 'مرتجعة', CANCELLED: 'ملغاة', UNKNOWN: 'غير معروفة' }
const STATUS_VARIANT: Record<DeliveryEventStatus, 'secondary' | 'success' | 'warning' | 'muted' | 'destructive'> = { CREATED: 'secondary', IN_TRANSIT: 'secondary', FAILED_ATTEMPT: 'destructive', DELIVERED: 'success', RETURNED: 'warning', CANCELLED: 'muted', UNKNOWN: 'muted' }

/** سجلّ أحداث شركة التوصيل (آخر 200) + ضبط سرّ الـwebhook */
export default async function AdminDeliveryPage() {
  const actor = await requirePageActor('SUPER_ADMIN')
  const db = await getDb()
  const [events, stats, secret, eco, fees] = await Promise.all([listDeliveryEvents(db, actor, 200), deliveryStats(db, actor), deliverySecretStatus(db), ecotrackStatus(db), listEcotrackFees(db)])
  return (
    <div className="space-y-6">
      <PageHeader title="التوصيل" description="EcoTrack: إرسال الطرود بزر واحد ومزامنة التتبّع كل 20 دقيقة. عند «سُلِّمت» يُسلَّم الطلب وتُفعَّل الدورة المرتبطة بالكتاب تلقائياً، أو يُرسَل رمز مطالبة بالـSMS إلى وليّ الأمر. شركات أخرى: عبر webhook." />
      <Card>
        <CardHeader>
          <CardTitle>EcoTrack</CardTitle>
          <CardDescription>رابط منصّتك (https://شركتك.ecotrack.dz) ورمز API من حسابك عندهم. الطلب المؤكَّد يُرسَل طرداً («إرسال إلى EcoTrack» في صف الطلب، أو تلقائياً)، وحالة الطرد تُترجم إلى حالة الطلب.</CardDescription>
        </CardHeader>
        <CardContent>
          <EcotrackSettingsForm status={eco} />
          {fees.length ? (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer font-semibold">رسوم التوصيل لكل ولاية ({fees.length})</summary>
              <div className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {fees.map((f) => (
                  <div key={f.wilayaCode} className="flex justify-between rounded border px-2 py-1 text-xs">
                    <span>
                      <span className="font-mono" dir="ltr">
                        {f.wilayaCode}
                      </span>{' '}
                      {f.wilayaName ?? ''}
                    </span>
                    <span className="tabular text-muted-foreground">
                      منزل {f.homeDzd} · مكتب {f.deskDzd}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="كل الأحداث" value={stats.total} icon={Truck} />
        <StatCard label="تسليمات" value={stats.delivered} icon={PackageCheck} tone="success" />
        <StatCard label="بلا طلب مطابق" value={stats.unmatched} icon={Unplug} tone={stats.unmatched ? 'warning' : 'default'} />
        <StatCard label="أخطاء معالجة" value={stats.failed} icon={AlertTriangle} tone={stats.failed ? 'destructive' : 'default'} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>شركات أخرى: إعداد الـwebhook</CardTitle>
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
