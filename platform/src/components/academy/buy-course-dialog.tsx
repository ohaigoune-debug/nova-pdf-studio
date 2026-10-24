'use client'

import { ShoppingBag } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { OtpVerifyCard } from '@/components/domain/otp-verify-card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Alert } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { courseQuoteAction, placeCourseOrderAction } from '@/server/actions/course-purchase.actions'

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
 * «شراء الدورة مع الكتاب» (قرار المالك 2026-10-24): نموذج واحد — المستلم والهاتف والولاية والبلدية والعنوان
 * ومنزل/مكتب، والسعر والتوصيل والإجمالي كما يحسبها الخادم. الطلب يُرسل courseId فقط (لا سعر ولا منتج). المعلومات تُعبّأ من التسجيل؛ التلميذ يختار هاتف الاستلام
 * (هاتفه، هاتف الولي، أو رقماً آخر)، ويصل رمز تأكيد إلى الهاتف المختار — إلا إن كان هاتفه المؤكَّد سلفاً.
 * الطلب المؤكَّد بالرمز يُرسَل إلى التوصيل مباشرة، وتُفعَّل الدورة عند التسليم.
 */
export function BuyCourseDialog({ courseId, courseTitle, book, data }: { courseId: string; courseTitle: string; book: { title: string; priceDzd: number }; data: CheckoutData }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const d = data.defaults
  const [who, setWho] = useState<'self' | 'guardian' | 'other'>(d.phone ? 'self' : d.guardianPhone ? 'guardian' : 'other')
  const [other, setOther] = useState('')
  const [f, setF] = useState({ wilayaId: d.wilayaId ?? '', commune: '', address: '', deliveryType: 'HOME' as 'HOME' | 'DESK', otpCode: '' })
  const physical = true
  const [quote, setQuote] = useState<{ priceDzd: number; shippingDzd: number; totalDzd: number } | null>(null)
  // الإجمالي من الخادم: يتغيّر بالولاية ونوع التسليم
  useEffect(() => {
    if (!open) return
    let alive = true
    void courseQuoteAction(courseId, f.wilayaId || null, f.deliveryType).then((r) => {
      if (alive && r.ok && r.data) setQuote(r.data)
    })
    return () => {
      alive = false
    }
  }, [open, courseId, f.wilayaId, f.deliveryType])
  const phone = norm(who === 'self' ? (d.phone ?? '') : who === 'guardian' ? (d.guardianPhone ?? '') : other)
  const phoneOk = PHONE_RE.test(phone)
  // هاتفه المؤكَّد سلفاً لا يحتاج رمزاً جديداً
  const needsOtp = data.smsReady && !(who === 'self' && d.phoneVerified && phone === norm(d.phone ?? ''))
  const fee = quote?.shippingDzd ?? 0
  const price = quote?.priceDzd ?? book.priceDzd
  const total = quote?.totalDzd ?? book.priceDzd
  const ready = phoneOk && (!physical || (f.wilayaId && f.address.trim())) && (!needsOtp || f.otpCode.length >= 4)

  const submit = () =>
    start(async () => {
      const r = await placeCourseOrderAction({ courseId, phone, wilayaId: f.wilayaId, commune: f.commune || null, address: f.address, deliveryType: f.deliveryType, otpCode: needsOtp ? f.otpCode : null })
      if (!r.ok) return toast('error', r.error.message)
      toast('success', r.data.status === 'CONFIRMED' ? `أُكّد طلبك ${r.data.number}: يصلك الكتاب وتُفعَّل الدورة عند التسليم` : `أُرسل طلبك ${r.data.number}`)
      setOpen(false)
      router.push('/student/courses/orders')
    })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg">
          <ShoppingBag className="size-4" /> شراء الدورة مع الكتاب
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>شراء «{courseTitle}» مع الكتاب</DialogTitle>
          <DialogDescription>يصلك «{book.title}» بالدفع عند الاستلام، وتُفعَّل الدورة على حسابك لحظة تسليمه.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
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
          <dl className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/40 p-3 text-center text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">الدورة مع الكتاب</dt>
              <dd className="font-bold tabular-nums">{price} دج</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">التوصيل</dt>
              <dd className="font-bold tabular-nums">{f.wilayaId ? `${fee} دج` : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">الإجمالي</dt>
              <dd className="font-extrabold tabular-nums text-primary">{total} دج</dd>
            </div>
          </dl>
          {!data.smsReady ? <Alert tone="info">نتصل بك على هذا الرقم لتأكيد الطلب، ثم نرسل الكتاب.</Alert> : null}
          <Button className="w-full" size="lg" onClick={submit} loading={pending} disabled={!ready}>
            تأكيد الشراء — {total} دج
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
