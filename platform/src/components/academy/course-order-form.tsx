'use client'

import { Truck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { OtpVerifyCard } from '@/components/domain/otp-verify-card'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Alert } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import type { CourseCommuneLookup } from '@/server/services/delivery-communes.service'
import { courseCommunesAction, courseQuoteAction, placeCourseOrderAction } from '@/server/actions/course-purchase.actions'

export interface CheckoutData {
  defaults: { name: string; phone: string | null; phoneVerified: boolean; guardianPhone: string | null; wilayaId: string | null }
  wilayas: { id: string; name: string }[]
  feeTable: Record<string, { home: number; desk: number }> | null
  shippingDzd: number
  smsReady: boolean
  /** «ادفع الآن» بالبطاقة متاح (مفاتيح eFawtara مضبوطة ومفعّلة) */
  onlinePay?: boolean
}

const PHONE_RE = /^0[5-7]\d{8}$/
const norm = (p: string) => p.replace(/[\s\-().]/g, '').replace(/^\+?213/, '0')

/**
 * نموذج «اطلب الدورة» داخل صفحة الطلب (نسق صفحات الهبوط في NOVA): المستلم والهاتف والولاية والبلدية والعنوان
 * ومنزل/مكتب، والسعر والتوصيل والإجمالي كما يحسبها الخادم. الطلب يُرسل courseId فقط (لا سعر ولا منتج).
 * لكل طلب رمز تأكيد جديد يصل إلى الهاتف المختار. تُفعَّل الدورة عند تسليم الكتاب.
 */
