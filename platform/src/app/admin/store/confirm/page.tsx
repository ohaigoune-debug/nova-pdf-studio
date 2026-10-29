import { Clock, Phone, PhoneCall, PhoneMissed } from 'lucide-react'
import Link from 'next/link'
import { CallConfirmForm } from '@/components/delivery/confirm-forms'
import { OrderEditPanel, OrderRowActions } from '@/components/domain/store-admin'
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
import { ecotrackOperatorStatus, ecotrackStatus } from '@/server/services/ecotrack.service'
import { ORDER_STATUS_AR } from '@/server/services/order-status.service'
import { listStreams } from '@/server/services/reference.service'
import { listConfirmationQueue, PAYMENT_AR, type PhoneHistory } from '@/server/services/store.service'

export const dynamic = 'force-dynamic'

const RESULT_AR: Record<string, string> = { phone_verified: 'أكّد هاتف حسابه', confirmed: 'أكّد طلبه', already_confirmed: 'مؤكَّد من قبل', no_order: 'بلا طلب', invalid_phone: 'رقم غير مفهوم', disabled: 'الخدمة متوقفة' }
const STATUS_VARIANT: Record<string, 'warning' | 'secondary' | 'muted'> = { PENDING: 'warning', NO_ANSWER: 'secondary', CALL_LATER: 'secondary' }

/** سجلّ الرقم في الطلبات السابقة: المرتجع (رفض الاستلام) تحذير أحمر قبل الإرسال لشركة التوصيل */
function PhoneHistoryBadges({ h }: { h: PhoneHistory }) {
  if (!h.returned && !h.delivered && h.cancelled < 2) return null
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {h.returned ? <Badge variant="destructive">⚠️ رفض الاستلام سابقاً ×{h.returned}</Badge> : null}
      {h.delivered ? <Badge variant="success">استلم سابقاً ×{h.delivered}</Badge> : null}
      {h.cancelled >= 2 ? <Badge variant="warning">طلبات ملغاة ×{h.cancelled}</Badge> : null}
    </span>
  )
}

/** طابور التأكيد الهاتفي (نسق NOVA): الطلبات التي تنتظر مكالمة، بأزرار «تأكيد / لا يردّ / لاحقاً / إلغاء»، وإعداد التأكيد بالمكالمة الفائتة */
export default async function ConfirmQueuePage() {
  const actor = await requirePageActor('SUPER_ADMIN', 'CONFIRMER')
  const db = await getDb()
  const worker = actor.role === 'CONFIRMER'
  const [queue, eco, streamRows] = await Promise.all([listConfirmationQueue(db, actor), worker ? ecotrackOperatorStatus(db, actor) : ecotrackStatus(db), listStreams(db)])
  const streamOptions = streamRows.map((r) => ({ id: r.id, name: r.nameAr }))
  const admin = worker ? null : await Promise.all([getCallConfirm(db), listCallEvents(db, actor, 30)])
  const cfg = admin?.[0]
  const events = admin?.[1] ?? []
  const cfgView = cfg ? { enabled: cfg.enabled, number: cfg.number, windowHours: cfg.windowHours, autoReject: cfg.autoReject, lastSeenAt: cfg.lastSeenAt, appVersion: cfg.appVersion, pairingUrl: callPairingUrl(cfg.secret, process.env.APP_URL) } : null
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
            <>
            {/* الهاتف: بطاقة لكل طلب بالبيانات والإجراءات نفسها (لا عمود ولا صلاحية جديدة) */}
            <ul className="space-y-3 md:hidden">
              {queue.map((o) => (
                <li key={o.id} className="rounded-lg border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {worker ? <span className="font-mono text-sm font-semibold" dir="ltr">{o.number}</span> : <Link href={`/store/orders/${o.id}`} className="font-mono text-sm font-semibold hover:underline" dir="ltr">{o.number}</Link>}
                      <span className="block text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</span>
                    </div>
                    <Badge variant={STATUS_VARIANT[o.status] ?? 'secondary'}>{ORDER_STATUS_AR[o.status as OrderStatus]}</Badge>
                  </div>
                  <div className="mt-3 space-y-1">
                    <p className="font-semibold">{o.customerName}</p>
                    <a href={tel(o.phone)} className="inline-flex min-h-11 items-center gap-1.5 text-base font-semibold text-primary hover:underline" dir="ltr">
                      <Phone className="size-4" /> {o.phone}
                    </a>
                    <p className="text-sm text-muted-foreground">{[o.wilayaName, o.commune].filter(Boolean).join(' · ') || '—'}</p>
                    <div className="flex flex-wrap gap-1">
                      {o.otpVerifiedAt ? <Badge variant="success">هاتف مؤكَّد بالرمز</Badge> : null}
                      <PhoneHistoryBadges h={o.history} />
                    </div>
                  </div>
                  <p className="mt-3 text-sm">{o.itemsText || '—'}</p>
                  {o.note ? <p className="text-sm text-muted-foreground">ملاحظة: {o.note}</p> : null}
                  <p className="mt-2 text-sm text-muted-foreground">
                    {o.totalDzd} دج · {PAYMENT_AR[o.paymentMethod as keyof typeof PAYMENT_AR]} · المحاولات {o.confirmAttempts}
                    {o.lastCallAt ? ` · آخر اتصال ${formatDateTime(o.lastCallAt)}` : ''}
                  </p>
                  {o.streamName ? <p className="text-sm text-muted-foreground">الشعبة: {o.streamName}</p> : null}
                  <div className="mt-3">
                    <OrderRowActions id={o.id} status={o.status} needsShipping={o.needsShipping} ecotrack={eco.enabled} confirmer={worker} />
                  </div>
                  <OrderEditPanel id={o.id} status={o.status} trackingId={o.deliveryTrackingId} streamId={o.streamId} subtotalDzd={o.subtotalDzd} shippingDzd={o.shippingDzd} streams={streamOptions} />
                </li>
              ))}
            </ul>
            <div className="hidden md:block">
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
                      {worker ? <span className="font-mono text-xs font-semibold" dir="ltr">{o.number}</span> : <Link href={`/store/orders/${o.id}`} className="font-mono text-xs font-semibold hover:underline" dir="ltr">{o.number}</Link>}
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
                      <PhoneHistoryBadges h={o.history} />
                    </TableCell>
                    <TableCell className="max-w-[260px] text-xs">
                      <span className="line-clamp-2">{o.itemsText || '—'}</span>
                      {o.streamName ? <span className="block text-muted-foreground">الشعبة: {o.streamName}</span> : null}
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
                      <OrderRowActions id={o.id} status={o.status} needsShipping={o.needsShipping} ecotrack={eco.enabled} confirmer={worker} />
                      <OrderEditPanel id={o.id} status={o.status} trackingId={o.deliveryTrackingId} streamId={o.streamId} subtotalDzd={o.subtotalDzd} shippingDzd={o.shippingDzd} streams={streamOptions} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {cfgView ? <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>التأكيد بالمكالمة الفائتة</CardTitle>
            <CardDescription>تطبيق NOVA Call على هاتفك يبلّغ المنصّة بكل مكالمة واردة؛ المكالمة من رقم طلب معلّق تؤكّده.</CardDescription>
          </CardHeader>
          <CardContent>
            <CallConfirmForm cfg={cfgView} />
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
      </div> : null}
    </div>
  )
}
