import { Headphones, MessageSquare, PhoneCall, PhoneIncoming, Settings, UserRoundCheck } from 'lucide-react'
import Link from 'next/link'
import { HumanTaskActions, InboundActions } from '@/components/call-center/call-center-forms'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, PageHeader, StatCard } from '@/components/ui/misc'
import { RULE_AR, type CcRule } from '@/lib/call-center'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { callCenterOverview, getCallCenterConfig, listHumanQueue, listInbound, listRecentTasks } from '@/server/services/call-center.service'

export const dynamic = 'force-dynamic'

const TARGET_AR: Record<string, string> = { GUARDIAN: 'الولي', STUDENT: 'التلميذ', ORDER: 'هاتف الطلب', CALLER: 'المتصل' }
const STATUS_AR: Record<string, string> = { QUEUED: 'في الطابور', DISPATCHED: 'عند الجهاز', DONE: 'انتهت', FAILED: 'لم تنجح', CANCELLED: 'أُلغيت' }
const OUTCOME_AR: Record<string, string> = { ANSWERED: 'ردّ', NO_ANSWER: 'لم يردّ', BUSY: 'مشغول', REJECTED: 'رفض', FAILED: 'فشل', SENT: 'أُرسلت', SIMULATED: 'محاكاة' }
const MODE_AR = { off: 'متوقف', test: 'تجربة', live: 'تشغيل حقيقي' } as const

