'use client'

import { ShieldCheck, Smartphone } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Alert } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { requestOtpAction, verifyOtpAction } from '@/server/actions/otp.actions'

const PHONE_RE = /^0[5-7]\d{8}$/
const normalize = (p: string) => p.replace(/[\s\-().]/g, '').replace(/^\+?213/, '0')

interface Props {
  purpose: 'REGISTER' | 'ORDER'
  /** الهاتف الابتدائي (من الملف أو نموذج الطلب) */
  phone?: string | null
  /** السماح بتعديل الهاتف داخل البطاقة (التسجيل) أو تثبيته (الطلب) */
  editablePhone?: boolean
  title?: string
  description?: string
  /** يُستدعى بعد نجاح التحقق بالهاتف المؤكَّد */
  onVerified?: (phone: string) => void
  /** إعادة تحميل الصفحة بعد النجاح (لوحة التلميذ) */
  refreshOnVerified?: boolean
  /** جمع الرمز فقط دون التحقق هنا (الطلب يتحقّق منه عند الإرسال) */
  collectOnly?: boolean
  onCode?: (code: string) => void
  className?: string
}

/**
 * بطاقة التحقق بالهاتف: إرسال الرمز، إدخال 6 أرقام، إعادة الإرسال بعد 60 ثانية.
 * الرمز لا يُعرض ولا يُسجَّل في المتصفح؛ الرسائل بالعربية.
 */
export function OtpVerifyCard({ purpose, phone: initialPhone, editablePhone = true, title, description, onVerified, refreshOnVerified, collectOnly, onCode, className }: Props) {
  const router = useRouter()
  const [phone, setPhone] = useState(initialPhone ?? '')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, start] = useTransition()

  useEffect(() => {
    if (initialPhone !== undefined && initialPhone !== null) setPhone(initialPhone)
  }, [initialPhone])

  useEffect(() => {
    if (cooldown <= 0) return
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(id)
  }, [cooldown])

  const normalized = normalize(phone)
  const phoneOk = PHONE_RE.test(normalized)

  const send = () => {
    setError(null)
    if (!phoneOk) return setError('أدخل رقماً جزائرياً صحيحاً يبدأ بـ 05 أو 06 أو 07 (10 أرقام).')
    start(async () => {
      const r = await requestOtpAction({ phone: normalized, purpose })
      if (!r.ok) return setError(r.error.message)
      setSent(true)
      setCode('')
      setCooldown(r.data.cooldown)
      toast('success', 'أُرسل رمز التحقق إلى هاتفك')
    })
  }

  const verify = () => {
    setError(null)
    const c = code.replace(/\D/g, '')
    if (c.length !== 6) return setError('أدخل الرمز المكوّن من 6 أرقام.')
    start(async () => {
      const r = await verifyOtpAction({ phone: normalized, purpose, code: c })
      if (!r.ok) return setError(r.error.message)
      setDone(true)
      toast('success', 'تم تأكيد رقم هاتفك')
      onVerified?.(normalized)
      if (refreshOnVerified) router.refresh()
    })
  }

  if (done)
    return (
      <Alert tone="success" className={className}>
        <ShieldCheck className="me-1 inline size-4" /> رقم الهاتف <span dir="ltr">{normalized}</span> مؤكَّد.
      </Alert>
    )

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Smartphone className="size-5 text-primary" /> {title ?? 'أكّد رقم هاتفك'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {description ? <p className="text-muted-foreground">{description}</p> : null}
        <Field label="رقم الهاتف" htmlFor={`otp-phone-${purpose}`} hint="05 / 06 / 07 — سنرسل إليه رسالة قصيرة برمز التحقق">
          <Input id={`otp-phone-${purpose}`} value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" inputMode="tel" placeholder="05XXXXXXXX" disabled={!editablePhone || (sent && cooldown > 0)} />
        </Field>
        {sent ? (
          <Field label="رمز التحقق" htmlFor={`otp-code-${purpose}`} hint="6 أرقام وصلتك في رسالة قصيرة، صالحة 5 دقائق">
            <Input
              id={`otp-code-${purpose}`}
              value={code}
              onChange={(e) => {
                const c = e.target.value.replace(/\D/g, '').slice(0, 6)
                setCode(c)
                onCode?.(c)
              }}
              dir="ltr"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="text-center font-mono text-lg tracking-[0.5em]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (!collectOnly) verify()
                }
              }}
            />
          </Field>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex flex-wrap items-center gap-2">
          {sent ? (
            <>
              {!collectOnly ? (
                <Button type="button" onClick={verify} loading={pending} disabled={code.length !== 6}>
                  <ShieldCheck className="size-4" /> تأكيد
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={send} disabled={pending || cooldown > 0}>
                {cooldown > 0 ? `إعادة الإرسال بعد ${cooldown} ث` : 'إعادة إرسال الرمز'}
              </Button>
            </>
          ) : (
            <Button type="button" onClick={send} loading={pending} disabled={!phoneOk}>
              إرسال رمز التحقق
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