export function CourseOrderForm({ courseId, book, data }: { courseId: string; book: { title: string; priceDzd: number }; data: CheckoutData }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const d = data.defaults
  const [who, setWho] = useState<'self' | 'guardian' | 'other'>(d.phone ? 'self' : d.guardianPhone ? 'guardian' : 'other')
  const [other, setOther] = useState('')
  const [payNow, setPayNow] = useState(Boolean(data.onlinePay))
  const [f, setF] = useState({ wilayaId: d.wilayaId ?? '', commune: '', address: '', deliveryType: 'HOME' as 'HOME' | 'DESK', otpCode: '' })
  const [communeResult, setCommuneResult] = useState<{ wilayaId: string; lookup: CourseCommuneLookup } | null>(null)
  const communeLookup = communeResult?.wilayaId === f.wilayaId ? communeResult.lookup : null
  const communesLoading = Boolean(f.wilayaId) && !communeLookup
  const selectedCommune = communeLookup?.communes.find((c) => c.name === f.commune)
  const deskAvailable = communeLookup?.mode === 'manual' || Boolean(selectedCommune?.hasDesk)
  useEffect(() => {
    if (!f.wilayaId) return
    let alive = true
    const wilayaId = f.wilayaId
    const manual: CourseCommuneLookup = { mode: 'manual', communes: [] }
    void courseCommunesAction(wilayaId).then((r) => {
      if (alive) setCommuneResult({ wilayaId, lookup: r.ok ? r.data : manual })
    }).catch(() => {
      if (alive) setCommuneResult({ wilayaId, lookup: manual })
    })
    return () => { alive = false }
  }, [f.wilayaId])
  const [quote, setQuote] = useState<{ priceDzd: number; shippingDzd: number; totalDzd: number; creditBalanceDzd: number; creditDzd: number } | null>(null)
  const [useCredit, setUseCredit] = useState(true)
  // الإجمالي من الخادم: يتغيّر بالولاية ونوع التسليم وطريقة الدفع (الرصيد لا يُنزل الدفع بالبطاقة تحت 50 دج)
  useEffect(() => {
    let alive = true
    void courseQuoteAction(courseId, f.wilayaId || null, f.deliveryType, payNow).then((r) => {
      if (alive && r.ok && r.data) setQuote(r.data)
    })
    return () => {
      alive = false
    }
  }, [courseId, f.wilayaId, f.deliveryType, payNow])
  const phone = norm(who === 'self' ? (d.phone ?? '') : who === 'guardian' ? (d.guardianPhone ?? '') : other)
  const phoneOk = PHONE_RE.test(phone)
  // تأكيد هاتف الحساب لا يستبدل تأكيد هذه الطلبية.
  const needsOtp = data.smsReady && !payNow
  const fee = quote?.shippingDzd ?? 0
  const price = quote?.priceDzd ?? book.priceDzd
  const credit = useCredit ? (quote?.creditDzd ?? 0) : 0
  const total = (quote?.totalDzd ?? book.priceDzd) - credit
  const ready = phoneOk && Boolean(f.wilayaId) && !communesLoading && Boolean(f.commune.trim()) && (communeLookup?.mode !== 'select' || Boolean(selectedCommune)) && Boolean(f.address.trim()) && (!needsOtp || f.otpCode.length >= 4)
  // ما ينقص لتفعيل زر التأكيد — الشروط نفسها أعلاه، بالترتيب الظاهر في النموذج (الزر الباهت لا يبقى لغزاً)
  const missing = [
    !phoneOk && 'رقم هاتف صحيح',
    !f.wilayaId && 'الولاية',
    f.wilayaId && communesLoading && 'انتظر تحميل البلديات',
    f.wilayaId && !communesLoading && (!f.commune.trim() || (communeLookup?.mode === 'select' && !selectedCommune)) && 'البلدية',
    !f.address.trim() && 'العنوان',
    needsOtp && phoneOk && f.otpCode.length < 4 && 'رمز التأكيد الذي وصلك'
  ].filter(Boolean) as string[]

  const submit = () =>
    start(async () => {
      const r = await placeCourseOrderAction({ courseId, phone, wilayaId: f.wilayaId, commune: f.commune || null, address: f.address, deliveryType: f.deliveryType, otpCode: needsOtp ? f.otpCode : null, payNow, useCredit: credit > 0 })
      if (!r.ok) return toast('error', r.error.message)
      // «ادفع الآن»: إلى صفحة الدفع الرسمية (SATIM)، ثم يعود الولي فيتحقق الخادم من الدفع
      if (r.data.payUrl) {
        window.location.assign(r.data.payUrl)
        return
      }
      toast('success', r.data.status === 'CONFIRMED' ? `أُكّد طلبك ${r.data.number}: يصلك الكتاب وتُفعَّل الدورة عند التسليم` : `أُرسل طلبك ${r.data.number}`)
      router.push('/student/courses/orders')
    })

  return (
    <div className="space-y-5">
      <div className="rounded-lg border bg-muted/40 p-4">
        <p className="mb-3 font-heading text-base font-semibold">معلومات التلميذ</p>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">الاسم الكامل</dt>
            <dd className="font-semibold">{d.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">هاتف التلميذ</dt>
            <dd dir="ltr" className="text-start font-semibold">
              {d.phone ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">هاتف الأب أو ولي الأمر</dt>
            <dd dir="ltr" className="text-start font-semibold">
              {d.guardianPhone ?? '—'}
            </dd>
          </div>
        </dl>
      </div>
      <h3 className="font-heading text-lg font-semibold">1. هاتف الاستلام</h3>
      <Field label="هاتف الاستلام" htmlFor="order-who">
        <Select id="order-who" value={who} onChange={(e) => setWho(e.target.value as typeof who)}>
          {d.phone ? <option value="self">هاتفي — {d.phone}</option> : null}
          {d.guardianPhone ? <option value="guardian">هاتف الولي — {d.guardianPhone}</option> : null}
          <option value="other">رقم آخر</option>
        </Select>
      </Field>
      {who === 'other' ? (
        <Field label="الرقم" htmlFor="order-other" hint="05 / 06 / 07">
          <Input id="order-other" value={other} onChange={(e) => setOther(e.target.value)} dir="ltr" inputMode="tel" placeholder="05XXXXXXXX" />
        </Field>
      ) : null}
      <h3 className="font-heading text-lg font-semibold">2. العنوان والتوصيل</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="الولاية" htmlFor="order-wilaya">
          <Select id="order-wilaya" value={f.wilayaId} onChange={(e) => setF((s) => ({ ...s, wilayaId: e.target.value, commune: '', deliveryType: 'HOME' }))}>
            <option value="">—</option>
            {data.wilayas.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="البلدية" htmlFor="order-commune">
          {communeLookup?.mode === 'select' ? (
            <Select id="order-commune" value={f.commune} onChange={(e) => {
              const commune = e.target.value
              const hasDesk = communeLookup.communes.find((c) => c.name === commune)?.hasDesk
              setF((s) => ({ ...s, commune, deliveryType: hasDesk ? s.deliveryType : 'HOME' }))
            }}>
              <option value="">اختر البلدية</option>
              {communeLookup.communes.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </Select>
          ) : (
            <Input id="order-commune" value={f.commune} onChange={(e) => setF((s) => ({ ...s, commune: e.target.value }))} disabled={!f.wilayaId || communesLoading} placeholder={communesLoading ? 'جارٍ تحميل البلديات…' : 'اكتب اسم البلدية'} dir="auto" />
          )}
          {communeLookup?.mode === 'manual' ? <p className="mt-1 text-xs text-muted-foreground">يمكنك كتابة اسم البلدية يدويًا.</p> : null}
        </Field>
      </div>
      <Field label="طريقة الاستلام" htmlFor="order-type">
        <Select id="order-type" value={f.deliveryType} onChange={(e) => setF((s) => ({ ...s, deliveryType: e.target.value === 'DESK' ? 'DESK' : 'HOME' }))}>
          <option value="HOME">إلى المنزل{f.wilayaId && data.feeTable?.[f.wilayaId] ? ` — ${data.feeTable[f.wilayaId]!.home} دج` : ''}</option>
          {deskAvailable ? <option value="DESK">من مكتب شركة التوصيل{f.wilayaId && data.feeTable?.[f.wilayaId] ? ` — ${data.feeTable[f.wilayaId]!.desk} دج` : ''}</option> : null}
        </Select>
      </Field>
      <Field label="العنوان" htmlFor="order-address">
        <Textarea id="order-address" rows={2} value={f.address} onChange={(e) => setF((s) => ({ ...s, address: e.target.value }))} dir="auto" />
      </Field>
      {needsOtp && phoneOk ? <h3 className="font-heading text-lg font-semibold">3. التأكيد بالهاتف</h3> : null}
      {needsOtp && phoneOk ? (
        <OtpVerifyCard key={phone} purpose="ORDER" phone={phone} editablePhone={false} collectOnly onCode={(c) => setF((s) => ({ ...s, otpCode: c }))} title="رمز التأكيد" description={`نرسل رمزاً إلى ${phone}؛ أدخله ثم أكّد الطلب.`} />
      ) : null}
      {data.onlinePay ? (
        <fieldset className="space-y-2 rounded-lg border p-4">
          <legend className="px-1 font-heading text-base font-semibold">طريقة الدفع</legend>
          <label className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${payNow ? 'border-primary bg-primary/5' : ''}`}>
            <input type="radio" name="pay" className="mt-1 size-4" checked={payNow} onChange={() => setPayNow(true)} />
            <span>
              <span className="block font-semibold">ادفع الآن بالبطاقة الذهبية أو CIB</span>
              <span className="block text-xs text-muted-foreground">تُفعَّل الدورة فورًا بعد الدفع، ويصلك الكتاب لاحقًا. الدفع في صفحة SATIM الرسمية.</span>
            </span>
          </label>
          <label className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${!payNow ? 'border-primary bg-primary/5' : ''}`}>
            <input type="radio" name="pay" className="mt-1 size-4" checked={!payNow} onChange={() => setPayNow(false)} />
            <span>
              <span className="block font-semibold">الدفع عند الاستلام</span>
              <span className="block text-xs text-muted-foreground">تدفع لعامل التوصيل، وتُفعَّل الدورة عند تسليم الكتاب.</span>
            </span>
          </label>
        </fieldset>
      ) : null}
      <div className="space-y-2 rounded-lg border bg-card p-4 text-sm" aria-live="polite">
        <p className="font-heading text-base font-semibold">ملخص الطلب</p>
        <p className="flex justify-between gap-3">
          <span>الدورة مع كتاب «{book.title}»</span>
          <span className="shrink-0 whitespace-nowrap tabular-nums">{price} دج</span>
        </p>
        <p className="flex justify-between">
          <span>التوصيل</span>
          <span className="shrink-0 whitespace-nowrap tabular-nums">{f.wilayaId ? `${fee} دج` : 'اختر الولاية'}</span>
        </p>
        {quote && quote.creditDzd > 0 ? (
          <label className="flex cursor-pointer items-center justify-between gap-3 text-success">
            <span className="flex items-center gap-2">
              <input type="checkbox" className="size-4" checked={useCredit} onChange={(e) => setUseCredit(e.target.checked)} />
              استعمل رصيدي ({quote.creditBalanceDzd} دج)
            </span>
            <span className="shrink-0 whitespace-nowrap tabular-nums">−{quote.creditDzd} دج</span>
          </label>
        ) : null}
        <p className="flex justify-between border-t pt-2 text-base font-bold">
          <span>{payNow ? 'الإجمالي (يُدفع الآن بالبطاقة)' : 'الإجمالي (الدفع عند الاستلام)'}</span>
          <span className="shrink-0 whitespace-nowrap tabular-nums text-primary">{total} دج</span>
        </p>
      </div>
      <Alert tone="info">
        <span className="flex items-center gap-2">
          <Truck className="size-5 shrink-0" /> {payNow ? 'تُفعَّل الدورة لحساب التلميذ فور تأكّد الدفع، ويُشحن الكتاب بعدها.' : 'تُفعَّل الدورة بعد تأكيد شركة التوصيل تسليم الكتاب لحساب التلميذ نفسه.'}
        </span>
      </Alert>
      {payNow ? null : <Alert tone={data.smsReady ? 'warning' : 'info'}>
        {data.smsReady ? 'سيصلك رمز تأكيد على هذا الرقم. الطلبات الوهمية تُلغى ويُمنع صاحبها من الطلب.' : 'سنتصل بك على هذا الرقم لتأكيد الطلب قبل الإرسال.'}
      </Alert>}
      {!ready && !pending && missing.length ? (
        <p id="order-missing" className="text-sm text-muted-foreground" aria-live="polite">
          لإكمال الطلب: {missing.join('، ')}.
        </p>
      ) : null}
      <Button className="w-full" size="lg" onClick={submit} loading={pending} disabled={!ready} aria-describedby={!ready && missing.length ? 'order-missing' : undefined}>
        {payNow ? `ادفع الآن — ${total} دج` : `تأكيد الطلب — ${total} دج`}
      </Button>
    </div>
  )
}
