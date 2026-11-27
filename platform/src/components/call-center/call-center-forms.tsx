'use client'

import { CheckCircle2, Copy, KeyRound, PhoneCall, Play, RefreshCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useState, useTransition } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { CC_RULES, RULE_AR } from '@/lib/call-center'
import { resolveInboundAction, resolveTaskAction, retryTaskAction, rotateAgentTokenAction, runTickNowAction, saveCallCenterSettingsAction, simulateRoundAction } from '@/server/actions/call-center.actions'
import type { PublicCallCenterConfig } from '@/server/services/call-center.service'

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

const MODE_AR = { off: 'متوقف', test: 'تجربة (أرقامي فقط)', live: 'تشغيل حقيقي' } as const

/** إعدادات مركز الاتصال (المشرف وحده) */
export function CallCenterSettingsForm({ config }: { config: PublicCallCenterConfig }) {
  const router = useRouter()
  const [state, action] = useActionState(saveCallCenterSettingsAction, null)
  useEffect(() => {
    if (state?.ok) {
      toast('success', `حُفظت الإعدادات — الوضع: ${MODE_AR[state.data.mode]}`)
      router.refresh()
    }
  }, [state, router])
  const c = state?.ok ? state.data : config
  return (
    <form action={action} className="space-y-5 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="الوضع" htmlFor="cc-mode" error={fieldError(state, 'mode')} hint="التجربة: يُخطَّط كل شيء، ولا يُتّصل ولا يُراسَل إلا أرقام التجربة. الباقي يظهر «محاكاة».">
          <Select id="cc-mode" name="mode" defaultValue={c.mode}>
            <option value="off">{MODE_AR.off}</option>
            <option value="test">{MODE_AR.test}</option>
            <option value="live">{MODE_AR.live}</option>
          </Select>
        </Field>
        <Field label="أرقام التجربة" htmlFor="cc-test" error={fieldError(state, 'testPhones')} hint="أرقامك أنت، مفصولة بفاصلة (05/06/07)">
          <Input id="cc-test" name="testPhones" dir="ltr" defaultValue={c.testPhones.join(', ')} placeholder="0550000000, 0660000000" />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="شرائح الصادر" htmlFor="cc-out" error={fieldError(state, 'outboundSims')} hint="أرقام المنافذ في الجهاز، مثل 1, 2, 3">
          <Input id="cc-out" name="outboundSims" dir="ltr" defaultValue={c.outboundSims.join(', ')} />
        </Field>
        <Field label="شريحة الوارد (الرقم الرسمي)" htmlFor="cc-in" error={fieldError(state, 'inboundSim')}>
          <Input id="cc-in" name="inboundSim" type="number" min={1} max={32} dir="ltr" defaultValue={c.inboundSim} />
        </Field>
        <Field label="سقف المكالمات لكل شريحة يوميًا" htmlFor="cc-cap" error={fieldError(state, 'dailyCapPerSim')}>
          <Input id="cc-cap" name="dailyCapPerSim" type="number" min={1} max={1000} dir="ltr" defaultValue={c.dailyCapPerSim} />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="من الساعة" htmlFor="cc-qs" error={fieldError(state, 'quietStart')}>
          <Input id="cc-qs" name="quietStart" type="time" dir="ltr" defaultValue={hhmm(c.quietStart)} />
        </Field>
        <Field label="إلى الساعة" htmlFor="cc-qe">
          <Input id="cc-qe" name="quietEnd" type="time" dir="ltr" defaultValue={hhmm(c.quietEnd)} />
        </Field>
        <Field label="محاولات المكالمة" htmlFor="cc-att" hint="بعد ساعتين، ثم في الغد">
          <Input id="cc-att" name="maxCallAttempts" type="number" min={1} max={6} dir="ltr" defaultValue={c.maxCallAttempts} />
        </Field>
        <Field label="مكالمة المنزل بعد (ساعة)" htmlFor="cc-stuck">
          <Input id="cc-stuck" name="homeStuckHours" type="number" min={6} max={240} dir="ltr" defaultValue={c.homeStuckHours} />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="الرسائل القصيرة تخرج من" htmlFor="cc-sms" hint="المزوّد المربوط اليوم، أو شرائح الجهاز">
          <Select id="cc-sms" name="smsChannel" defaultValue={c.smsChannel}>
            <option value="provider">مزوّد الرسائل المربوط بالمنصة</option>
            <option value="gateway">شرائح الجهاز (Yeastar)</option>
          </Select>
        </Field>
        <Field label="مكالمة التأكيد عند مبلغ يبلغ (دج)" htmlFor="cc-amt" hint="0 = لا شرط على المبلغ">
          <Input id="cc-amt" name="confirmAmountDzd" type="number" min={0} dir="ltr" defaultValue={c.confirmSpecial.amountDzd} />
        </Field>
      </div>

      <fieldset className="space-y-2 rounded-lg border p-3">
        <legend className="px-1 font-semibold">القواعد</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {CC_RULES.map((r) => (
            <label key={r} className="flex items-center gap-2">
              <input type="checkbox" name={`rule_${r}`} className="size-4" defaultChecked={c.rules[r]} /> {RULE_AR[r]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="رسالة: الطرد في المكتب" htmlFor="cc-desk" error={fieldError(state, 'deskArrivedText')} hint="{order} رقم الطلب، {office} المكتب إن عُرف">
          <Textarea id="cc-desk" name="deskArrivedText" defaultValue={c.texts.deskArrived} />
        </Field>
        <Field label="رسالة: الطرد مع عون التوصيل" htmlFor="cc-home" error={fieldError(state, 'homeArrivedText')} hint="{order} رقم الطلب">
          <Textarea id="cc-home" name="homeArrivedText" defaultValue={c.texts.homeArrived} />
        </Field>
      </div>
      <FormError state={state} />
      <SubmitButton>حفظ الإعدادات</SubmitButton>
    </form>
  )
}

/** رمز الصندوق المحلي: يُنشأ ويُعرض مرة واحدة */
export function AgentTokenCard({ paired, hint }: { paired: boolean; hint: string | null }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [token, setToken] = useState<string | null>(null)
  const rotate = () =>
    start(async () => {
      if (paired && !confirm('إنشاء رمز جديد يوقف الرمز القديم فورًا. متابعة؟')) return
      const r = await rotateAgentTokenAction()
      if (!r.ok) return toast('error', r.error.message)
      setToken(r.data.token)
      router.refresh()
    })
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <KeyRound className="size-4 text-primary" />
        {paired ? <Badge variant="success">مقترن · …{hint}</Badge> : <Badge variant="muted">لا رمز بعد</Badge>}
        <Button type="button" size="sm" variant="outline" loading={pending} onClick={rotate}>
          <RefreshCcw className="size-4" /> {paired ? 'رمز جديد' : 'إنشاء الرمز'}
        </Button>
      </div>
      {token ? (
        <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
          <p className="font-semibold">انسخ الرمز الآن وضعه في إعداد الصندوق المحلي. لن يُعرض مرة أخرى.</p>
          <div className="flex items-center gap-2">
            <code dir="ltr" className="min-w-0 flex-1 truncate rounded bg-card px-2 py-1 font-mono text-xs">
              {token}
            </code>
            <Button type="button" size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(token).then(() => toast('success', 'نُسخ'))}>
              <Copy className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** «شغّل الدورة الآن» و«محاكاة دورة» (وضع التجربة) */
export function CallCenterRunButtons({ mode }: { mode: 'off' | 'test' | 'live' }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const tick = () =>
    start(async () => {
      const r = await runTickNowAction()
      if (!r.ok) return toast('error', r.error.message)
      toast('success', r.data.skipped === 'off' ? 'مركز الاتصال متوقف' : `مهام جديدة ${r.data.created} · رسائل ${r.data.smsSent} · محاكاة ${r.data.simulated}`)
      router.refresh()
    })
  const simulate = () =>
    start(async () => {
      const r = await simulateRoundAction()
      if (!r.ok) return toast('error', r.error.message)
      toast('success', `محاكاة: سُحبت ${r.data.claimed} · ردّ ${r.data.answered} · لم يردّ ${r.data.noAnswer}`)
      router.refresh()
    })
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" loading={pending} disabled={mode === 'off'} onClick={tick}>
        <RefreshCcw className="size-4" /> شغّل الدورة الآن
      </Button>
      <Button type="button" variant="secondary" loading={pending} disabled={mode !== 'test'} onClick={simulate}>
        <Play className="size-4" /> محاكاة الجهاز (بلا مكالمات)
      </Button>
    </div>
  )
}

/** إغلاق حالة في طابور الموظف بملاحظة، أو «اتصل الآن» */
export function HumanTaskActions({ id, canRetry }: { id: string; canRetry: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [note, setNote] = useState('')
  const done = () =>
    start(async () => {
      const r = await resolveTaskAction(id, note)
      if (!r.ok) return toast('error', r.error.message)
      toast('success', 'أُغلقت الحالة')
      router.refresh()
    })
  const retry = () =>
    start(async () => {
      const r = await retryTaskAction(id)
      if (!r.ok) return toast('error', r.error.message)
      toast('success', 'أُعيدت إلى طابور المكالمات')
      router.refresh()
    })
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ماذا فعلت؟ (اختياري)" className="h-11 min-w-0 flex-1" maxLength={500} />
      <Button type="button" size="sm" variant="success" loading={pending} onClick={done}>
        <CheckCircle2 className="size-4" /> تمّ
      </Button>
      {canRetry ? (
        <Button type="button" size="sm" variant="outline" loading={pending} onClick={retry}>
          <PhoneCall className="size-4" /> أعد الاتصال الآلي
        </Button>
      ) : null}
    </div>
  )
}

export function InboundActions({ id }: { id: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [note, setNote] = useState('')
  const done = () =>
    start(async () => {
      const r = await resolveInboundAction(id, note)
      if (!r.ok) return toast('error', r.error.message)
      toast('success', 'عولجت المكالمة')
      router.refresh()
    })
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="كيف حُلّ المشكل؟ (اختياري)" className="h-11 min-w-0 flex-1" maxLength={500} />
      <Button type="button" size="sm" variant="success" loading={pending} onClick={done}>
        <CheckCircle2 className="size-4" /> عولجت
      </Button>
    </div>
  )
}
