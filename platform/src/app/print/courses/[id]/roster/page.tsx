import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PrintButton } from '@/components/domain/print-button'
import { Button } from '@/components/ui/button'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { courseRosterForPrint, parseRosterFilters, ROSTER_STATUS_AR } from '@/server/services/course-roster.service'
import { ENROLLMENT_SOURCE_AR } from '@/server/services/courses.service'
import { invoiceSettings } from '@/server/services/invoices.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'كشف تلاميذ الدورة' }

const dzd = (n: number) => `${n.toLocaleString('fr-DZ').replace(/[  ]/g, ' ')} دج`
const day = (d: Date) => new Intl.DateTimeFormat('fr-DZ', { timeZone: 'Africa/Algiers', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)

/** كشف A4 بتلاميذ دورة (بالتصفية المختارة في صفحة التلاميذ): يُطبع أو يُحفظ PDF */
export default async function CourseRosterPrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePageActor('SUPER_ADMIN')
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const filters = parseRosterFilters(sp)
  const db = await getDb()
  let data
  try {
    data = await courseRosterForPrint(db, actor, { courseId: id, ...filters })
  } catch (e) {
    if (isAppError(e)) notFound()
    throw e
  }
  const seller = await invoiceSettings(db)
  const { course, stats, rows } = data
  const period = filters.month
    ? new Intl.DateTimeFormat('ar-DZ-u-nu-latn', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${filters.month}-15T00:00:00Z`))
    : 'كل الفترات'
  const scope = [ROSTER_STATUS_AR[filters.status ?? 'ACTIVE'], filters.source ? ENROLLMENT_SOURCE_AR[filters.source] : null, period, filters.q ? `بحث: ${filters.q}` : null].filter(Boolean).join(' · ')
  const back = `/admin/students?${new URLSearchParams(Object.entries({ course: id, ...sp }).filter(([, v]) => v) as [string, string][]).toString()}`
  return (
    <>
      {/* عشرة أعمدة: الكشف بالعرض */}
      <style>{'@page { size: A4 landscape; margin: 10mm }'}</style>
      <div className="no-print mx-auto flex w-[297mm] max-w-full flex-wrap items-center justify-between gap-2 px-2 pt-4">
        <Button asChild variant="ghost">
          <Link href={back}>
            <ArrowRight className="size-4" /> التلاميذ
          </Link>
        </Button>
        <PrintButton />
      </div>
      <article dir="rtl" className="mx-auto my-6 w-[297mm] max-w-full overflow-x-auto bg-white p-[12mm] text-[11px] leading-relaxed text-black shadow print:my-0 print:w-auto print:overflow-visible print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-4 border-b-2 border-black pb-3">
          <div>
            <p className="text-[10px] text-neutral-600">كشف المسجَّلين في دورة</p>
            <h1 className="text-[18px] font-bold leading-snug">{course.title}</h1>
            <p className="mt-0.5 text-neutral-700">{scope}</p>
          </div>
          <div className="text-start text-[10px] text-neutral-700">
            <p className="font-bold text-black">{seller.sellerName}</p>
            {seller.nif ? <p>NIF: <span dir="ltr">{seller.nif}</span></p> : null}
            <p>تاريخ الكشف: <span dir="ltr">{day(new Date())}</span></p>
          </div>
        </header>

        <table className="mt-3 w-full border-collapse text-center text-[11px]">
          <tbody>
            <tr>
              <td className="border border-neutral-400 p-1.5">مسجَّلون الآن<br /><b className="text-[14px]">{stats.active}</b></td>
              <td className="border border-neutral-400 p-1.5">الإجمالي ({period})<br /><b className="text-[14px]">{stats.total}</b></td>
              <td className="border border-neutral-400 p-1.5">مداخيل الفواتير<br /><b className="text-[14px]">{dzd(stats.invoiced.totalDzd)}</b><br /><span className="text-[9px]">{stats.invoiced.count} فاتورة</span></td>
              <td className="border border-neutral-400 p-1.5">مبيعات نقاط البيع<br /><b className="text-[14px]">{dzd(stats.pos.totalDzd)}</b><br /><span className="text-[9px]">{stats.pos.count} باقة</span></td>
            </tr>
          </tbody>
        </table>

        <table className="mt-4 w-full min-w-[250mm] border-collapse text-[10.5px] print:min-w-0">
          <thead>
            <tr className="bg-neutral-100">
              {['#', 'الاسم واللقب', 'الهاتف', 'الولاية', 'الشعبة', 'المصدر', 'التفعيل', 'الحالة', 'الفاتورة', 'المبلغ'].map((h) => (
                <th key={h} className="border border-neutral-400 px-1 py-1 text-start font-bold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.enrollmentId} className="break-inside-avoid">
                <td className="border border-neutral-300 px-1 py-0.5 tabular">{i + 1}</td>
                <td className="border border-neutral-300 px-1 py-0.5 font-semibold">{r.fullName}</td>
                <td className="whitespace-nowrap border border-neutral-300 px-1 py-0.5" dir="ltr">{r.phone ?? ''}</td>
                <td className="border border-neutral-300 px-1 py-0.5">{r.wilaya ?? ''}</td>
                <td className="border border-neutral-300 px-1 py-0.5">{r.stream ?? r.level ?? ''}</td>
                <td className="border border-neutral-300 px-1 py-0.5">{ENROLLMENT_SOURCE_AR[r.source] ?? r.source}{r.posName ? ` (${r.posName})` : ''}</td>
                <td className="whitespace-nowrap border border-neutral-300 px-1 py-0.5" dir="ltr">{day(r.activatedAt)}</td>
                <td className="border border-neutral-300 px-1 py-0.5">{ROSTER_STATUS_AR[r.status]}</td>
                <td className="whitespace-nowrap border border-neutral-300 px-1 py-0.5 font-mono" dir="ltr">{r.invoiceNumber ? `${r.invoiceNumber}${r.invoiceCancelled ? ' ×' : ''}` : ''}</td>
                <td className="whitespace-nowrap border border-neutral-300 px-1 py-0.5 tabular">
                  {r.invoiceNumber && !r.invoiceCancelled && r.invoiceTotalDzd != null ? dzd(r.invoiceTotalDzd) : r.posPriceDzd ? dzd(r.posPriceDzd) : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[10px] text-neutral-600">
          عدد التلاميذ في الكشف: <b className="text-black">{rows.length}</b>. المبلغ: مبلغ فاتورة الطلب (قد يشمل الكتاب والتوصيل)، أو سعر نقطة البيع. «×» = فاتورة ملغاة.
        </p>
      </article>
    </>
  )
}
