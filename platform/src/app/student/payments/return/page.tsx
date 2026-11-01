import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { paymentForReturn, verifyPayment } from '@/server/services/online-payment.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'نتيجة الدفع' }

type Q = { order_number?: string; orderNumber?: string; id?: string }

/**
 * صفحة العودة من SATIM (تُضبط في لوحة Guiddini كرابط النجاح والفشل معًا).
 * لا تثق بما في الرابط: تسأل البوابة عن الحالة الحقيقية ثم تعرضها. التحديث يعيد السؤال.
 */
export default async function PaymentReturnPage({ searchParams }: { searchParams: Promise<Q> }) {
  const actor = await requirePageActor('STUDENT')
  const q = await searchParams
  const ref = (q.order_number ?? q.orderNumber ?? q.id ?? '').trim().slice(0, 80) || null
  const db = await getDb()
  const p = await paymentForReturn(db, actor.userId, ref)
  const out = p ? await verifyPayment(db, p.id).catch(() => ({ status: p.status })) : null
  const status = out?.status ?? null
  const view =
    status === 'PAID'
      ? { icon: CheckCircle2, tone: 'text-success', title: 'تمّ الدفع وفُعّلت الدورة', body: 'يمكنك الدخول إلى دورتك الآن. ويُشحن الكتاب إن كان معها.' }
      : status === 'PENDING'
        ? { icon: Clock, tone: 'text-warning', title: 'الدفع قيد التأكيد', body: 'لم يصلنا تأكيد البنك بعد. حدّث الصفحة بعد دقيقة؛ وإن تمّ الدفع تُفعَّل الدورة تلقائيًّا ولو أغلقت الصفحة.' }
        : status === 'MISMATCH'
          ? { icon: Clock, tone: 'text-warning', title: 'الدفع قيد المراجعة', body: 'وصلنا دفع بمبلغ مختلف عن المطلوب؛ تراجعه الإدارة وتتصل بك.' }
          : { icon: XCircle, tone: 'text-destructive', title: status ? 'لم يتمّ الدفع' : 'لم نجد عملية دفع', body: 'لم يُقتطع شيء مقابل هذا الطلب. يمكنك المحاولة من جديد أو اختيار الدفع عند الاستلام.' }
  const Icon = view.icon
  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 pt-8 text-center">
          <Icon className={`size-14 ${view.tone}`} />
          <h1 className="text-xl font-bold">{view.title}</h1>
          <p className="text-sm text-muted-foreground">{view.body}</p>
          {p ? <p className="text-xs text-muted-foreground tabular-nums">{p.amountDzd} دج</p> : null}
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {status === 'PAID' ? (
              <Button asChild><Link href="/student/courses">دوراتي</Link></Button>
            ) : status === 'PENDING' ? (
              <Button asChild><Link href={`/student/payments/return${ref ? `?order_number=${encodeURIComponent(ref)}` : ''}`}>تحديث</Link></Button>
            ) : (
              <Button asChild><Link href="/student/courses/catalog">العودة إلى الدورات</Link></Button>
            )}
            <Button asChild variant="outline"><Link href="/student/courses/orders">طلباتي</Link></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
