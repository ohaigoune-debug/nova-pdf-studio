'use client'

import { Copy, KeyRound, MessageCircle, PackageMinus, PackagePlus, Power, ShoppingBag, Wallet, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useState, useTransition } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import {
  addPosMemberAction,
  cancelPosCodeAction,
  createPosAction,
  generatePosCodeForAction,
  movePosStockAction,
  recordPosPaymentAction,
  resetPosMemberAction,
  setPosMemberActiveAction,
  setPosStatusAction,
  updatePosAction
} from '@/server/actions/pos.actions'

type Opt = { id: string; name: string }
const fmt = (code: string) => `${code.slice(0, 3)} ${code.slice(3, 7)} ${code.slice(7)}`

export interface PosFormValues {
  id?: string
  name: string
  wilayaId: string | null
  address: string | null
  phone: string | null
  listed: boolean
  commissionDzd: number
  lowStockAlert: number
  note: string | null
}

/** إضافة نقطة بيع أو تعديلها. العمولة وحدّ التنبيه يظهران للمشرف وحده (الخادم يتجاهلهما لغيره). */
export function PosForm({ wilayas, values, isAdmin }: { wilayas: Opt[]; values?: PosFormValues; isAdmin: boolean }) {
  const router = useRouter()
  const [state, action] = useActionState(values?.id ? updatePosAction : createPosAction, null)
  useEffect(() => {
    if (!state?.ok) return
    toast('success', values?.id ? 'حُفظت التعديلات' : 'أُضيفت نقطة البيع')
    if (!values?.id) router.push(`/admin/points-of-sale/${state.data.id}`)
    else router.refresh()
  }, [state, values?.id, router])
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {values?.id ? <input type="hidden" name="id" value={values.id} /> : null}
      <Field label="اسم المدرسة أو المكتبة" htmlFor="pos-name" error={fieldError(state, 'name')} className="sm:col-span-2">
        <Input id="pos-name" name="name" required minLength={2} maxLength={120} defaultValue={values?.name ?? ''} />
      </Field>
      <Field label="الولاية" htmlFor="pos-wilaya">
        <Select id="pos-wilaya" name="wilayaId" defaultValue={values?.wilayaId ?? ''}>
          <option value="">—</option>
          {wilayas.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="هاتف النقطة (يظهر للتلاميذ)" htmlFor="pos-phone" error={fieldError(state, 'phone')}>
        <Input id="pos-phone" name="phone" type="tel" dir="ltr" placeholder="05XXXXXXXX" defaultValue={values?.phone ?? ''} />
      </Field>
      <Field label="العنوان" htmlFor="pos-address" className="sm:col-span-2">
        <Input id="pos-address" name="address" maxLength={300} defaultValue={values?.address ?? ''} />
      </Field>
      {isAdmin ? (
        <>
          <Field label="عمولة النقطة عن كل باقة (دج)" htmlFor="pos-commission" error={fieldError(state, 'commissionDzd')}>
            <Input id="pos-commission" name="commissionDzd" type="number" min={0} dir="ltr" defaultValue={values?.commissionDzd ?? 1000} />
          </Field>
          <Field label="نبّهني حين يبقى" htmlFor="pos-low" hint="عدد الباقات">
            <Input id="pos-low" name="lowStockAlert" type="number" min={0} dir="ltr" defaultValue={values?.lowStockAlert ?? 5} />
          </Field>
        </>
      ) : null}
      <Field label="ملاحظة داخلية" htmlFor="pos-note" className="sm:col-span-2">
        <Input id="pos-note" name="note" maxLength={500} defaultValue={values?.note ?? ''} />
      </Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="listed" className="size-4" defaultChecked={values?.listed ?? true} /> تظهر في صفحة «نقاط البيع» للتلاميذ
      </label>
      <div className="sm:col-span-2">
        <FormError state={state} />
      </div>
      <div className="sm:col-span-2">
        <SubmitButton>{values?.id ? 'حفظ' : 'إضافة نقطة البيع'}</SubmitButton>
      </div>
    </form>
  )
}

