import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { InvoiceSettingsForm } from '@/components/invoices/invoice-settings-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { invoiceSettings } from '@/server/services/invoices.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'بيانات الفاتورة' }

export default async function InvoiceSettingsPage() {
  await requirePageActor('SUPER_ADMIN')
  const value = await invoiceSettings(await getDb())
  return (
    <div className="max-w-2xl space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/invoices">
          <ArrowRight className="size-4" /> الفواتير
        </Link>
      </Button>
      <PageHeader title="بيانات الفاتورة" description="ما يُطبع في كل فاتورة جديدة. الفواتير الصادرة تحتفظ ببياناتها كما كانت يوم إصدارها." />
      <Card>
        <CardContent className="pt-5 sm:pt-6">
          <InvoiceSettingsForm value={value} />
        </CardContent>
      </Card>
    </div>
  )
}
