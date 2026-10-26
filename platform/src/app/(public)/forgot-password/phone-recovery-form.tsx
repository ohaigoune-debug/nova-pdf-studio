'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { FormError, fieldError } from '@/components/forms/form-bits'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Alert } from '@/components/ui/misc'
import type { ActionResult } from '@/server/lib/action-result'
import { requestPhonePasswordResetAction, resetPasswordByPhoneAction } from '@/server/actions/phone-recovery.actions'

const PHONE_RE = /^0[5-7]\d{8}$/
const normalizedPhone = (value: string) => value.replace(/[\s\-().]/g, '').replace(/^\+?213/, '0')

export function PhoneRecoveryForm() {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [requested, setRequested] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [state, setState] = useState<ActionResult<unknown> | null>(null)
  const [done, setDone] = useState(false)
  const [pending, start] = useTransition()

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  const phoneValue = normalizedPhone(phone)
  const phoneOk = PHONE_RE.test(phoneValue)

  const requestCode = () => {
    setState(null)
    start(async () => {
      try {
        const result = await requestPhonePasswordResetAction({ phone: phoneValue })
        if (!result.ok) return setState(result)
        setRequested(true)
        setCode('')
        setCooldown(result.data.cooldown)
      } catch {
        setState({ ok: false, error: { code: 'INTERNAL', message: 'تعذر الاتصال الآن. أعد المحاولة بعد قليل.' } })
      }
    })
  }

  const resetPassword = () => {
    setState(null)
    start(async () => {
      try {
        const result = await resetPasswordByPhoneAction({ phone: phoneValue, code, password, confirm })
        if (!result.ok) return setState(result)
        setPassword('')
        setConfirm('')
        setCode('')
        setDone(true)
      } catch {
        setState({ ok: false, error: { code: 'INTERNAL', message: 'تعذر الاتصال الآن. أعد المحاولة بعد قليل.' } })
      }
    })
  }

  if (done) {
    return (
      <div className="space-y-4">
        <Alert tone="success">تم تغيير كلمة السر وإنهاء الجلسات السابقة. سجّل الدخول بكلمة السر الجديدة.</Alert>
        <Button asChild className="w-full" size="lg">
          <Link href="/login?reset=1">تسجيل الدخول</Link>
        </Button>
      </div>
    )
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (pending) return
        if (requested) resetPassword()
        else if (phoneOk && cooldown === 0) requestCode()
      }}
    >
      <Field label="رقم الهاتف" htmlFor="recovery-phone" hint="رقم الهاتف الموثّق المرتبط بحسابك" error={fieldError(state, 'phone')}>
        <Input id="recovery-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" placeholder="05XXXXXXXX" value={phone} onChange={(event) => setPhone(event.target.value)} required disabled={requested || pending} />
      </Field>
      {requested ? (
        <>
          <Alert tone="info">إذا كان الرقم مرتبطًا بحساب موثّق فسيصلك رمز لاستعادة كلمة السر. قد تستغرق الرسالة قليلًا؛ يمكنك إعادة الإرسال بعد انتهاء المهلة.</Alert>
          <Field label="رمز التحقق" htmlFor="recovery-code" hint="أدخل الرمز كما وصلك في الرسالة" error={fieldError(state, 'code')}>
            <Input id="recovery-code" name="code" value={code} onChange={(event) => setCode(event.target.value.replace(/[^0-9٠-٩۰-۹]/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" dir="ltr" minLength={4} maxLength={6} required disabled={pending} className="text-center font-mono text-lg tracking-widest" />
          </Field>
          <Field label="كلمة السر الجديدة" htmlFor="recovery-password" hint="8 أحرف على الأقل" error={fieldError(state, 'password')}>
            <Input id="recovery-password" name="password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required disabled={pending} />
          </Field>
          <Field label="تأكيد كلمة السر" htmlFor="recovery-confirm" error={fieldError(state, 'confirm')}>
            <Input id="recovery-confirm" name="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} minLength={8} required disabled={pending} />
          </Field>
        </>
      ) : null}
      <FormError state={state} />
      <Button type="submit" className="w-full" size="lg" loading={pending} disabled={!phoneOk || (!requested && cooldown > 0) || (requested && (code.length < 4 || password.length < 8 || confirm.length < 8))}>
        {requested ? 'تغيير كلمة السر' : cooldown > 0 ? `إرسال الرمز بعد ${cooldown} ث` : 'إرسال رمز الاستعادة'}
      </Button>
      {requested ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={requestCode} disabled={pending || cooldown > 0}>
            {cooldown > 0 ? `إعادة الإرسال بعد ${cooldown} ث` : 'إعادة إرسال الرمز'}
          </Button>
          <Button type="button" variant="ghost" disabled={pending} onClick={() => { setRequested(false); setCode(''); setPassword(''); setConfirm(''); setState(null) }}>
            تغيير الرقم
          </Button>
        </div>
      ) : null}
    </form>
  )
}
