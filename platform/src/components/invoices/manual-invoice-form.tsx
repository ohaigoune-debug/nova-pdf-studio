'use client'

import { Plus, Search, Trash2, X } from 'lucide-react'
import { useActionState, useState, useTransition } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { MANUAL_PAYMENT_METHODS, PAYMENT_METHOD_AR } from '@/lib/invoice-labels'
import { createManualInvoiceAction, searchInvoiceStudentsAction } from '@/server/actions/invoices.actions'

type Hit = { id: string; label: string; name: string; phone: string | null }
type Line = { key: number; title: string; qty: string; price: string }

/** فاتورة يدوية: تلميذ من المنصة (اختياري — يراها في «فواتيري») أو زبون باسمه، وأسطر حرّة */
export function ManualInvoiceForm() {
  const [state, action] = useActionState(createManualInvoiceAction, null)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [student, setStudent] = useState<Hit | null>(null)
  const [pending, start] = useTransition()
  const [lines, setLines] = useState<Line[]>([{ key: 1, title: '', qty: '1', price: '' }])
  const [shipping, setShipping] = useState('')
  const [discount, setDiscount] = useState('')
  const total = Math.max(0, lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0) + (Number(shipping) || 0) - (Number(discount) || 0))
  const search = () => start(async () => setHits(q.trim().length >= 2 ? await searchInvoiceStudentsAction(q) : []))
  const patch = (key: number, p: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)))
  return (
    <form action={action} className="space-y-6">
      <fieldset className="space-y-3 rounded-xl border bg-card p-4">
        <legend className="px-1 text-sm font-bold">الزبون</legend>
        {student ? (
          <div className="flex items-center justify-between gap-2 rounded-md bg-muted/60 p-2 text-sm">
            <span>
              تلميذ المنصة: <span className="font-semibold">{student.label}</span> — يرى الفاتورة في «فواتيري»
            </span>
            <Button type="button" size="sm" variant="ghost" onClick={() => setStudent(null)} aria-label="إزالة التلميذ">
              <X className="size-4" />
            </Button>
            <input type="hidden" name="studentId" value={student.id} />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search() } }} placeholder="ابحث عن تلميذ بالاسم أو الهاتف (اختياري)" dir="auto" aria-label="بحث عن تلميذ" />
              <Button type="button" variant="outline" onClick={search} disabled={pending}>
                <Search className="size-4" /> بحث
              </Button>
            </div>
            {hits.length ? (
              <ul className="divide-y rounded-md border text-sm">
                {hits.map((h) => (
                  <li key={h.id}>
                    <button type="button" className="w-full p-2 text-right hover:bg-muted/60" onClick={() => { setStudent(h); setHits([]) }}>
                      {h.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="اسم الزبون على الفاتورة" htmlFor="customerName" error={fieldError(state, 'customerName')} hint={student ? 'فارغ = اسم التلميذ' : undefined}>
            <Input id="customerName" name="customerName" maxLength={120} required={!student} placeholder={student?.name ?? ''} />
          </Field>
          <Field label="الهاتف" htmlFor="customerPhone" hint={student ? 'فارغ = هاتف التلميذ' : undefined}>
            <Input id="customerPhone" name="customerPhone" type="tel" dir="ltr" placeholder={student?.phone ?? '05XXXXXXXX'} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-3 rounded-xl border bg-card p-4">
        <legend className="px-1 text-sm font-bold">الأسطر</legend>
        {lines.map((l) => (
          <div key={l.key} className="grid gap-2 sm:grid-cols-[1fr_6rem_9rem_auto]">
            <Input name="lineTitle" value={l.title} onChange={(e) => patch(l.key, { title: e.target.value })} placeholder="الوصف: دورة الأدب العربي 2026/2027 مع الكتاب" maxLength={200} aria-label="الوصف" />
            <Input name="lineQty" type="number" min={1} value={l.qty} onChange={(e) => patch(l.key, { qty: e.target.value })} aria-label="الكمية" />
            <Input name="linePrice" type="number" min={0} value={l.price} onChange={(e) => patch(l.key, { price: e.target.value })} placeholder="السعر (دج)" aria-label="سعر الوحدة" />
            <Button type="button" variant="ghost" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls))} aria-label="حذف السطر">
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        {fieldError(state, 'lines') ? <p className="text-sm text-destructive">{fieldError(state, 'lines')}</p> : null}
        <Button type="button" variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, { key: Math.max(...ls.map((x) => x.key)) + 1, title: '', qty: '1', price: '' }])}>
          <Plus className="size-4" /> سطر
        </Button>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="التوصيل (دج)" htmlFor="shippingDzd" error={fieldError(state, 'shippingDzd')}>
            <Input id="shippingDzd" name="shippingDzd" type="number" min={0} value={shipping} onChange={(e) => setShipping(e.target.value)} />
          </Field>
          <Field label="تخفيض (دج)" htmlFor="discountDzd" error={fieldError(state, 'discountDzd')}>
            <Input id="discountDzd" name="discountDzd" type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </Field>
          <Field label="طريقة الدفع" htmlFor="paymentMethod" error={fieldError(state, 'paymentMethod')}>
            <Select id="paymentMethod" name="paymentMethod" defaultValue="CASH">
              {MANUAL_PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_AR[m]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <p className="text-base font-extrabold">
          الإجمالي: <span className="tabular-nums">{total} دج</span>
        </p>
      </fieldset>

      <Field label="ملاحظة على الفاتورة (اختياري)" htmlFor="note">
        <Textarea id="note" name="note" rows={2} maxLength={500} />
      </Field>
      <FormError state={state} />
      <SubmitButton>أصدر الفاتورة</SubmitButton>
    </form>
  )
}
