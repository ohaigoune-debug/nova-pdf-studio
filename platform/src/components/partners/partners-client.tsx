'use client'

import { BellRing, Check, Copy, KeyRound, MessageCircle, Power, Share2, Ticket, Wallet, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useState, useTransition } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { CredentialsBox } from '@/components/pos/pos-admin'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Alert } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import {
  approveApplicationAction,
  attachReferralAction,
  createAffiliateAction,
  recordAffiliatePayoutAction,
  rejectApplicationAction,
  remindCustomerAction,
  resetAffiliatePasswordAction,
  setAffiliateStatusAction,
  setReferralPolicyAction,
  submitPartnerApplicationAction,
  updateAffiliateAction,
  voidRewardAction
} from '@/server/actions/partners.actions'

type Opt = { id: string; name: string }
type Creds = { phone: string; password: string; whatsappUrl: string; code?: string }

async function copyText(text: string, done = 'نُسخ') {
  try {
    await navigator.clipboard.writeText(text)
    toast('success', done)
  } catch {
    toast('error', 'تعذّر النسخ — انسخه يدويًّا')
  }
}

const num = (v: string) => {
  const t = v.replace(/[\s,.]/g, '')
  return t === '' ? null : Number(t)
}

/* ───────────── مشاركة الكود (التلميذ والمسوّق) ───────────── */

export function ShareCodeCard({ code, link, shareText }: { code: string; link: string; shareText: string }) {
  return (
    <div className="space-y-3 text-center">
      <p dir="ltr" className="select-all font-mono text-4xl font-extrabold tracking-widest">
        {code}
      </p>
      <p dir="ltr" className="select-all break-all text-sm text-muted-foreground">
        {link}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="size-4" /> شارك عبر واتساب
          </a>
        </Button>
        <Button variant="outline" onClick={() => copyText(link, 'نُسخ الرابط')}>
          <Share2 className="size-4" /> نسخ الرابط
        </Button>
        <Button variant="outline" onClick={() => copyText(code, 'نُسخ الكود')}>
          <Copy className="size-4" /> نسخ الكود
        </Button>
      </div>
    </div>
  )
}

