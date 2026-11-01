import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, PageHeader } from '@/components/ui/misc'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { GUIDDINI_DEFAULT_BASE, getGuiddiniView } from '@/server/lib/guiddini'
import { listRecentPayments } from '@/server/services/online-payment.service'
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
  const [view, payments] = await Promise.all([getGuiddiniView(db), listRecentPayments(db, 30)])
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="الدفع الإلكتروني (Guiddini / SATIM)" description="الصق المفتاحين من لوحة Guiddini، احفظ، ثم «اختبر الاتصال». بعد التفعيل يظهر للتلميذ خيار «ادفع الآن» بجانب الدفع عند الاستلام، وتُفعَّل الدورة فور تأكّد الخادم من الدفع." />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">المفاتيح {view ? (view.enabled ? <Badge variant="success">مفعّل</Badge> : <Badge variant="secondary">محفوظ، غير مفعّل</Badge>) : <Badge variant="secondary">غير مضبوط</Badge>}</CardTitle>
        </CardHeader>
        <CardContent><GuiddiniForm view={view} defaultBase={GUIDDINI_DEFAULT_BASE} /></CardContent>
      </Card>
      <Alert tone="info" title="في لوحة Guiddini">
        اجعل رابط العودة بعد الدفع (النجاح والفشل معًا): <span dir="ltr" className="font-mono">https://madrasadz.com/student/payments/return</span>
      </Alert>
      <Card>
        <CardHeader><CardTitle>آخر عمليات الدفع</CardTitle><CardDescription>المعلّقة تُفحص آليًّا كل بضع دقائق عند البوابة.</CardDescription></CardHeader>
        <CardContent>
          {payments.length === 0 ? <p className="text-sm text-muted-foreground">لا عمليات بعد.</p> : (
            <ul className="divide-y rounded-lg border text-sm">
              {payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-2.5">
                  <span><span className="font-mono text-xs" dir="ltr">{p.orderNumber}</span> · {p.customerName} · <span className="tabular-nums">{p.amountDzd} دج</span></span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">{formatDateTime(p.paidAt ?? p.createdAt)} <Badge variant={STATUS[p.status]?.variant ?? 'secondary'}>{STATUS[p.status]?.label ?? p.status}</Badge></span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
