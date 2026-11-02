import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, PageHeader } from '@/components/ui/misc'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { GUIDDINI_DEFAULT_BASE, getGuiddiniView, paymentReturnUrl } from '@/server/lib/guiddini'
import { listRecentPaymentRejections, listRecentPayments } from '@/server/services/online-payment.service'
import { GuiddiniForm } from './form'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'الدفع الإلكتروني' }

const STATUS: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' }> = {
  PAID: { label: 'مدفوع', variant: 'success' },
  PENDING: { label: 'معلّق', variant: 'warning' },
  FAILED: { label: 'فشل', variant: 'destructive' },
  EXPIRED: { label: 'انتهت المهلة', variant: 'secondary' },
  MISMATCH: { label: 'مبلغ مختلف — راجعه', variant: 'destructive' }
}

export default async function PaymentSettingsPage() {
  await requirePageActor('SUPER_ADMIN')
  const db = await getDb()
  const [view, payments, rejections] = await Promise.all([getGuiddiniView(db), listRecentPayments(db, 30), listRecentPaymentRejections(db, 5)])
  const returnUrl = paymentReturnUrl()
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="الدفع الإلكتروني (eFawtara / SATIM)" description="الصق المفتاحين App Key (APP-…) وApp Secret (SEC-…) من بطاقة «CIB & Edahabia · Délégué» في eFawtara (Clés API & Rails)، احفظ، ثم «اختبر الاتصال». بعد التفعيل يظهر للتلميذ خيار «ادفع الآن» بجانب الدفع عند الاستلام، وتُفعَّل الدورة فور تأكّد الخادم من الدفع." />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">المفاتيح {view ? (view.enabled ? <Badge variant="success">مفعّل</Badge> : <Badge variant="secondary">محفوظ، غير مفعّل</Badge>) : <Badge variant="secondary">غير مضبوط</Badge>}</CardTitle>
        </CardHeader>
        <CardContent><GuiddiniForm view={view} defaultBase={GUIDDINI_DEFAULT_BASE} /></CardContent>
      </Card>
      <Alert tone="info" title="رابط العودة يُرسَل تلقائيًّا">
        يُرسَل مع كل طلب دفع، فلا حاجة لضبطه في لوحة eFawtara. يعود إليه التلميذ بعد صفحة SATIM (نجح الدفع أو فشل): <span dir="ltr" className="font-mono">{returnUrl}</span>
      </Alert>
      <Card>
        <CardHeader><CardTitle>آخر أسباب الرفض</CardTitle><CardDescription>ما أعادته البوابة حين رفضت إنشاء طلب دفع (آخر 5). الرمز 401 وحده يعني مفاتيح خاطئة؛ 403 (ACCESS_DENIED) رفض من SATIM لحساب التاجر.</CardDescription></CardHeader>
        <CardContent>
          {rejections.length === 0 ? <p className="text-sm text-muted-foreground">لا رفض مسجَّل.</p> : (
            <ul className="divide-y rounded-lg border text-sm">
              {rejections.map((r) => (
                <li key={r.id} className="space-y-1 p-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge variant="destructive"><span dir="ltr">{[r.httpStatus, r.code].filter((x) => x !== null).join(' ') || r.error || '—'}</span></Badge>
                      {r.title ? <span className="font-semibold" dir="auto">{r.title}</span> : null}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}{r.orderNumber ? <> · <span className="font-mono" dir="ltr">{r.orderNumber}</span></> : null}{r.amountDzd !== null ? <> · <span className="tabular-nums">{r.amountDzd} دج</span></> : null}</span>
                  </div>
                  {r.detail ? <p className="text-xs" dir="auto">{r.detail}</p> : null}
                  {r.meta !== null && !(Array.isArray(r.meta) && r.meta.length === 0) ? (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground">التفاصيل (meta)</summary>
                      <pre dir="ltr" className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 font-mono">{JSON.stringify(r.meta, null, 2)}</pre>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>آخر عمليات الدفع</CardTitle><CardDescription>المعلّقة تُفحص آليًّا كل بضع دقائق عند البوابة.</CardDescription></CardHeader>
        <CardContent>
          {payments.length === 0 ? <p className="text-sm text-muted-foreground">لا عمليات بعد.</p> : (
            <ul className="divide-y rounded-lg border text-sm">
              {payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-2.5">
                  <span><span className="font-mono text-xs" dir="ltr">{p.orderNumber}</span> · {p.customerName} · <span className="tabular-nums">{p.amountDzd} دج</span></span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {formatDateTime(p.paidAt ?? p.createdAt)}
                    {p.status === 'PAID' && p.receiptUrl ? <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">الإيصال</a> : null}
                    {p.status !== 'PAID' && p.gatewayStatus ? <span dir="ltr" className="font-mono">{p.gatewayStatus}</span> : null}
                    <Badge variant={STATUS[p.status]?.variant ?? 'secondary'}>{STATUS[p.status]?.label ?? p.status}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