/** «هل دعاك أحد؟» — يُثبَّت أول كود فقط */
export function ReferralCodeBox({ source, welcomeCreditDzd }: { source: 'CHECKOUT' | 'PAGE'; welcomeCreditDzd: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [code, setCode] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const apply = () =>
    start(async () => {
      const r = await attachReferralAction(code, source)
      if (!r.ok) return toast('error', r.error.message)
      setDone(r.data.code)
      router.refresh()
    })
  if (done)
    return (
      <Alert tone="success" title={`سُجّل الكود ${done}`}>
        {welcomeCreditDzd ? `يُضاف إلى رصيدك ${welcomeCreditDzd} دج هدية بعد استلام أول دورة.` : 'شكرًا لك.'}
      </Alert>
    )
  return (
    <div className="space-y-2 rounded-lg border border-dashed p-3">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Ticket className="size-4 text-primary" /> هل دعاك زميل أو صفحة تتابعها؟
      </p>
      <div className="flex gap-2">
        <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="الكود" dir="ltr" maxLength={24} autoCapitalize="characters" aria-label="كود الدعوة" />
        <Button variant="outline" onClick={apply} loading={pending} disabled={code.trim().length < 4}>
          تطبيق
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{welcomeCreditDzd ? `السعر لا يتغيّر، وتحصل على ${welcomeCreditDzd} دج رصيدًا بعد الاستلام. ` : ''}يُقبل كود واحد فقط ولا يُغيَّر.</p>
    </div>
  )
}

/** «ذكّره»: إشعار من المنصة للتلميذ */
export function RemindButton({ referralId }: { referralId: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const remind = () =>
    start(async () => {
      const r = await remindCustomerAction(referralId)
      if (!r.ok) return toast('error', r.error.message)
      toast('success', 'أرسلنا له تذكيرًا')
      router.refresh()
    })
  return (
    <Button size="sm" variant="outline" onClick={remind} loading={pending}>
      <BellRing className="size-4" /> ذكّره
    </Button>
  )
}

/* ───────────── «كن شريكًا» ───────────── */

export function PartnerApplicationForm({ wilayas }: { wilayas: Opt[] }) {
  const [state, action] = useActionState(submitPartnerApplicationAction, null)
  const [kind, setKind] = useState<'AFFILIATE' | 'POINT_OF_SALE' | 'TEACHER'>('AFFILIATE')
  if (state?.ok)
    return (
      <Alert tone="success" title="وصلنا طلبك">
        {state.data.duplicate ? 'طلبك السابق ما زال قيد المراجعة.' : 'نراجع طلبك ونتصل بك على رقمك قريبًا. إن قُبل تصلك بيانات حسابك عبر واتساب.'}
      </Alert>
    )
  return (
    <form action={action} className="space-y-4">
      <Field label="نوع الشراكة" htmlFor="kind" error={fieldError(state, 'kind')}>
        <Select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="AFFILIATE">مسوّق بالعمولة (صاحب صفحة أو حساب)</option>
          <option value="POINT_OF_SALE">نقطة بيع (مدرسة أو مكتبة)</option>
          <option value="TEACHER">أستاذ</option>
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="الاسم الكامل" htmlFor="fullName" error={fieldError(state, 'fullName')}>
          <Input id="fullName" name="fullName" autoComplete="name" required />
        </Field>
        <Field label="رقم الهاتف (واتساب)" htmlFor="phone" error={fieldError(state, 'phone')}>
          <Input id="phone" name="phone" type="tel" dir="ltr" inputMode="tel" placeholder="05XXXXXXXX" required />
        </Field>
      </div>
      <Field label="الولاية" htmlFor="wilayaId" error={fieldError(state, 'wilayaId')}>
        <Select id="wilayaId" name="wilayaId" defaultValue="">
          <option value="">—</option>
          {wilayas.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </Select>
      </Field>
      {kind === 'AFFILIATE' ? (
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <Field label="رابط صفحتك أو حسابك" htmlFor="socialUrl" error={fieldError(state, 'socialUrl')} hint="إنستغرام، فيسبوك، تيك توك، يوتيوب…">
            <Input id="socialUrl" name="socialUrl" dir="ltr" placeholder="https://instagram.com/..." required />
          </Field>
          <Field label="عدد المتابعين" htmlFor="followers" error={fieldError(state, 'followers')}>
            <Input id="followers" name="followers" inputMode="numeric" dir="ltr" placeholder="1500" />
          </Field>
        </div>
      ) : null}
      {kind === 'POINT_OF_SALE' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="اسم المدرسة أو المكتبة" htmlFor="orgName" error={fieldError(state, 'orgName')}>
            <Input id="orgName" name="orgName" required />
          </Field>
          <Field label="العنوان" htmlFor="address" error={fieldError(state, 'address')}>
            <Input id="address" name="address" />
          </Field>
        </div>
      ) : null}
      {kind === 'TEACHER' ? (
        <Field label="المادة" htmlFor="subject" error={fieldError(state, 'subject')}>
          <Input id="subject" name="subject" />
        </Field>
      ) : null}
      <Field label="رسالة (اختياري)" htmlFor="message" error={fieldError(state, 'message')}>
        <Textarea id="message" name="message" rows={3} maxLength={1000} />
      </Field>
      {/* خانة فخ للروبوتات: لا يراها الإنسان */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <FormError state={state} />
      <SubmitButton className="w-full" size="lg">
        أرسل طلبي
      </SubmitButton>
    </form>
  )
}

/* ───────────── الإدارة ───────────── */

export function AffiliateCreateForm({ wilayas, isAdmin, defaultCommission }: { wilayas: Opt[]; isAdmin: boolean; defaultCommission: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const empty = { fullName: '', phone: '', wilayaId: '', socialUrl: '', followers: '', code: '', commissionDzd: '', note: '' }
  const [f, setF] = useState(empty)
  const [creds, setCreds] = useState<Creds | null>(null)
  const submit = () =>
    start(async () => {
      const r = await createAffiliateAction({ fullName: f.fullName, phone: f.phone, wilayaId: f.wilayaId || null, socialUrl: f.socialUrl || null, followers: num(f.followers), code: f.code || null, commissionDzd: isAdmin ? num(f.commissionDzd) : null, note: f.note || null })
      if (!r.ok) return toast('error', r.error.message)
      setCreds(r.data)
      setF(empty)
      router.refresh()
    })
  if (creds) return <CredentialsBox creds={creds} onClose={() => setCreds(null)} to="للمسوّق" />
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Input placeholder="الاسم الكامل" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} />
      <Input placeholder="الهاتف (يدخل به)" dir="ltr" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      <Input placeholder="رابط صفحته" dir="ltr" value={f.socialUrl} onChange={(e) => setF({ ...f, socialUrl: e.target.value })} />
      <Input placeholder="عدد المتابعين" dir="ltr" inputMode="numeric" value={f.followers} onChange={(e) => setF({ ...f, followers: e.target.value })} />
      <Select value={f.wilayaId} onChange={(e) => setF({ ...f, wilayaId: e.target.value })} aria-label="الولاية">
        <option value="">الولاية —</option>
        {wilayas.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </Select>
      <Input placeholder="الكود (اختياري، مثل AMINE)" dir="ltr" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} />
      {isAdmin ? <Input placeholder={`العمولة (افتراضيًّا ${defaultCommission} دج)`} dir="ltr" inputMode="numeric" value={f.commissionDzd} onChange={(e) => setF({ ...f, commissionDzd: e.target.value })} /> : null}
      <Input placeholder="ملاحظة" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      <Button className="sm:col-span-2" onClick={submit} loading={pending} disabled={f.fullName.trim().length < 2 || f.phone.trim().length < 9}>
        أنشئ الحساب والكود
      </Button>
    </div>
  )
}

export function ApplicationActions({ id, kind, isAdmin }: { id: string; kind: 'AFFILIATE' | 'POINT_OF_SALE' | 'TEACHER'; isAdmin: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [code, setCode] = useState('')
  const [commission, setCommission] = useState('')
  const [creds, setCreds] = useState<Creds | null>(null)
  const approve = () =>
    start(async () => {
      if (!window.confirm(kind === 'TEACHER' ? 'تعليم الطلب مقبولًا (يتواصل معه المشرف)؟' : 'قبول الطلب وإنشاء الحساب الآن؟')) return
      const r = await approveApplicationAction(id, { code: code || null, commissionDzd: isAdmin ? num(commission) : null })
      if (!r.ok) return toast('error', r.error.message)
      if (r.data.kind === 'AFFILIATE') setCreds(r.data.credentials)
      else if (r.data.kind === 'POINT_OF_SALE') setCreds(r.data.credentials)
      else {
        toast('success', 'قُبل الطلب')
        router.refresh()
      }
    })
  const reject = () =>
    start(async () => {
      const note = window.prompt('سبب الرفض (اختياري):') ?? undefined
      if (note === undefined) return
      const r = await rejectApplicationAction(id, note || null)
      if (!r.ok) return toast('error', r.error.message)
      toast('success', 'رُفض الطلب')
      router.refresh()
    })
  if (creds)
    return (
      <CredentialsBox
        creds={creds}
        to={kind === 'AFFILIATE' ? 'للمسوّق' : 'للمدرسة'}
        onClose={() => {
          setCreds(null)
          router.refresh()
        }}
      />
    )
  return (
    <div className="flex flex-wrap items-center gap-2">
      {kind === 'AFFILIATE' ? <Input className="h-9 w-28" placeholder="الكود" dir="ltr" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} aria-label="الكود" /> : null}
      {kind === 'AFFILIATE' && isAdmin ? <Input className="h-9 w-28" placeholder="العمولة" dir="ltr" inputMode="numeric" value={commission} onChange={(e) => setCommission(e.target.value)} aria-label="العمولة" /> : null}
      <Button size="sm" onClick={approve} loading={pending}>
        <Check className="size-4" /> قبول
      </Button>
      <Button size="sm" variant="ghost" onClick={reject} loading={pending}>
        <XCircle className="size-4 text-destructive" /> رفض
      </Button>
    </div>
  )
}

export function AffiliateEditForm({ id, values, wilayas, isAdmin }: { id: string; values: { socialUrl: string | null; followers: number | null; wilayaId: string | null; note: string | null; code: string; commissionDzd: number }; wilayas: Opt[]; isAdmin: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [f, setF] = useState({ socialUrl: values.socialUrl ?? '', followers: values.followers?.toString() ?? '', wilayaId: values.wilayaId ?? '', note: values.note ?? '', code: values.code, commissionDzd: String(values.commissionDzd) })
  const save = () =>
    start(async () => {
      const r = await updateAffiliateAction(id, { socialUrl: f.socialUrl || null, followers: num(f.followers), wilayaId: f.wilayaId || null, note: f.note || null, code: f.code !== values.code ? f.code : null, commissionDzd: isAdmin ? num(f.commissionDzd) : null })
      if (!r.ok) return toast('error', r.error.message)
      toast('success', 'حُفظ')
      router.refresh()
    })
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="الكود" htmlFor="aff-code" hint="من سُجّل بالكود القديم يبقى منسوبًا إليه">
        <Input id="aff-code" dir="ltr" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} />
      </Field>
      <Field label="العمولة عن كل تلميذ (دج)" htmlFor="aff-commission" hint={isAdmin ? 'للتلاميذ القادمين؛ ما استُحق لا يتغيّر' : 'يغيّرها المشرف وحده'}>
        <Input id="aff-commission" dir="ltr" inputMode="numeric" value={f.commissionDzd} disabled={!isAdmin} onChange={(e) => setF({ ...f, commissionDzd: e.target.value })} />
      </Field>
      <Field label="رابط صفحته" htmlFor="aff-social">
        <Input id="aff-social" dir="ltr" value={f.socialUrl} onChange={(e) => setF({ ...f, socialUrl: e.target.value })} />
      </Field>
      <Field label="المتابعون" htmlFor="aff-followers">
        <Input id="aff-followers" dir="ltr" inputMode="numeric" value={f.followers} onChange={(e) => setF({ ...f, followers: e.target.value })} />
      </Field>
      <Field label="الولاية" htmlFor="aff-wilaya">
        <Select id="aff-wilaya" value={f.wilayaId} onChange={(e) => setF({ ...f, wilayaId: e.target.value })}>
          <option value="">—</option>
          {wilayas.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="ملاحظة" htmlFor="aff-note">
        <Input id="aff-note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      </Field>
      <Button className="sm:col-span-2" onClick={save} loading={pending}>
        حفظ
      </Button>
    </div>
  )
}

export function AffiliateStatusButton({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const active = status === 'ACTIVE'
  const toggle = () =>
    start(async () => {
      if (!window.confirm(active ? 'إيقاف المسوّق؟ كوده لا يقبل تلاميذ جددًا، ويبقى ما استحقّه.' : 'إعادة تفعيل المسوّق وكوده؟')) return
      const r = await setAffiliateStatusAction(id, active ? 'SUSPENDED' : 'ACTIVE')
      if (!r.ok) return toast('error', r.error.message)
      router.refresh()
    })
  return (
    <Button variant={active ? 'outline' : 'default'} onClick={toggle} loading={pending}>
      <Power className="size-4" /> {active ? 'إيقاف الكود' : 'تفعيل الكود'}
    </Button>
  )
}

export function AffiliateResetButton({ id }: { id: string }) {
  const [pending, start] = useTransition()
  const [creds, setCreds] = useState<Creds | null>(null)
  const reset = () =>
    start(async () => {
      if (!window.confirm('كلمة سر جديدة لهذا المسوّق؟ القديمة تتوقف.')) return
      const r = await resetAffiliatePasswordAction(id)
      if (!r.ok) return toast('error', r.error.message)
      setCreds(r.data)
    })
  if (creds) return <CredentialsBox creds={creds} onClose={() => setCreds(null)} to="للمسوّق" />
  return (
    <Button variant="outline" onClick={reset} loading={pending}>
      <KeyRound className="size-4" /> كلمة سر جديدة
    </Button>
  )
}

export function AffiliatePayoutForm({ id, dueDzd }: { id: string; dueDzd: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [f, setF] = useState({ amount: dueDzd > 0 ? String(dueDzd) : '', note: '' })
  const pay = () =>
    start(async () => {
      const amountDzd = Number(f.amount)
      if (!window.confirm(`تسجيل دفع ${amountDzd} دج للمسوّق؟ القيد لا يُحذف.`)) return
      const r = await recordAffiliatePayoutAction(id, { amountDzd, note: f.note || null })
      if (!r.ok) return toast('error', r.error.message)
      toast('success', 'سُجّل الدفع')
      setF({ amount: '', note: '' })
      router.refresh()
    })
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
      <Input placeholder="المبلغ" dir="ltr" inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} aria-label="المبلغ" />
      <Input placeholder="ملاحظة (بريدي موب، نقدًا…)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} aria-label="ملاحظة" />
      <Button onClick={pay} loading={pending} disabled={!(Number(f.amount) > 0)}>
        <Wallet className="size-4" /> سجّل الدفع
      </Button>
    </div>
  )
}

export function VoidRewardButton({ rewardId, affiliateId }: { rewardId: string; affiliateId?: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const run = () =>
    start(async () => {
      const reason = window.prompt('سبب إلغاء المكافأة (يُحفظ في السجل):')
      if (!reason) return
      const r = await voidRewardAction(rewardId, reason, affiliateId ?? null)
      if (!r.ok) return toast('error', r.error.message)
      toast('success', 'أُلغيت المكافأة')
      router.refresh()
    })
  return (
    <Button size="sm" variant="ghost" onClick={run} loading={pending}>
      <XCircle className="size-4 text-destructive" /> إلغاء
    </Button>
  )
}

export function ReferralPolicyForm({ policy }: { policy: { enabled: boolean; affiliateDefaultDzd: number; referrerCreditDzd: number; welcomeCreditDzd: number; creditMonths: number; holdDays: number } }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [f, setF] = useState({ ...policy, affiliateDefaultDzd: String(policy.affiliateDefaultDzd), referrerCreditDzd: String(policy.referrerCreditDzd), welcomeCreditDzd: String(policy.welcomeCreditDzd), creditMonths: String(policy.creditMonths), holdDays: String(policy.holdDays) })
  const save = () =>
    start(async () => {
      const r = await setReferralPolicyAction({ enabled: f.enabled, affiliateDefaultDzd: Number(f.affiliateDefaultDzd), referrerCreditDzd: Number(f.referrerCreditDzd), welcomeCreditDzd: Number(f.welcomeCreditDzd), creditMonths: Number(f.creditMonths), holdDays: Number(f.holdDays) })
      if (!r.ok) return toast('error', r.error.message)
      toast('success', 'حُفظت الإعدادات')
      router.refresh()
    })
  const n = (k: 'affiliateDefaultDzd' | 'referrerCreditDzd' | 'welcomeCreditDzd' | 'creditMonths' | 'holdDays', label: string, hint?: string) => (
    <Field label={label} htmlFor={`pol-${k}`} hint={hint}>
      <Input id={`pol-${k}`} dir="ltr" inputMode="numeric" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </Field>
  )
  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" className="size-4" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} /> البرنامج مفعّل (يقبل أكوادًا جديدة)
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        {n('affiliateDefaultDzd', 'عمولة المسوّق الافتراضية (دج نقدًا)', 'للمسوّقين الجدد')}
        {n('referrerCreditDzd', 'رصيد التلميذ الداعي (دج)')}
        {n('welcomeCreditDzd', 'الرصيد الترحيبي للتلميذ الجديد (دج)')}
        {n('creditMonths', 'صلاحية الرصيد (أشهر)')}
        {n('holdDays', 'مهلة الإرجاع قبل دفع العمولة (أيام)')}
      </div>
      <Button onClick={save} loading={pending}>
        حفظ الإعدادات
      </Button>
    </div>
  )
}
