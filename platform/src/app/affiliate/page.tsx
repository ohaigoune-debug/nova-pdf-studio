import { Clock, Users, Wallet } from 'lucide-react'
import { RemindButton, ShareCodeCard } from '@/components/partners/partners-client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, StatCard } from '@/components/ui/misc'
import { formatDate } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { affiliateHome } from '@/server/services/affiliates.service'

export const metadata = { title: 'حساب المسوّق' }

const STATUS_VARIANT = { BOUGHT: 'success', ORDERED: 'warning', REGISTERED: 'muted', CANCELLED: 'muted', RETURNED: 'destructive', VOID: 'destructive' } as const

export default async function AffiliatePage() {
  const actor = await requirePageActor('AFFILIATE')
  const h = await affiliateHome(await getDb(), actor)
  const shareText = `سجّل في منصة مدرسة بكودي ${h.code}${h.welcomeCreditDzd ? ` وتحصل على ${h.welcomeCreditDzd} دج هدية في رصيدك بعد أول دورة` : ''}:\n${h.link}`
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">{actor.fullName}</h1>
        <p className="text-sm text-muted-foreground">
          {h.commissionDzd} دج عن كل تلميذ جديد يشتري أول دورة بكودك، تُحتسب عند استلامه وتُدفع لك بعد {h.holdDays} أيام.
        </p>
      </div>
      {h.status !== 'ACTIVE' ? <Alert tone="warning" title="كودك موقوف حاليًا">لا يُقبل به تلاميذ جدد. تواصل مع إدارة المنصة.</Alert> : null}
      <Card>
        <CardContent className="pt-5">
          <ShareCodeCard code={h.code} link={h.link} shareText={shareText} />
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="سجّلوا بكودك" value={h.registered} icon={Users} />
        <StatCard label="اشتروا" value={h.buyers} icon={Users} tone="success" />
        <StatCard label="قيد المهلة" value={`${h.money.holdingDzd} دج`} icon={Clock} />
        <StatCard label="المستحق لك الآن" value={`${h.money.dueDzd} دج`} icon={Wallet} tone={h.money.dueDzd > 0 ? 'success' : 'default'} hint={`دُفع لك ${h.money.paidDzd} دج`} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">زبائني</CardTitle>
        </CardHeader>
        <CardContent>
          {h.customers.length === 0 ? (
            <p className="text-sm text-muted-foreground">لم يسجّل أحد بكودك بعد. شارك رابطك في صفحتك.</p>
          ) : (
            <ul className="divide-y">
              {h.customers.map((c) => (
                <li key={c.referralId} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <span className="min-w-0">
                    <span className="block font-semibold">{c.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {c.phoneMasked ? <span dir="ltr">{c.phoneMasked}</span> : null} · سجّل {formatDate(c.createdAt)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant={STATUS_VARIANT[c.status]}>{c.statusAr}</Badge>
                    {c.canRemind ? <RemindButton referralId={c.referralId} /> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">«ذكّره» يرسل للتلميذ إشعارًا من المنصة (مرة كل 48 ساعة). لا تُعرض أرقام التلاميذ كاملة حفاظًا على خصوصيتهم.</p>
        </CardContent>
      </Card>
      {h.payouts.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ما استلمته</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {h.payouts.map((p) => (
                <li key={p.id} className="flex justify-between py-2">
                  <span>{formatDate(p.createdAt)}</span>
                  <span className="font-semibold tabular-nums">{p.amountDzd} دج</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
      <Alert tone="info" title="القواعد">
        السعر للتلميذ هو نفسه في كل مكان. تُحتسب العمولة عن التلميذ الجديد فقط وعند أول دورة يستلمها، وتسقط إن أرجع طلبه. التسجيل بأرقامك أو بأرقام عائلتك، أو الإعلان المضلّل، يُلغي العمولة ويوقف الكود.
      </Alert>
    </div>
  )
}
