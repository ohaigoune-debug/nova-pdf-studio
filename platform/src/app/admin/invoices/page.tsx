import { FilePlus2, GraduationCap, Receipt, Settings, Users, Wallet } from 'lucide-react'
import Link from 'next/link'
import { IssueMissingInvoices } from '@/components/invoices/issue-missing'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { EmptyState, PageHeader, StatCard } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PAYMENT_METHOD_AR } from '@/lib/invoice-labels'
import { formatDate } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { invoiceSummary, listInvoices } from '@/server/services/invoices.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'الفواتير' }

type Q = { q?: string; month?: string; status?: string }

const dzd = (n: number) => `${n.toLocaleString('fr-DZ').replace(/ | /g, ' ')} دج`
const thisMonth = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7)

/**
 * /admin/invoices — الفواتير (قرار المالك 16 نوفمبر 2026): التلاميذ المسجَّلون وعددهم، المداخيل، وكل فاتورة
 * بالاسم والهاتف ورمز الحساب ورقمها. تصدر تلقائيًا عند تسليم الطلب، ويدويًا من «فاتورة يدوية».
 */
export default async function AdminInvoicesPage({ searchParams }: { searchParams: Promise<Q> }) {
  const actor = await requirePageActor('SUPER_ADMIN')
  const sp = await searchParams
  const month = sp.month === 'all' ? null : /^\d{4}-\d{2}$/.test(sp.month ?? '') ? sp.month! : thisMonth()
  const status = sp.status === 'ISSUED' || sp.status === 'CANCELLED' ? sp.status : null
  const db = await getDb()
  const [summary, rows] = await Promise.all([invoiceSummary(db, actor, month), listInvoices(db, actor, { q: sp.q, month, status })])
  const period = month ? new Intl.DateTimeFormat('ar-DZ-u-nu-latn', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-15T00:00:00Z`)) : 'كل الفترات'
  return (
    <div className="space-y-6">
      <PageHeader
        title="الفواتير"
        description="تصدر الفاتورة تلقائيًا عند تسليم الطلب (نقدًا أو بالبطاقة)، ويراها التلميذ ويحمّلها من «حسابي ← فواتيري». الإرجاع يُلغيها ويبقى رقمها."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/admin/invoices/new">
                <FilePlus2 className="size-4" /> فاتورة يدوية
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/students">
                <GraduationCap className="size-4" /> حسب الدورة
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/invoices/settings">
                <Settings className="size-4" /> بيانات الفاتورة
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="التلاميذ المسجَّلون" value={summary.registeredStudents} icon={Users} />
        <StatCard label="لهم دورة سارية" value={summary.studentsWithActiveCourse} icon={GraduationCap} />
        <StatCard label="الفواتير" value={summary.invoices} hint={`${period}${summary.cancelled ? ` · و${summary.cancelled} ملغاة` : ''}`} icon={Receipt} />
        <StatCard label="المداخيل" value={dzd(summary.revenueDzd)} hint={period} icon={Wallet} tone="success" />
      </div>

      {summary.missing > 0 ? <IssueMissingInvoices missing={summary.missing} /> : null}

      <form action="/admin/invoices" className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-[1fr_11rem_10rem_auto]">
        <Input name="q" defaultValue={sp.q ?? ''} placeholder="ابحث: رقم الفاتورة، الاسم، الهاتف، رمز الحساب" dir="auto" aria-label="بحث" />
        <Input type="month" name="month" defaultValue={month ?? ''} aria-label="الشهر" />
        <Select name="status" defaultValue={status ?? ''} aria-label="الحالة">
          <option value="">كل الحالات</option>
          <option value="ISSUED">صادرة</option>
          <option value="CANCELLED">ملغاة</option>
        </Select>
        <div className="flex gap-2">
          <Button type="submit" variant="outline">
            تصفية
          </Button>
          <Button asChild variant="ghost">
            <Link href="/admin/invoices?month=all">كل الفترات</Link>
          </Button>
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState icon={Receipt} title="لا فواتير بهذه المرشّحات" description="تظهر هنا الفواتير فور تسليم الطلبات، أو أنشئ فاتورة يدوية." />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الرقم</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>الزبون</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead>رمز الحساب</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>الدفع</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/print/invoices/${r.id}`} className="font-mono font-semibold text-primary hover:underline" dir="ltr">
                      {r.number}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(r.issuedAt)}</TableCell>
                  <TableCell>{r.customerName}</TableCell>
                  <TableCell dir="ltr" className="whitespace-nowrap text-right">{r.customerPhone ?? '—'}</TableCell>
                  <TableCell className="font-mono" dir="ltr">{r.studentCode ?? '—'}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">{dzd(r.totalDzd)}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{PAYMENT_METHOD_AR[r.paymentMethod] ?? r.paymentMethod}</TableCell>
                  <TableCell>
                    {r.status === 'CANCELLED' ? <Badge variant="destructive">ملغاة</Badge> : <Badge variant="success">صادرة</Badge>}
                    {r.source === 'MANUAL' ? <Badge variant="muted" className="ms-1">يدوية</Badge> : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
