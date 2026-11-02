import { asc } from 'drizzle-orm'
import { Gift, Inbox, Megaphone, Wallet } from 'lucide-react'
import Link from 'next/link'
import { AffiliateCreateForm, ApplicationActions, ReferralPolicyForm } from '@/components/partners/partners-client'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, PageHeader, StatCard } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { wilayas } from '@/server/db/schema'
import { PARTNER_KIND_AR, listAffiliates, listPartnerApplications, partnersOverview } from '@/server/services/affiliates.service'
import { referralPolicy } from '@/server/services/referrals.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'المسوّقون وطلبات الشراكة' }

/** المسوّقون بالعمولة، طلبات «كن شريكًا»، ودعوة الزملاء — للمشرف ومدير العمليات */
export default async function AffiliatesPage() {
  const actor = await requirePageActor('SUPER_ADMIN', 'MANAGER')
  const db = await getDb()
  const [items, apps, overview, policy, ws] = await Promise.all([
    listAffiliates(db, actor),
    listPartnerApplications(db, actor, 'NEW'),
    partnersOverview(db, actor),
    referralPolicy(db),
    db.select({ id: wilayas.id, code: wilayas.code, name: wilayas.nameAr }).from(wilayas).orderBy(asc(wilayas.code))
  ])
  const isAdmin = actor.role === 'SUPER_ADMIN'
  const due = items.reduce((s, a) => s + Math.max(0, a.money.dueDzd), 0)
  const wilayaOpts = ws.map((w) => ({ id: w.id, name: `${w.code} — ${w.name}` }))
  return (
    <div className="space-y-6">
      <PageHeader title="المسوّقون وطلبات الشراكة" description={`كل مسوّق له كود: ${policy.affiliateDefaultDzd} دج نقدًا عن كل تلميذ جديد يستلم أول دورة بكوده (افتراضيًّا). التلميذ يدعو زميله: ${policy.referrerCreditDzd} دج رصيدًا له و${policy.welcomeCreditDzd} دج لزميله.`} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatCard label="طلبات شراكة جديدة" value={overview.newApplications} icon={Inbox} tone={overview.newApplications ? 'warning' : 'default'} />
        <StatCard label="المسوّقون" value={items.length} icon={Megaphone} />
        <StatCard label="مستحق للمسوّقين الآن" value={`${due} دج`} icon={Wallet} tone={due > 0 ? 'warning' : 'default'} />
        <StatCard label="دعوات التلاميذ" value={`${overview.studentBought} / ${overview.studentInvited}`} hint={`اشتروا / سجّلوا · رصيد مُنح ${overview.creditGrantedDzd} دج`} icon={Gift} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>طلبات «كن شريكًا»</CardTitle>
          <CardDescription>راجع صفحة المسوّق وعدد متابعيه قبل القبول. القبول ينشئ الحساب ويعطيك رسالة واتساب جاهزة.</CardDescription>
        </CardHeader>
        <CardContent>
          {apps.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا طلبات جديدة.</p>
          ) : (
            <ul className="divide-y">
              {apps.map(({ a, wilaya }) => (
                <li key={a.id} className="space-y-2 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="muted">{PARTNER_KIND_AR[a.kind as keyof typeof PARTNER_KIND_AR]}</Badge>
                    <span className="font-semibold">{a.fullName}</span>
                    {a.orgName ? <span className="text-sm">— {a.orgName}</span> : null}
                    <a href={`https://wa.me/213${a.phone.slice(1)}`} target="_blank" rel="noopener noreferrer" dir="ltr" className="text-sm text-primary hover:underline">
                      {a.phone}
                    </a>
                    <span className="text-xs text-muted-foreground">{wilaya ?? ''} · {formatDateTime(a.createdAt)}</span>
                  </div>
                  {a.socialUrl ? (
                    <p className="text-sm">
                      <a href={/^https?:\/\//.test(a.socialUrl) ? a.socialUrl : `https://${a.socialUrl}`} target="_blank" rel="noopener noreferrer nofollow" dir="ltr" className="break-all text-primary hover:underline">
                        {a.socialUrl}
                      </a>
                      {a.followers != null ? <span className="ms-2 font-semibold tabular-nums">{a.followers} متابع</span> : null}
                    </p>
                  ) : null}
                  {a.subject ? <p className="text-sm">المادة: {a.subject}</p> : null}
                  {a.address ? <p className="text-sm text-muted-foreground">{a.address}</p> : null}
                  {a.message ? <p className="whitespace-pre-line text-sm text-muted-foreground">{a.message}</p> : null}
                  <ApplicationActions id={a.id} kind={a.kind as 'AFFILIATE' | 'POINT_OF_SALE' | 'TEACHER'} isAdmin={isAdmin} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>المسوّقون</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState icon={Megaphone} title="لا مسوّقين بعد" description="اقبل طلبًا من «كن شريكًا» أو أضف مسوّقًا من النموذج أدناه." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المسوّق</TableHead>
                    <TableHead>الكود</TableHead>
                    <TableHead>سجّلوا</TableHead>
                    <TableHead>اشتروا</TableHead>
                    <TableHead>المستحق الآن</TableHead>
                    <TableHead>دُفع</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <Link href={`/admin/affiliates/${a.id}`} className="font-semibold text-primary hover:underline">
                          {a.name}
                        </Link>
                        <span className="block text-xs text-muted-foreground">
                          {a.followers != null ? `${a.followers} متابع · ` : ''}
                          {a.commissionDzd} دج/تلميذ
                        </span>
                      </TableCell>
                      <TableCell dir="ltr" className="font-mono">
                        {a.code ?? '—'}
                      </TableCell>
                      <TableCell className="tabular-nums">{a.registered}</TableCell>
                      <TableCell className="tabular-nums">{a.buyers}</TableCell>
                      <TableCell className="tabular-nums font-bold">{a.money.dueDzd} دج</TableCell>
                      <TableCell className="tabular-nums">{a.money.paidDzd} دج</TableCell>
                      <TableCell>{a.status === 'ACTIVE' ? <Badge variant="success">مفعّل</Badge> : <Badge variant="muted">موقوف</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>مسوّق جديد</CardTitle>
          <CardDescription>يدخل برقم هاتفه وكلمة سر تظهر مرة واحدة. الكود حروف لاتينية وأرقام (4 إلى 16).</CardDescription>
        </CardHeader>
        <CardContent>
          <AffiliateCreateForm wilayas={wilayaOpts} isAdmin={isAdmin} defaultCommission={policy.affiliateDefaultDzd} />
        </CardContent>
      </Card>

      {isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>إعدادات البرنامج</CardTitle>
            <CardDescription>للمشرف وحده. السعر لا يتغيّر في أي قناة؛ هذه المبالغ مكافآت بعد الشراء.</CardDescription>
          </CardHeader>
          <CardContent>
            <ReferralPolicyForm policy={policy} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
