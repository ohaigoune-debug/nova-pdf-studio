import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { InvoiceSheet } from '@/components/domain/invoice-sheet'
import { PrintButton } from '@/components/domain/print-button'
import { Button } from '@/components/ui/button'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { COURSE_INVOICES_PRINT_MAX, courseInvoicesForPrint, parseRosterFilters } from '@/server/services/course-roster.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'فواتير الدورة' }

/** كل فواتير طلبات دورة (بالتصفية المختارة) في مستند واحد: فاتورة في كل صفحة A4، للطباعة أو الحفظ PDF */
export default async function CourseInvoicesPrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePageActor('SUPER_ADMIN')
  const [{ id }, sp] = await Promise.all([params, searchParams])
  let data
  try {
    data = await courseInvoicesForPrint(await getDb(), actor, { courseId: id, ...parseRosterFilters(sp) })
  } catch (e) {
    if (isAppError(e)) notFound()
    throw e
  }
  const qrs = await Promise.all(
    data.invoices.map((inv) => (inv.paymentReceiptUrl ? QRCode.toString(inv.paymentReceiptUrl, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }) : Promise.resolve(null)))
  )
  const back = `/admin/students?${new URLSearchParams(Object.entries({ course: id, ...sp }).filter(([, v]) => v) as [string, string][]).toString()}`
  return (
    <>
      <div className="no-print mx-auto w-[210mm] max-w-full space-y-2 px-2 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button asChild variant="ghost">
            <Link href={back}>
              <ArrowRight className="size-4" /> التلاميذ
            </Link>
          </Button>
          <PrintButton />
        </div>
        <p className="text-sm">
          <b>{data.course.title}</b> — {data.invoices.length} فاتورة
          {data.more ? ` (أول ${COURSE_INVOICES_PRINT_MAX}؛ اختر شهرًا في صفحة التلاميذ لطباعة البقية)` : ''}. كل فاتورة في صفحة.
        </p>
      </div>
      {data.invoices.length === 0 ? (
        <p className="mx-auto my-10 w-[210mm] max-w-full px-2 text-center">لا فواتير لهذه التصفية.</p>
      ) : (
        data.invoices.map((inv, i) => (
          <div key={inv.id} className={i < data.invoices.length - 1 ? 'break-after-page' : undefined}>
            <InvoiceSheet invoice={inv} receiptQrSvg={qrs[i]} />
          </div>
        ))
      )}
    </>
  )
}
