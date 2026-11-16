import { Download, Receipt } from 'lucide-react'
import Link from 'next/link'
import { HubTabs } from '@/components/student/hub-tabs'
import { Badge } from '@/components/ui/badge'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { formatDate } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listMyInvoices } from '@/server/services/invoices.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'فواتيري' }

const dzd = (n: number) => `${n.toLocaleString('fr-DZ').replace(/ | /g, ' ')} دج`

/** «حسابي ← فواتيري»: فواتير التلميذ (أو التي اشتراها له وليّه) — تُفتح للطباعة أو الحفظ PDF */
export default async function StudentInvoicesPage() {
  const actor = await requirePageActor('STUDENT')
  const rows = await listMyInvoices(await getDb(), actor)
  return (
    <>
      <HubTabs hub="account" />
      <PageHeader title="فواتيري" description="تصدر الفاتورة عند استلام طلبك. افتحها لتطبعها أو تحفظها PDF." />
      {rows.length === 0 ? (
        <EmptyState icon={Receipt} title="لا فواتير بعد" description="تظهر هنا فاتورة كل طلب فور تسليمه." />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/print/invoices/${r.id}`} className="flex items-center gap-3 p-3 text-sm transition-colors hover:bg-muted/60">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Receipt className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{r.lines.map((l) => l.title).join('، ')}</span>
                  <span className="block text-xs text-muted-foreground">
                    <span dir="ltr" className="font-mono">{r.number}</span> · {formatDate(r.issuedAt)} · <span className="tabular-nums">{dzd(r.totalDzd)}</span>
                  </span>
                </span>
                {r.status === 'CANCELLED' ? <Badge variant="destructive">ملغاة</Badge> : null}
                <Download className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
