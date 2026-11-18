import { and, asc, eq, isNull } from 'drizzle-orm'
import { ArrowRight, PackageCheck, ShoppingBag, Wallet } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AddMemberForm, CancelCodeButton, GenerateForForm, MemberActions, PaymentForm, PosForm, PosStatusButton, StockForm, UndoActivationButton } from '@/components/pos/pos-admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader, StatCard } from '@/components/ui/misc'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { courses, wilayas } from '@/server/db/schema'
import { isAppError } from '@/server/lib/errors'
import { formatPosCode, getPointOfSale, listPosCodes, listPosPayments, type PosCodeView } from '@/server/services/points-of-sale.service'

export const dynamic = 'force-dynamic'

/** حالة البيع كما تراها المكتبة: فُعّلت، محجوزة لرقم، كود لم يُستعمل، أُلغي/تُراجِع عنه */
function saleStatus(c: PosCodeView): { label: string; variant: 'success' | 'warning' | 'muted' | 'secondary' } {
  if (c.status === 'CANCELLED') return { label: c.soldVia === 'SMS' && c.usedAt ? 'تُراجِع عنه' : 'أُلغي', variant: 'muted' }
  if (c.status === 'USED') return { label: c.soldVia === 'SMS' ? 'فُعّلت برمز SMS' : 'فُعّلت بالكود', variant: 'success' }
  if (c.soldVia === 'SMS' && c.soldPhoneMasked) return { label: 'محجوزة لرقمه', variant: 'secondary' }
  return { label: 'كود لم يُستعمل', variant: 'warning' }
}

