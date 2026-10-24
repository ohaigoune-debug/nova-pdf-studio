'use client'

import { ShoppingBag, Truck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { OtpVerifyCard } from '@/components/domain/otp-verify-card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Alert } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { placeOrderAction } from '@/server/actions/store.actions'

export interface CheckoutData {
  defaults: { name: string; phone: string | null; phoneVerified: boolean; guardianPhone: string | null; wilayaId: string | null }
  wilayas: { id: string; name: string }[]
  feeTable: Record<string, { home: number; desk: number }> | null
  shippingDzd: number
  smsReady: boolean
}

const PHONE_RE = /^0[5-7]\d{8}$/
const norm = (p: string) => p.replace(/[\s\-().]/g, '').replace(/^\+?213/, '0')

/**
 * «شراء الدورة» = طلب كتابها (قرار المالك 2026-10-24). المعلومات تُعبّأ من التسجيل؛ التلميذ يختار هاتف الاستلام
 * (هاتفه، هاتف الولي، أو رقماً آخر)، ويصل رمز تأكيد إلى الهاتف المختار — إلا إن كان هاتفه المؤكَّد سلفاً.
 * الطلب المؤكَّد بالرمز يُرسَل إلى التوصيل مباشرة، وتُفعَّل الدورة عند التسليم.
 */
export function BuyCourseDialog({ product, courseTitle, data }: { product: { id: string; title: string; priceDzd: number; type: string }; courseTitle: string; data: CheckoutData }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const d = data.defaults
  const [who, setWho] = useState<'self' | 'guardian' | 'other'>(d.phone ? 'self' : d.guardianPhone ? 'guardian' : 'other')
  const [other, setOther] = useState('')
  const [f, setF] = useState({ wilayaId: d.wilayaId ?? '', commune: '', address: '', deliveryType: 'HOME' as 'HOME' | 'DESK', otpCode: '' })
  const physical = product.type === 'BOOK' || product.type === 'PACK'
  const phone = norm(who === 'self' ? (d.phone ?? '') : who === 'guardian' ? (d.guardianPhone ?? '') : other)
  const phoneOk = PHONE_RE.test(phone)
  // هاتفه المؤكَّد سلفاً لا يحتاج رمزاً جديداً
  const needsOtp = data.smsReady && !(who === 'self' && d.phoneVerified && phone === norm(d.phone ?? ''))
  const fee = useMemo(() => {
    if (!physical) return 0
    const row = f.wilayaId ? data.feeTable?.[f.wilayaId] : null
    return row ? (f.deliveryType === 'DESK' ? row.desk : row.home) : data.shippingDzd
  }, [physical, f.wilayaId, f.deliveryType, data.feeTable, data.shippingDzd])
  const total = product.priceDzd + fee
  const ready = phoneOk && (!physical || (f.wilayaId && f.address.trim())) && (!needsOtp || f.otpCode.length >= 4)

  const submit = () =>
    start(async () => {
      const r = await placeOrderAction({ items: [{ productId: product.id, qty: 1 }], customerName: d.name, phone, wilayaId: f.wilayaId || null, commune: f.commune || null, address: f.address || null, deliveryType: f.deliveryType, note: `دورة: ${courseTitle}`, otpCode: needsOtp ? f.otpCode : null })
      if (!r.ok) return toast('error', r.error.message)
      toast('success', r.data.status === 'CONFIRMED' ? `أُكّد طلبك ${r.data.number}: يصلك الكتاب وتُفعَّل الدورة عند التسليم` : `أُرسل طلبك ${r.data.number}`)
      setOpen(false)
      router.push(`/store/orders/${r.data.id}`)
    })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <ShoppingBag className="size-4" /> شراء الدورة
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>شراء «{courseTitle}»</DialogTitle>
          <DialogDescription>
            {product.title} — {product.priceDzd} دج{physical ? ` + توصيل ${fee} دج = ${total} دج، الدفع عند الاستلام` : ''}. تُفعَّل الدورة على حسابك لحظة تسليم الكتاب.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="mb-3 font-bold">معلومات التلميذ</p>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-muted-foreground">الاسم الكامل</dt><dd className="font-semibold">{d.name}</dd></div>
              <div><dt className="text-muted-foreground">هاتف التلميذ</dt><dd dir="ltr" className="text-start font-semibold">{d.phone ?? '—'}</dd></div>
              <div><dt className="text-muted-foreground">هاتف الأب أو ولي الأمر</dt><dd dir="ltr" className="text-start font-semibold">{d.guardianPhone ?? '—'}</dd></div>
            </dl>
          </div>
          <Field label="هاتف الاستلام" htmlFor="buy-who">
            <Select id="buy-who" value={who} onChange={(e) => setWho(e.target.value as typeof who)}>
              {d.phone ? <option value="self">هاتفي — {d.phone}</option> : null}
              {d.guardianPhone ? <option value="guardian">هاتف الولي — {d.guardianPhone}</option> : null}
              <option value="other">رقم آخر</option>
            </Select>
          </Field>
          {who === 'other' ? (
            <Field label="الرقم" htmlFor="buy-other" hint="05 / 06 / 07">
              <Input id="buy-other" value={other} onChange={(e) => setOther(e.target.value)} dir="ltr" inputMode="tel" placeholder="05XXXXXXXX" />
            </Field>
          ) : null}
          {physical ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="الولاية" htmlFor="buy-wilaya">
                  <Select id="buy-wilaya" value={f.wilayaId} onChange={(e) => setF((s) => ({ ...s, wilayaId: e.target.value }))}>
                    <option value="">—</option>
                    {data.wilayas.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="البلدية" htmlFor="buy-commune">
                  <Input id="buy-commune" value={f.commune} onChange={(e) => setF((s) => ({ ...s, commune: e.target.value }))} dir="auto" />
                </Field>
              </div>
              <Field label="طريقة الاستلام" htmlFor="buy-type">
                <Select id="buy-type" value={f.deliveryType} onChange={(e) => setF((s) => ({ ...s, deliveryType: e.target.value === 'DESK' ? 'DESK' : 'HOME' }))}>
                  <option value="HOME">إلى المنزل{f.wilayaId && data.feeTable?.[f.wilayaId] ? ` — ${data.feeTable[f.wilayaId]!.home} دج` : ''}</option>
                  <option value="DESK">من مكتب شركة التوصيل{f.wilayaId && data.feeTable?.[f.wilayaId] ? ` — ${data.feeTable[f.wilayaId]!.desk} دج` : ''}</option>
                </Select>
              </Field>
              <Field label="العنوان" htmlFor="buy-address">
                <Textarea id="buy-address" rows={2} value={f.address} onChange={(e) => setF((s) => ({ ...s, address: e.target.value }))} dir="auto" />
              </Field>
            </>
          ) : null}
          {needsOtp && phoneOk ? (
            <OtpVerifyCard key={phone} purpose="ORDER" phone={phone} editablePhone={false} collectOnly onCode={(c) => setF((s) => ({ ...s, otpCode: c }))} title="رمز التأكيد" description={`نرسل رمزاً إلى ${phone}؛ أدخله ثم أكّد الشراء.`} />
          ) : null}
          {!data.smsReady ? <Alert tone="info">نتصل بك على هذا الرقم لتأكيد الطلب، ثم نرسل الكتاب.</Alert> : null}
          <div className="space-y-2 rounded-lg border bg-card p-4 text-sm" aria-live="polite">
            <p className="font-bold">ملخص الطلب</p>
            <p className="flex justify-between"><span>{product.title}</span><span>{product.priceDzd} دج</span></p>
            {physical ? <p className="flex justify-between"><span>التوصيل</span><span>{fee} دج</span></p> : null}
            <p className="flex justify-between border-t pt-2 text-base font-bold"><span>الإجمالي</span><span>{total} دج</span></p>
          </div>
          {physical ? <Alert tone="info"><span className="flex items-center gap-2"><Truck className="size-5 shrink-0" /> تُفعَّل الدورة بعد تأكيد شركة التوصيل تسليم الكتاب لحساب التلميذ نفسه.</span></Alert> : null}
          <Button className="w-full" size="lg" onClick={submit} loading={pending} disabled={!ready}>
            تأكيد الشراء — {total} دج
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
