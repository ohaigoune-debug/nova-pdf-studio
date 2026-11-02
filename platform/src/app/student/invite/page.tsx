import { Gift, Users, Wallet } from 'lucide-react'
import { ReferralCodeBox, ShareCodeCard } from '@/components/partners/partners-client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, PageHeader, StatCard } from '@/components/ui/misc'
import { formatDate } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { INVITEE_STATUS_AR, studentInviteHome } from '@/server/services/referrals.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'ادعُ زميلك ورصيدي' }

const REWARD_AR: Record<string, string> = { REFERRER_CREDIT: 'دعوة زميل', WELCOME_CREDIT: 'هدية ترحيب', AFFILIATE_CASH: 'عمولة' }

/** «ادعُ زميلك»: كود التلميذ ورابطه، رصيده وتاريخ انتهائه، وزملاؤه المدعوّون */
export default async function StudentInvitePage() {
  const actor = await requirePageActor('STUDENT')
  const home = await studentInviteHome(await getDb(), actor)
  const { policy, balance } = home
  const shareText = home.code && home.link ? `سجّل في منصة مدرسة بكودي ${home.code} وتحصل على ${policy.welcomeCreditDzd} دج هدية في رصيدك بعد أول دورة:\n${home.link}` : ''
  return (
    <div className="space-y-6">
      <PageHeader title="ادعُ زميلك ورصيدي" description={`ادعُ زميلك: حين يستلم أول دورة، تحصل على ${policy.referrerCreditDzd} دج ويحصل هو على ${policy.welcomeCreditDzd} دج. الرصيد لشراء الدورات، صالح ${policy.creditMonths} شهرًا.`} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="رصيدي المتاح" value={`${balance.availableDzd} دج`} icon={Wallet} tone={balance.availableDzd > 0 ? 'success' : 'default'} hint={balance.nextExpiry ? `أقرب انتهاء: ${formatDate(balance.nextExpiry)}` : undefined} />
        <StatCard label="زملاء سجّلوا بكودي" value={home.invitees.length} icon={Users} />
        <StatCard label="اشتروا" value={home.invitees.filter((i) => i.status === 'BOUGHT').length} icon={Gift} />
      </div>
      {balance.availableDzd > 0 ? <Alert tone="success">يُخصم رصيدك من ثمن الدورة عند الطلب: اختر «استعمل رصيدي» في صفحة الشراء.</Alert> : null}
      <Card>
        <CardHeader>
          <CardTitle>كودي</CardTitle>
          <CardDescription>شارك الرابط مع زملائك. السعر لا يتغيّر لهم، والهدية رصيد بعد الاستلام.</CardDescription>
        </CardHeader>
        <CardContent>
          {home.code && home.link ? <ShareCodeCard code={home.code} link={home.link} shareText={shareText} /> : <p className="text-sm text-muted-foreground">{policy.enabled ? 'يظهر كودك بعد اشتراكك في أول دورة.' : 'برنامج الدعوة متوقف حاليًا.'}</p>}
        </CardContent>
      </Card>
      {home.canEnterCode ? <ReferralCodeBox source="PAGE" welcomeCreditDzd={policy.welcomeCreditDzd} /> : home.mine ? <p className="text-sm text-muted-foreground">سجّلت بالكود <span dir="ltr" className="font-mono font-semibold">{home.mine.code}</span>.</p> : null}
      {home.invitees.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">زملائي</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {home.invitees.map((i) => (
                <li key={i.referralId} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span>{i.name}</span>
                  <Badge variant={i.status === 'BOUGHT' ? 'success' : 'muted'}>{INVITEE_STATUS_AR[i.status]}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
      {balance.lots.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">حركة الرصيد</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {balance.lots.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    +{l.amountDzd} دج · {l.source === 'WELCOME' ? 'هدية ترحيب' : l.source === 'REFERRAL' ? 'دعوة زميل' : 'إضافة من الإدارة'}
                    <span className="block text-xs text-muted-foreground">{formatDate(l.createdAt)} — {l.expired ? 'انتهت صلاحيته' : `صالح حتى ${formatDate(l.expiresAt)}`}</span>
                  </span>
                  <span className="tabular-nums text-muted-foreground">الباقي {l.expired ? 0 : l.remainingDzd} دج</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
      {home.rewards.some((r) => r.status === 'REVERSED') ? <p className="text-xs text-muted-foreground">{home.rewards.filter((r) => r.status === 'REVERSED').map((r) => `${REWARD_AR[r.kind] ?? ''} ${r.amountDzd} دج أُلغيت (أُرجع الطلب)`).join(' · ')}</p> : null}
    </div>
  )
}
