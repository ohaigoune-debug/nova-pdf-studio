import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PrintButton } from '@/components/domain/print-button'
import { InvoiceSheet } from '@/components/domain/invoice-sheet'
import { CancelInvoiceForm } from '@/components/invoices/cancel-invoice-form'
import { Button } from '@/components/ui/button'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { getInvoiceForViewer } from '@/server/services/invoices.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'فاتورة' }

/** الفاتورة A4: يطبعها أو يحفظها PDF المشرفُ (كل الفواتير) والتلميذُ (فواتيره فقط) */
export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor()
  const { id } = await params
  let invoice
  try {
    invoice = await getInvoiceForViewer(await getDb(), actor, id)
  } catch (e) {
    if (isAppError(e)) notFound()
    throw e
  }
  const admin = actor.role === 'SUPER_ADMIN'
  return (
    <>
      <div className="no-print mx-auto flex w-[210mm] max-w-full flex-wrap items-center justify-between gap-2 px-2 pt-4">
        <Button asChild variant="ghost">
          <Link href={admin ? '/admin/invoices' : '/student/invoices'}>
            <ArrowRight className="size-4" /> {admin ? 'الفواتير' : 'فواتيري'}
          </Link>
        </Button>
        <PrintButton />
      </div>
      <InvoiceSheet invoice={invoice} />
      {admin && invoice.status === 'ISSUED' ? (
        <div className="no-print mx-auto mb-10 w-[210mm] max-w-full px-2">
          <CancelInvoiceForm id={invoice.id} />
        </div>
      ) : null}
    </>
  )
}
