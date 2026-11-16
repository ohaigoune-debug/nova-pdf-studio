import type { InvoicePaymentMethod, InvoiceRow } from '@/server/db/schema'
import { PAYMENT_METHOD_AR } from '@/lib/invoice-labels'

const dzd = (n: number) => `${n.toLocaleString('fr-DZ').replace(/ | /g, ' ')} دج`
const day = (d: Date) => new Intl.DateTimeFormat('ar-DZ-u-nu-latn', { timeZone: 'Africa/Algiers', year: 'numeric', month: 'long', day: 'numeric' }).format(d)

/**
 * الفاتورة بصيغة A4 (تُطبع أو تُحفظ PDF من المتصفّح، فتبقى العربية سليمة الاتجاه والتشكيل).
 * كل ما فيها من نسخة الإصدار المجمَّدة: الأسطر والمبالغ وبيانات البائع.
 */
export function InvoiceSheet({ invoice, receiptQrSvg = null }: { invoice: InvoiceRow; receiptQrSvg?: string | null }) {
  const efawtara = invoice.paymentMethod === 'ONLINE' && (invoice.paymentRef || invoice.paymentReceiptUrl)
  const cancelled = invoice.status === 'CANCELLED'
  return (
    <article dir="rtl" className="relative mx-auto my-6 w-[210mm] max-w-full bg-white p-[14mm] text-[13px] leading-relaxed text-black shadow print:my-0 print:w-auto print:p-0 print:shadow-none" data-testid="invoice-sheet">
      {cancelled ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <span className="-rotate-12 rounded-lg border-4 border-red-600/60 px-6 py-2 text-5xl font-extrabold text-red-600/60">ملغاة</span>
        </div>
      ) : null}
      <header className="flex items-start justify-between gap-6 border-b-2 border-[#0b2a6b] pb-4">
        <div className="space-y-1">
          <p className="text-lg font-extrabold text-[#0b2a6b]">{invoice.seller.name}</p>
          {invoice.seller.nif ? (
            <p>
              رقم التعريف الجبائي (NIF): <span dir="ltr" className="font-mono">{invoice.seller.nif}</span>
            </p>
          ) : null}
          {invoice.seller.bankAccount ? (
            <p>
              الحساب البنكي: <span dir="ltr" className="font-mono">{invoice.seller.bankAccount}</span>
            </p>
          ) : null}
        </div>
        <div className="shrink-0 text-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/madrasadz-logo.png" alt="مدرسة" className="ms-auto h-12 w-auto" />
        </div>
      </header>

      <section className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0b2a6b]">فاتورة</h1>
          <p className="mt-1">
            رقم الفاتورة: <span className="font-bold" dir="ltr">{invoice.number}</span>
          </p>
          <p>تاريخ الإصدار: {day(invoice.issuedAt)}</p>
          {cancelled && invoice.cancelReason ? <p className="font-semibold text-red-700">ملغاة: {invoice.cancelReason}</p> : null}
        </div>
        <div className="min-w-[45%] rounded-md border border-neutral-300 p-3">
          <p className="mb-1 text-[12px] font-semibold text-neutral-600">الزبون</p>
          <p className="font-bold">{invoice.customerName}</p>
          {invoice.customerPhone ? (
            <p>
              الهاتف: <span dir="ltr">{invoice.customerPhone}</span>
            </p>
          ) : null}
          {invoice.studentCode ? (
            <p>
              رمز الحساب: <span dir="ltr" className="font-mono">{invoice.studentCode}</span>
            </p>
          ) : null}
        </div>
      </section>

      <table className="mt-6 w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-[#0b2a6b] text-white">
            <th className="border border-[#0b2a6b] p-2 text-right">الوصف</th>
            <th className="w-16 border border-[#0b2a6b] p-2 text-center">الكمية</th>
            <th className="w-28 border border-[#0b2a6b] p-2 text-center">سعر الوحدة</th>
            <th className="w-28 border border-[#0b2a6b] p-2 text-center">المبلغ</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((l, i) => (
            <tr key={i}>
              <td className="border border-neutral-300 p-2">{l.title}</td>
              <td className="border border-neutral-300 p-2 text-center tabular-nums">{l.qty}</td>
              <td className="border border-neutral-300 p-2 text-center tabular-nums">{dzd(l.unitDzd)}</td>
              <td className="border border-neutral-300 p-2 text-center tabular-nums">{dzd(l.totalDzd)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-4 flex justify-end">
        <dl className="w-72 space-y-1">
          <Row label="المجموع" value={dzd(invoice.subtotalDzd)} />
          {invoice.shippingDzd ? <Row label="التوصيل" value={dzd(invoice.shippingDzd)} /> : null}
          {invoice.discountDzd ? <Row label="المخصوم (رصيد/تخفيض)" value={`− ${dzd(invoice.discountDzd)}`} /> : null}
          <div className="flex items-center justify-between border-t-2 border-[#0b2a6b] pt-1 text-base font-extrabold">
            <dt>الإجمالي</dt>
            <dd className="tabular-nums">{dzd(invoice.totalDzd)}</dd>
          </div>
          <Row label="طريقة الدفع" value={PAYMENT_METHOD_AR[invoice.paymentMethod as InvoicePaymentMethod] ?? invoice.paymentMethod} />
        </dl>
      </section>

      {efawtara ? (
        <section className="mt-6 flex items-center justify-between gap-4 rounded-md border border-[#0b2a6b]/30 p-3" data-testid="invoice-efawtara">
          <div className="space-y-1">
            <p className="font-bold text-[#0b2a6b]">دفع إلكتروني عبر eFawtara (Guiddini) — بوابة SATIM</p>
            {invoice.paymentRef ? (
              <p>
                رقم المعاملة: <span dir="ltr" className="font-mono">{invoice.paymentRef}</span>
              </p>
            ) : null}
            {invoice.paymentReceiptUrl ? (
              <p className="text-[12px] text-neutral-700">
                الإيصال الموقَّع من eFawtara:{' '}
                <a href={invoice.paymentReceiptUrl} target="_blank" rel="noopener noreferrer" className="text-[#0b2a6b] underline print:no-underline">
                  افتحه
                </a>{' '}
                أو امسح الرمز.
              </p>
            ) : null}
          </div>
          {receiptQrSvg ? <span className="block size-24 shrink-0 [&>svg]:size-full" aria-label="رمز الإيصال" dangerouslySetInnerHTML={{ __html: receiptQrSvg }} /> : null}
        </section>
      ) : null}

      {invoice.note ? <p className="mt-6 whitespace-pre-line rounded-md bg-neutral-100 p-3">{invoice.note}</p> : null}
      <footer className="mt-10 border-t border-neutral-300 pt-3 text-center text-[12px] text-neutral-600">
        {invoice.seller.footer ? <p className="whitespace-pre-line">{invoice.seller.footer}</p> : null}
        <p dir="ltr">madrasadz.com</p>
      </footer>
    </article>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-neutral-700">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}