/** لوحة الموظف الواحد: ما ينتظره، والمكالمات الواردة، وآخر ما فعلته الآلة */
export default async function CallCenterPage() {
  const actor = await requirePageActor('SUPER_ADMIN', 'CONFIRMER')
  const db = await getDb()
  const [overview, human, inbound, recent, cfg] = await Promise.all([callCenterOverview(db, actor), listHumanQueue(db, actor), listInbound(db, actor, 'NEW'), listRecentTasks(db, actor, 40), getCallCenterConfig(db)])
  return (
    <div className="space-y-6">
      <PageHeader
        title="مركز الاتصال"
        description="الآلة ترسل الرسائل وتتصل؛ هنا ما يحتاجك أنت: اختيارات تُنفَّذ عند 48HR، ومن لم يردّ بعد كل المحاولات، والمكالمات الواردة."
        actions={
          actor.role === 'SUPER_ADMIN' ? (
            <Button asChild variant="outline">
              <Link href="/admin/callcenter/settings">
                <Settings className="size-4" /> الإعدادات
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant={overview.mode === 'live' ? 'success' : overview.mode === 'test' ? 'warning' : 'muted'}>الوضع: {MODE_AR[overview.mode]}</Badge>
        <Badge variant={overview.agentOnline ? 'success' : 'muted'}>
          <Headphones className="me-1 size-3.5" />
          {overview.agentOnline ? 'الجهاز متصل' : overview.agentLastSeenAt ? `الجهاز غير متصل منذ ${formatDateTime(overview.agentLastSeenAt)}` : 'الجهاز لم يتصل بعد'}
        </Badge>
        {overview.today.perSim.map((s) => (
          <Badge key={s.slot} variant={s.calls >= s.cap ? 'destructive' : 'secondary'}>
            شريحة {s.slot}: {s.calls}/{s.cap}
          </Badge>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="ينتظرك" value={overview.needsHuman} icon={UserRoundCheck} tone={overview.needsHuman ? 'warning' : 'default'} />
        <StatCard label="مكالمات واردة جديدة" value={overview.inboundNew} icon={PhoneIncoming} tone={overview.inboundNew ? 'warning' : 'default'} />
        <StatCard label="مكالمات في الطابور" value={overview.queuedCalls} icon={PhoneCall} hint={`اليوم: ${overview.today.calls} مكالمة · ردّ ${overview.today.answered}`} />
        <StatCard label="رسائل في الطابور" value={overview.queuedSms} icon={MessageSquare} hint={`أُرسلت اليوم: ${overview.today.sms}`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ينتظرك ({human.length})</CardTitle>
          <CardDescription>الأقدم أولًا. نفّذ ما يطلبه الزبون (عند 48HR أو بمكالمة)، ثم اضغط «تمّ».</CardDescription>
        </CardHeader>
        <CardContent>
          {human.length === 0 ? (
            <EmptyState icon={UserRoundCheck} title="لا شيء ينتظرك" description="كل ما وصل عالجته الآلة أو عالجته أنت." />
          ) : (
            <ul className="divide-y">
              {human.map((h) => (
                <li key={h.id} className="space-y-2 py-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="warning">{RULE_AR[h.rule as CcRule] ?? h.rule}</Badge>
                    {h.orderId ? (
                      <Link href={`/store/orders/${h.orderId}`} className="font-mono text-xs hover:underline" dir="ltr">
                        {h.orderNumber}
                      </Link>
                    ) : null}
                    <span className="font-semibold">{h.customerName ?? ''}</span>
                    <a href={`tel:${h.phone}`} className="font-mono text-xs text-primary hover:underline" dir="ltr">
                      {h.phone}
                    </a>
                    <span className="text-xs text-muted-foreground">({TARGET_AR[h.target] ?? h.target})</span>
                    {h.deliveryType ? <Badge variant="muted">{h.deliveryType === 'DESK' ? 'مكتب' : 'منزل'}</Badge> : null}
                    {h.trackingId ? (
                      <span className="font-mono text-[11px] text-muted-foreground" dir="ltr">
                        {h.trackingId}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm font-semibold">{h.humanReason}</p>
                  {h.context ? <p className="text-xs text-muted-foreground">السبب: {h.context}</p> : null}
                  <HumanTaskActions id={h.id} canRetry={h.kind === 'CALL'} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>المكالمات الواردة ({inbound.length})</CardTitle>
          <CardDescription>من اتصل بالرقم الرسمي واختار من القائمة وترك رسالة بعد الصفارة.</CardDescription>
        </CardHeader>
        <CardContent>
          {inbound.length === 0 ? (
            <EmptyState icon={PhoneIncoming} title="لا مكالمات واردة جديدة" description="حين يتصل تلميذ أو ولي بالرقم الرسمي تظهر مكالمته هنا." />
          ) : (
            <ul className="divide-y">
              {inbound.map((c) => (
                <li key={c.id} className="space-y-2 py-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="secondary">{c.choice ? `${c.choice} · ${cfg.inboundMenu[c.choice] ?? 'خيار'}` : 'بلا اختيار'}</Badge>
                    <a href={`tel:${c.phone}`} className="font-mono text-xs text-primary hover:underline" dir="ltr">
                      {c.phone}
                    </a>
                    {c.customerName ? <span className="font-semibold">{c.customerName}</span> : <span className="text-xs text-muted-foreground">رقم غير معروف</span>}
                    {c.orderId ? (
                      <Link href={`/store/orders/${c.orderId}`} className="font-mono text-xs hover:underline" dir="ltr">
                        {c.orderNumber}
                      </Link>
                    ) : null}
                    <span className="text-xs text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                  </div>
                  {c.hasRecording ? <audio controls preload="none" src={`/api/v1/callcenter/recordings/${c.id}`} className="w-full max-w-md" /> : <p className="text-xs text-muted-foreground">لم يترك رسالة صوتية.</p>}
                  <InboundActions id={c.id} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>آخر ما فعلته الآلة</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <EmptyState icon={PhoneCall} title="لا شيء بعد" description="حين يُشغَّل مركز الاتصال تظهر هنا الرسائل والمكالمات." />
          ) : (
            <ul className="divide-y text-sm">
              {recent.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-2 py-2">
                  <Badge variant={t.kind === 'CALL' ? 'default' : 'secondary'}>{RULE_AR[t.rule as CcRule] ?? t.rule}</Badge>
                  <span className="font-mono text-xs" dir="ltr">
                    {t.phone}
                  </span>
                  <span className="text-xs text-muted-foreground">{TARGET_AR[t.target] ?? t.target}</span>
                  <Badge variant={t.status === 'DONE' ? 'success' : t.status === 'FAILED' ? 'destructive' : 'muted'}>{STATUS_AR[t.status] ?? t.status}</Badge>
                  {t.outcome ? <span className="text-xs">{OUTCOME_AR[t.outcome] ?? t.outcome}{t.digit ? ` · ضغط ${t.digit}` : ''}</span> : null}
                  {t.simulated ? <Badge variant="warning">محاكاة</Badge> : null}
                  {t.simSlot ? <span className="text-xs text-muted-foreground">شريحة {t.simSlot}</span> : null}
                  <span className="text-xs text-muted-foreground">
                    {t.attempts ? `محاولة ${t.attempts} · ` : ''}
                    {formatDateTime(t.status === 'QUEUED' ? t.runAfter : t.updatedAt)}
                  </span>
                  {t.orderNumber ? (
                    <span className="font-mono text-[11px] text-muted-foreground" dir="ltr">
                      {t.orderNumber}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