/** بطاقة الحساب المولَّد: الرقم وكلمة السر مرة واحدة، وزر واتساب جاهز */
function CredentialsBox({ creds, onClose }: { creds: { phone: string; password: string; whatsappUrl: string }; onClose: () => void }) {
  return (
    <div className="space-y-2 rounded-lg border border-success/50 bg-success/5 p-3 text-sm">
      <p className="font-semibold">أرسل هذه البيانات للنقطة (لن تظهر كلمة السر مرة أخرى):</p>
      <p>
        الهاتف: <span dir="ltr" className="font-mono font-bold">{creds.phone}</span> — كلمة السر: <span dir="ltr" className="select-all font-mono font-bold">{creds.password}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <a href={creds.whatsappUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="size-4" /> أرسل عبر واتساب
          </a>
        </Button>
        <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(`${creds.phone} / ${creds.password}`).then(() => toast('success', 'نُسخ')).catch(() => null)}>
          <Copy className="size-4" /> نسخ
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          تم
        </Button>
      </div>
    </div>
  )
}

export function AddMemberForm({ posId }: { posId: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [f, setF] = useState({ fullName: '', phone: '' })
  const [creds, setCreds] = useState<{ phone: string; password: string; whatsappUrl: string } | null>(null)
  const add = () =>
    start(async () => {
      const r = await addPosMemberAction(posId, f)
      if (!r.ok) return toast('error', r.error.message)
      setCreds(r.data)
      setF({ fullName: '', phone: '' })
      router.refresh()
    })
  if (creds) return <CredentialsBox creds={creds} onClose={() => setCreds(null)} />
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
      <Input placeholder="الاسم (المدير، السكرتيرة…)" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} />
      <Input placeholder="هاتفه (اسم الدخول)" type="tel" dir="ltr" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      <Button onClick={add} loading={pending} disabled={f.fullName.trim().length < 2 || f.phone.trim().length < 9}>
        <KeyRound className="size-4" /> ولّد الحساب
      </Button>
    </div>
  )
}