export default async function PointOfSalePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('SUPER_ADMIN', 'MANAGER')
  const { id } = await params
  const db = await getDb()
  let data: Awaited<ReturnType<typeof getPointOfSale>>
  try {
    data = await getPointOfSale(db, actor, id)
  } catch (e) {
    if (isAppError(e) && (e.code === 'NOT_FOUND' || e.code === 'VALIDATION')) notFound()
    throw e
  }
  const { pos, wilayaName, summary, members } = data
  const [codes, payments, ws, courseRows] = await Promise.all([
    listPosCodes(db, actor, pos.id, 200),
    listPosPayments(db, actor, pos.id),
    db.select({ id: wilayas.id, code: wilayas.code, name: wilayas.nameAr }).from(wilayas).orderBy(asc(wilayas.code)),
    db.select({ id: courses.id, title: courses.title }).from(courses).where(and(eq(courses.status, 'PUBLISHED'), isNull(courses.deletedAt))).orderBy(asc(courses.title))
  ])
  const courseOpts = courseRows.map((c) => ({ id: c.id, name: c.title }))
  const isAdmin = actor.role === 'SUPER_ADMIN'
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/points-of-sale">
          <ArrowRight className="size-4 rtl:rotate-0 ltr:rotate-180" /> كل نقاط البيع
        </Link>
      </Button>
      <PageHeader
        title={pos.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {wilayaName ?? 'بلا ولاية'}
            {pos.phone ? <span dir="ltr">{pos.phone}</span> : null}
            {pos.status === 'ACTIVE' ? <Badge variant="success">التوليد مفتوح</Badge> : <Badge variant="muted">التوليد مغلق</Badge>}
            <span>· العمولة {pos.commissionDzd} دج للباقة</span>
          </span>
        }
        actions={<PosStatusButton posId={pos.id} status={pos.status} />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="باقي عندها" value={summary.stock.reduce((a, s) => a + s.remaining, 0)} icon={PackageCheck} />
        <StatCard label="بيعت · فُعِّلت" value={`${summary.soldCount} · ${summary.activatedCount}`} icon={ShoppingBag} tone="success" />
        <StatCard label="عمولتها" value={`${summary.commissionDzd} دج`} />
        <StatCard label="المستحق عليها" value={`${summary.owedDzd} دج`} hint={`سدّدت ${summary.paidDzd} دج`} icon={Wallet} tone={summary.owedDzd > 0 ? 'warning' : 'default'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>الباقات</CardTitle>
            <CardDescription>المتبقي = ما أُرسل − ما بيع (الأكواد الملغاة لا تُحسب).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {summary.stock.length ? (
              <ul className="divide-y rounded-lg border text-sm">
                {summary.stock.map((s) => (
                  <li key={s.courseId} className="flex flex-wrap items-center justify-between gap-2 p-2.5">
                    <span>
                      <span className="font-semibold">{s.courseTitle}</span>
                      <span className="block text-xs text-muted-foreground tabular-nums">سعر الباقة {s.priceDzd} دج</span>
                    </span>
                    <span className="text-xs tabular-nums">
                      أُرسلت {s.sent} · بيعت {s.sold} · <strong className={s.remaining <= 0 ? 'text-destructive' : ''}>باقي {s.remaining}</strong>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <StockForm posId={pos.id} courses={courseOpts} />
            <div className="border-t pt-4">
              <GenerateForForm posId={pos.id} courses={summary.stock.map((s) => ({ id: s.courseId, name: s.courseTitle }))} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>حسابات النقطة</CardTitle>
            <CardDescription>تدخل بالهاتف وكلمة السر المولَّدة؛ أرسلها عبر واتساب.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {members.length ? (
              <ul className="divide-y rounded-lg border text-sm">
                {members.map((m) => (
                  <li key={m.userId} className="space-y-2 p-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <span className="font-semibold">{m.fullName}</span>{' '}
                        <span dir="ltr" className="text-xs text-muted-foreground">
                          {m.phone}
                        </span>
                      </span>
                      {m.status === 'ACTIVE' ? <Badge variant="success">نشط</Badge> : <Badge variant="muted">موقوف</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">آخر دخول: {m.lastLoginAt ? formatDateTime(m.lastLoginAt) : 'لم يدخل بعد'}</p>
                    <MemberActions posId={pos.id} userId={m.userId} active={m.status === 'ACTIVE'} />
                  </li>
                ))}
              </ul>
            ) : null}
            <AddMemberForm posId={pos.id} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>المال المستلَم</CardTitle>
          <CardDescription>كل قيد مسجَّل باسم من سجّله، ولا يُحذف.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PaymentForm posId={pos.id} owedDzd={summary.owedDzd} />
          {payments.length ? (
            <ul className="divide-y rounded-lg border text-sm">
              {payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-2.5">
                  <span className="font-semibold tabular-nums">{p.amountDzd} دج</span>
                  <span className="text-xs text-muted-foreground">
                    {p.note ? `${p.note} · ` : ''}
                    {formatDateTime(p.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">لا مبالغ مسجّلة بعد.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>المبيعات ({codes.length})</CardTitle>
          <CardDescription>كل بيع مسجَّل على النقطة: تفعيل برمز SMS، أو حجز لرقم بلا حساب، أو كود احتياطي يكتبه التلميذ في /claim.</CardDescription>
        </CardHeader>
        <CardContent>
          {codes.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا مبيعات بعد.</p>
          ) : (
            <ul className="divide-y">
              {codes.map((c) => {
                const st = saleStatus(c)
                return (
                  <li key={c.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-semibold">
                        {c.studentName ?? (c.soldPhoneMasked ? <span dir="ltr" className="font-mono">{c.soldPhoneMasked}</span> : c.code ? <span dir="ltr" className="font-mono">{formatPosCode(c.code)}</span> : '—')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.courseTitle} · {formatDateTime(c.usedAt ?? c.createdAt)}
                        {c.studentName && c.soldPhoneMasked ? (
                          <>
                            {' · '}
                            <span dir="ltr">{c.soldPhoneMasked}</span>
                          </>
                        ) : null}
                        {c.code && (c.studentName || c.soldPhoneMasked) ? (
                          <>
                            {' · كود '}
                            <span dir="ltr">{formatPosCode(c.code)}</span>
                          </>
                        ) : null}
                        {c.soldBy ? ` · ${c.soldBy}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={st.variant}>{st.label}</Badge>
                      {c.undoable ? <UndoActivationButton codeId={c.id} /> : null}
                      {c.cancellable ? <CancelCodeButton codeId={c.id} /> : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>بيانات النقطة</CardTitle>
        </CardHeader>
        <CardContent>
          <PosForm
            wilayas={ws.map((w) => ({ id: w.id, name: `${w.code} — ${w.name}` }))}
            isAdmin={isAdmin}
            values={{ id: pos.id, name: pos.name, wilayaId: pos.wilayaId, address: pos.address, phone: pos.phone, listed: pos.listed, commissionDzd: pos.commissionDzd, lowStockAlert: pos.lowStockAlert, note: pos.note }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
