import { BookOpen, Download, FileText, GraduationCap, Printer, Receipt, Store, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { EmptyState, StatCard } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/utils'
import { ENROLLMENT_SOURCES, type EnrollmentSource } from '@/server/db/schema/enums'
import { ROSTER_PAGE_MAX, ROSTER_STATUS_AR, ROSTER_STATUSES, type RosterFilters, type RosterRow, type RosterStats } from '@/server/services/course-roster.service'
import { COURSE_STATUS_AR, ENROLLMENT_SOURCE_AR } from '@/server/services/courses.service'

const dzd = (n: number) => `${n.toLocaleString('fr-DZ').replace(/[  ]/g, ' ')} دج`
const STATUS_VARIANT = { ACTIVE: 'success', EXPIRED: 'muted', REVOKED: 'destructive' } as const

function qs(courseId: string, f: Omit<RosterFilters, 'courseId'>): string {
  const p = new URLSearchParams({ course: courseId })
  if (f.status && f.status !== 'ACTIVE') p.set('status', f.status)
  if (f.source) p.set('source', f.source)
  if (f.month) p.set('month', f.month)
  if (f.q) p.set('q', f.q)
  return p.toString()
}

function Breakdown({ title, items }: { title: string; items: { name: string; n: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.n))
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 text-sm font-bold">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">لا أحد بعد.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.name} className="text-sm">
              <div className="flex justify-between gap-2">
                <span className="truncate">{i.name}</span>
                <span className="tabular font-semibold">{i.n}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-muted">
                <div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.max(4, (i.n / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function InvoiceCell({ r }: { r: RosterRow }) {
  if (r.invoiceId && r.invoiceNumber) {
    return (
      <Link href={`/print/invoices/${r.invoiceId}`} className="font-mono text-xs font-semibold text-primary hover:underline" dir="ltr">
        {r.invoiceNumber}
        {r.invoiceCancelled ? <span className="ms-1 font-sans text-destructive">(ملغاة)</span> : null}
      </Link>
    )
  }
  if (r.posName) return <span className="text-xs text-muted-foreground">نقطة بيع{r.posPriceDzd ? ` · ${dzd(r.posPriceDzd)}` : ''}</span>
  return <span className="text-xs text-muted-foreground">—</span>
}

/** تلاميذ دورة واحدة في صفحة «التلاميذ»: العدد، الحسابات، التصدير والطباعة، والقائمة */
export function CourseRosterView({
  course,
  stats,
  rows,
  matched,
  filters
}: {
  course: { id: string; title: string; status: string }
  stats: RosterStats
  rows: RosterRow[]
  matched: number
  filters: Omit<RosterFilters, 'courseId'>
}) {
  const query = qs(course.id, filters)
  const periodLabel = filters.month
    ? new Intl.DateTimeFormat('ar-DZ-u-nu-latn', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${filters.month}-15T00:00:00Z`))
    : null
  const filtered = Boolean(filters.source || filters.month || filters.q || (filters.status && filters.status !== 'ACTIVE'))
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold leading-snug">{course.title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {COURSE_STATUS_AR[course.status as keyof typeof COURSE_STATUS_AR] ?? course.status}
            {periodLabel ? ` · المسجَّلون في ${periodLabel}` : ' · كل الفترات'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Button asChild>
            <a href={`/admin/students/roster.csv?${query}`}>
              <Download className="size-4" /> تنزيل Excel
            </a>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/print/courses/${course.id}/roster?${query}`}>
              <Printer className="size-4" /> طباعة الكشف
            </Link>
          </Button>
          {stats.invoiced.count > 0 ? (
            <Button asChild variant="outline">
              <Link href={`/print/courses/${course.id}/invoices?${query}`}>
                <FileText className="size-4" /> طباعة فواتيرها ({stats.invoiced.count})
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="ghost">
            <Link href={`/admin/courses/${course.id}`}>
              <BookOpen className="size-4" /> صفحة الدورة
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="مسجَّلون الآن" value={stats.active} hint={`من ${stats.total}${periodLabel ? ' في هذا الشهر' : ' منذ البداية'} · انتهى ${stats.expired} · أُلغي ${stats.revoked}`} icon={GraduationCap} tone="success" />
        <StatCard label={periodLabel ? `جدد في ${periodLabel}` : 'جدد هذا الشهر'} value={stats.newInMonth} icon={UserPlus} />
        <StatCard label="مداخيل الفواتير" value={dzd(stats.invoiced.totalDzd)} hint={`${stats.invoiced.count} فاتورة طلب (تشمل الكتاب والتوصيل إن وُجدا)`} icon={Receipt} />
        <StatCard label="مبيعات نقاط البيع" value={dzd(stats.pos.totalDzd)} hint={`${stats.pos.count} باقة مبيعة`} icon={Store} />
      </div>

      {stats.orderWithoutInvoice > 0 ? (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          {stats.orderWithoutInvoice} تلميذ دخل من طلب لم تصدر فاتورته بعد (الطلب لم يُسلَّم أو الفاتورة لم تُصدَر).{' '}
          <Link href="/admin/invoices?month=all" className="font-semibold text-primary hover:underline">
            صفحة الفواتير
          </Link>
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <Breakdown title="حسب مصدر التسجيل" items={stats.bySource.map((s) => ({ name: s.label, n: s.n }))} />
        <Breakdown title="حسب الولاية" items={stats.byWilaya} />
        <Breakdown title="حسب الشعبة" items={stats.byStream} />
      </div>

      <form action="/admin/students" className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-[1fr_9rem_10rem_10rem_auto]">
        <input type="hidden" name="course" value={course.id} />
        <Input name="q" defaultValue={filters.q ?? ''} placeholder="ابحث بالاسم أو الهاتف" dir="auto" aria-label="بحث" />
        <Select name="status" defaultValue={filters.status ?? 'ACTIVE'} aria-label="الحالة">
          {ROSTER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ROSTER_STATUS_AR[s]}
            </option>
          ))}
        </Select>
        <Select name="source" defaultValue={filters.source ?? ''} aria-label="المصدر">
          <option value="">كل المصادر</option>
          {ENROLLMENT_SOURCES.map((s) => (
            <option key={s} value={s}>
              {ENROLLMENT_SOURCE_AR[s]}
            </option>
          ))}
        </Select>
        <div>
          <span className="mb-1 block text-xs text-muted-foreground sm:hidden">شهر التسجيل (اختياري)</span>
          <Input type="month" name="month" defaultValue={filters.month ?? ''} aria-label="شهر التسجيل" />
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="outline" className="flex-1">
            تصفية
          </Button>
          {filtered ? (
            <Button asChild variant="ghost">
              <Link href={`/admin/students?course=${course.id}`}>مسح</Link>
            </Button>
          ) : null}
        </div>
      </form>

      <p className="text-sm font-semibold" data-testid="roster-count">
        عدد التلاميذ: <span className="tabular">{matched}</span>
        {matched > rows.length ? <span className="font-normal text-muted-foreground"> — تظهر أحدث {ROSTER_PAGE_MAX} هنا، وExcel والطباعة تشمل الكل.</span> : null}
      </p>

      {rows.length === 0 ? (
        <EmptyState title="لا أحد بهذه التصفية" description="غيّر الحالة أو الشهر أو المصدر." />
      ) : (
        <>
          {/* الهاتف: بطاقات */}
          <ul className="space-y-2 sm:hidden">
            {rows.map((r) => (
              <li key={r.enrollmentId} className="rounded-xl border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{r.fullName}</p>
                  <Badge variant={STATUS_VARIANT[r.status]}>{ROSTER_STATUS_AR[r.status]}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  <span dir="ltr">{r.phone ?? '—'}</span>
                  {r.wilaya ? ` · ${r.wilaya}` : ''}
                  {r.stream ? ` · ${r.stream}` : ''}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {ENROLLMENT_SOURCE_AR[r.source as EnrollmentSource] ?? r.source}
                    {r.posName ? ` (${r.posName})` : ''} · {formatDate(r.activatedAt)}
                  </span>
                  <InvoiceCell r={r} />
                </div>
              </li>
            ))}
          </ul>
          {/* الحاسوب: جدول */}
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم واللقب</TableHead>
                  <TableHead>الهاتف</TableHead>
                  <TableHead>الولاية</TableHead>
                  <TableHead>الشعبة</TableHead>
                  <TableHead>المصدر</TableHead>
                  <TableHead>التفعيل</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الفاتورة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.enrollmentId}>
                    <TableCell className="font-semibold">{r.fullName}</TableCell>
                    <TableCell dir="ltr" className="text-start text-xs">
                      {r.phone ?? '—'}
                    </TableCell>
                    <TableCell className="text-xs">{r.wilaya ?? '—'}</TableCell>
                    <TableCell className="text-xs">{r.stream ?? r.level ?? '—'}</TableCell>
                    <TableCell className="text-xs">
                      {ENROLLMENT_SOURCE_AR[r.source as EnrollmentSource] ?? r.source}
                      {r.posName ? <span className="block text-muted-foreground">{r.posName}</span> : null}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(r.activatedAt)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[r.status]}>{ROSTER_STATUS_AR[r.status]}</Badge>
                    </TableCell>
                    <TableCell>
                      <InvoiceCell r={r} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