export function MemberActions({ posId, userId, active }: { posId: string; userId: string; active: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [creds, setCreds] = useState<{ phone: string; password: string; whatsappUrl: string } | null>(null)
  const reset = () =>
    start(async () => {
      if (!window.confirm('توليد كلمة سر جديدة؟ القديمة تتوقف فورًا.')) return
      const r = await resetPosMemberAction(userId)
      if (!r.ok) return toast('error', r.error.message)
      setCreds(r.data)
    })
  const toggle = () =>
    start(async () => {
      const r = await setPosMemberActiveAction(posId, userId, !active)
      if (!r.ok) return toast('error', r.error.message)
      router.refresh()
    })
  if (creds) return <CredentialsBox creds={creds} onClose={() => setCreds(null)} />
  return (
    <span className="flex flex-wrap gap-1">
      <Button size="sm" variant="outline" loading={pending} onClick={reset}>
        <KeyRound className="size-4" /> كلمة سر جديدة
      </Button>
      <Button size="sm" variant="ghost" loading={pending} onClick={toggle}>
        <Power className="size-4" /> {active ? 'إيقاف' : 'تفعيل'}
      </Button>
    </span>
  )
}

export function StockForm({ posId, courses }: { posId: string; courses: Opt[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [f, setF] = useState({ courseId: courses[0]?.id ?? '', qty: '', note: '' })
  const go = (sign: 1 | -1) =>
    start(async () => {
      const qty = Math.trunc(Number(f.qty))
      if (!f.courseId || !(qty > 0)) return toast('error', 'اختر الدورة واكتب عدد الباقات')
      if (sign < 0 && !window.confirm(`استرجاع ${qty} باقة لم تُبع من هذه النقطة؟`)) return
      const r = await movePosStockAction(posId, { courseId: f.courseId, qty: sign * qty, note: f.note || null })
      if (!r.ok) return toast('error', r.error.message)
      toast('success', `صار المتبقي عندها ${r.data.remaining}`)
      setF({ ...f, qty: '', note: '' })
      router.refresh()
    })
  if (courses.length === 0) return <p className="text-sm text-muted-foreground">لا دورات منشورة.</p>
  return (
    <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
      <Select value={f.courseId} onChange={(e) => setF({ ...f, courseId: e.target.value })}>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <Input type="number" min={1} inputMode="numeric" placeholder="عدد الباقات" dir="ltr" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} />
      <Input className="sm:col-span-2" placeholder="ملاحظة (اختياري): رقم الطرد، تاريخ الإرسال…" maxLength={300} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button onClick={() => go(1)} loading={pending}>
          <PackagePlus className="size-4" /> سجّل باقات أُرسلت
        </Button>
        <Button variant="outline" onClick={() => go(-1)} loading={pending}>
          <PackageMinus className="size-4" /> استرجاع ما لم يُبع
        </Button>
      </div>
    </div>
  )
}

/** توليد كود نيابة عن النقطة (اتصلت هاتفيًّا): يُحسب بيعًا عليها */
export function GenerateForForm({ posId, courses }: { posId: string; courses: Opt[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '')
  const [last, setLast] = useState<{ code: string; shareText: string } | null>(null)
  const go = () =>
    start(async () => {
      if (!window.confirm('توليد كود نيابة عن هذه النقطة؟ يُحسب بيعًا عليها.')) return
      const r = await generatePosCodeForAction(posId, courseId)
      if (!r.ok) return toast('error', r.error.message)
      setLast({ code: r.data.code, shareText: r.data.shareText })
      router.refresh()
    })
  if (courses.length === 0) return null
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Select className="min-w-48 flex-1" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Button variant="outline" loading={pending} onClick={go}>
          <ShoppingBag className="size-4" /> ولّد كودًا نيابة عنها
        </Button>
      </div>
      {last ? (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span dir="ltr" className="select-all font-mono text-lg font-bold">{fmt(last.code)}</span>
          <Button asChild size="sm" variant="outline">
            <a href={`https://wa.me/?text=${encodeURIComponent(last.shareText)}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-4" /> واتساب
            </a>
          </Button>
        </p>
      ) : null}
    </div>
  )
}

export function PaymentForm({ posId, owedDzd }: { posId: string; owedDzd: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [f, setF] = useState({ amount: '', note: '' })
  const go = () =>
    start(async () => {
      const amountDzd = Math.trunc(Number(f.amount))
      if (!(amountDzd > 0)) return toast('error', 'اكتب المبلغ المستلَم')
      if (!window.confirm(`تسجيل ${amountDzd} دج مستلَمة من هذه النقطة؟ القيد لا يُحذف.`)) return
      const r = await recordPosPaymentAction(posId, { amountDzd, note: f.note || null })
      if (!r.ok) return toast('error', r.error.message)
      toast('success', 'سُجّل المبلغ')
      setF({ amount: '', note: '' })
      router.refresh()
    })
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
      <Input type="number" min={1} inputMode="numeric" dir="ltr" placeholder={owedDzd > 0 ? String(owedDzd) : 'المبلغ'} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
      <Input placeholder="ملاحظة: نقدًا، تحويل CCP رقم…" maxLength={300} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      <Button onClick={go} loading={pending}>
        <Wallet className="size-4" /> سجّل المستلَم
      </Button>
    </div>
  )
}

export function PosStatusButton({ posId, status }: { posId: string; status: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const next = status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
  const go = () =>
    start(async () => {
      if (next === 'SUSPENDED' && !window.confirm('إغلاق توليد الأكواد لهذه النقطة؟')) return
      const r = await setPosStatusAction(posId, next)
      if (!r.ok) return toast('error', r.error.message)
      router.refresh()
    })
  return (
    <Button size="sm" variant={status === 'ACTIVE' ? 'outline' : 'default'} loading={pending} onClick={go}>
      <Power className="size-4" /> {status === 'ACTIVE' ? 'أغلق التوليد' : 'افتح التوليد'}
    </Button>
  )
}

export function CancelCodeButton({ codeId }: { codeId: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const go = () =>
    start(async () => {
      if (!window.confirm('إلغاء هذا الكود؟ تعود الباقة إلى عدّاد النقطة ولا يُحسب عليها.')) return
      const r = await cancelPosCodeAction(codeId)
      if (!r.ok) return toast('error', r.error.message)
      router.refresh()
    })
  return (
    <Button size="sm" variant="ghost" loading={pending} onClick={go}>
      <XCircle className="size-4 text-destructive" /> إلغاء
    </Button>
  )
}
