import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { ManualInvoiceForm } from '@/components/invoices/manual-invoice-form'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'فاتورة يدوية' }

/** فاتورة يدوية للحالات الخاصة (نقطة بيع، دفع مباشر، كود…): الرقم التالي في التسلسل نفسه */
export default async function NewInvoicePage() {
  await requirePageActor('SUPER_ADMIN')
  return (
    <div className="max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/invoices">
          <ArrowRight className="size-4" /> الفواتير
        </Link>
      </Button>
      <PageHeader title="فاتورة يدوية" description="للحالات التي لا يمرّ فيها البيع بطلب في المنصة. تأخذ الرقم التالي في التسلسل نفسه، وتفتح جاهزة للطباعة أو الحفظ PDF." />
      <ManualInvoiceForm />
    </div>
  )
}
