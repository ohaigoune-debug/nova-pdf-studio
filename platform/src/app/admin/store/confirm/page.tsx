import { Clock, Phone, PhoneCall, PhoneMissed } from 'lucide-react'
import Link from 'next/link'
import { CallConfirmForm } from '@/components/delivery/confirm-forms'
import { OrderRowActions } from '@/components/domain/store-admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, PageHeader, StatCard } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import type { OrderStatus } from '@/server/db/schema/enums'
import { callPairingUrl, getCallConfirm, listCallEvents } from '@/server/services/call-confirm.service'
import { ecotrackStatus } from '@/server/services/ecotrack.service'
import { ORDER_STATUS_AR } from '@/server/services/order-status.service'
import { listConfirmationQueue, PAYMENT_AR } from '@/server/services/store.service'

export const dynamic = 'force-dynamic'

const RESULT_AR: Record<string, string> = { phone_verified: 'أكّد هاتف حسابه', confirmed: 'أكّد طلبه', already_confirmed: 'مؤكَّد من قبل', no_order: 'بلا طلب', invalid_phone: 'رقم غير مفهوم', disabled: 'الخدمة متوقفة' }
const STATUS_VARIANT: Record<string, 'warning' | 'secondary' | 'muted'> = { PENDING: 'warning', NO_ANSWER: 'secondary', CALL_LATER: 'secondary' }

/** طابور التأكيد الهاتفي (نسق NOVA): الطلبات التي تنتظر مكالمة، بأزرار «تأكيد / لا يردّ / لاحقاً / إلغاء»، وإعداد التأكيد بالمكالمة الفائتة */
export default async function ConfirmQueuePage() {
  const actor = await requirePageActor('SUPER_ADMIN')
  const db = await getDb()
  const [queue, cfg, events, eco] = await Promise.all([listConfirmationQueue(db, actor), getCallConfirm(db), listCallEvents(db, actor, 30), ecotrackStatus(db)])
  const { secret, ...cfgView } = cfg
  const pending = queue.filter((o) => o.status === 'PENDING').length
  const noAnswer = queue.filter((o) => o.status === 'NO_ANSWER').length
  const later = queue.filter((o) => o.status === 'CALL_LATER').length
  const tel = (p: string) => `tel:${p.replace(/\s/g, '')}`
  return (
    <div className="space-y-6">
      <PageHeader
        title="طابور التأكيد"
        description="اتصل بالزبون من هنا: «تأكيد» يرسل الطلب إلى التوصيل (أو تلقائياً إلى EcoTrack)، «لا يردّ» و«لاحقاً» تسجّلان المحاولة. الزبون الذي أكّد برمز SMS أو اتصل بالرقم المعلَن يُؤكَّد طلبه وحده."
        actions={
          <Button asChild variant="outline">
            <Link href="/admin/store">كل الطلبات</Link>
          </Button>
        }
      />
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="جديدة" value={pending} icon={PhoneCall} tone={pending ? 'warning' : 'default'} />
        <StatCard label="لا يردّ" value={noAnswer} icon={PhoneMissed} />
        <StatCard label="اتصل لاحقاً" value={later} icon={Clock} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>الطلبات التي تنتظر التأكيد</CardTitle>
          <CardDescription>الأقدم أولاً. اضغط رقم الهاتف للاتصال مباشرة من الجوال.</CardDescription>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <EmptyState icon={PhoneCall} title="لا طلبات تنتظر التأكيد" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الطلب</TableHead>
                  <TableHead>الزبون</TableHead>
                  <TableHead>المحتوى</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>المحاولات</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link href={`/store/orders/${o.id}`} className="font-mono text-xs font-semibold hover:underline" dir="ltr">
                        {o.number}
                      </Link>
                      <span className="block text-[11px] text-muted-foreground">{formatDateTime(o.createdAt)}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {o.totalDzd} دج · {PAYMENT_AR[o.paymentMethod as keyof typeof PAYMENT_AR]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">{o.customerName}</span>
                      <a href={tel(o.phone)} className="flex items-center gap-1 text-sm text-primary hover:underline" dir="ltr">
                        <Phone className="size-3.5" /> {o.phone}
                      </a>
                      <span className="block text-xs text-muted-foreground">{[o.wilayaName, o.commune].filter(Boolean).join(' · ') || '—'}</span>
                      {o.otpVerifiedAt ? <Badge variant="success">هاتف مؤكَّد بالرمز</Badge> : null}
                    </TableCell>
                    <TableCell className="max-w-[260px] text-xs">
                      <span className="line-clamp-2">{o.itemsText || '—'}</span>
                      {o.note ? <span className="block text-muted-foreground">ملاحظة: {o.note}</span> : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[o.status] ?? 'secondary'}>{ORDER_STATUS_AR[o.status as OrderStatus]}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="tabular font-semibold">{o.confirmAttempts}</span>
                      {o.lastCallAt ? <span className="block text-muted-foreground">آخر اتصال {formatDateTime(o.lastCallAt)}</span> : null}
                    </TableCell>
                    <TableCell>
                      <OrderRowActions id={o.id} status={o.status} needsShipping={o.needsShipping} ecotrack={eco.enabled} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>التأكيد بالمكالمة الفائتة</CardTitle>
            <CardDescription>تطبيق NOVA Call على هاتفك يبلّغ المنصّة بكل مكالمة واردة؛ المكالمة من رقم طلب معلّق تؤكّده.</CardDescription>
          </CardHeader>
          <CardContent>
            <CallConfirmForm cfg={{ ...cfgView, pairingUrl: callPairingUrl(secret, process.env.APP_URL) }} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>آخر المكالمات الواردة</CardTitle>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا مكالمات مسجَّلة بعد.</p>
            ) : (
              <ul className="divide-y text-sm">
                {events.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                    <span>
                      <span dir="ltr" className="font-mono">
                        {e.phone}
                      </span>
                      {e.orderNumber ? (
                        <span className="text-muted-foreground">
                          {' '}
                          · {e.orderNumber}
                        </span>
                      ) : null}
                      {e.text ? <span className="block text-xs text-muted-foreground">{e.text}</span> : null}
                    </span>
                    <span className="text-xs">
                      <Badge variant={e.result === 'confirmed' ? 'success' : e.result === 'no_order' ? 'warning' : 'muted'}>{RESULT_AR[e.result] ?? e.result}</Badge>
                      <span className="block text-muted-foreground">{formatDateTime(e.createdAt)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
