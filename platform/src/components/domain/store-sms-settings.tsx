'use client'

import { MessageSquareText, Send, ShieldCheck, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { formatDateTime } from '@/lib/utils'
import { clearSmsKeyAction, saveSmsKeyAction, setStorePolicyAction, testSmsAction } from '@/server/actions/otp.actions'

interface Props {
  policy: { requireOtp: boolean }
  sms: { provider: string; keySource: 'admin' | 'env' | 'none'; hint: string | null; sender: string | null; updatedAt: string | null; unusable: boolean }
}

const SOURCE: Record<Props['sms']['keySource'], string> = { admin: 'مفتاح من هذه اللوحة', env: 'مفتاح من ملف البيئة', none: 'بلا مفتاح' }

/** سياسة المتجر (OTP عند الطلب) وإعداد الرسائل القصيرة: الحالة، لصق المفتاح، رسالة اختبار. للمشرف العام فقط. */
export function StoreSmsSettings({ policy, sms }: Props) {
  const router = useRouter()
  const [requireOtp, setRequireOtp] = useState(policy.requireOtp)
  const [testPhone, setTestPhone] = useState('')
  const [pending, start] = useTransition()
  const [state, action] = useActionState(saveSmsKeyAction, null)
  const form = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.ok) {
      toast('success', `حُفظ مفتاح الرسائل القصيرة (…${state.data.hint})`)
      form.current?.reset()
      router.refresh()
    }
  }, [state, router])

  const togglePolicy = (v: boolean) => {
    setRequireOtp(v)
    start(async () => {
      const r = await setStorePolicyAction({ requireOtp: v })
      if (!r.ok) {
        setRequireOtp(!v)
        return toast('error', r.error.message)
      }
      toast('success', v ? 'صار التحقق بالهاتف مطلوباً عند الطلب' : 'أُلغي التحقق بالهاتف عند الطلب')
    })
  }

  const clear = () => {
    if (!confirm('حذف مفتاح الرسائل القصيرة المحفوظ هنا؟')) return
    start(async () => {
      const r = await clearSmsKeyAction()
      if (!r.ok) return toast('error', r.error.message)
      toast('success', 'حُذف المفتاح')
      router.refresh()
    })
  }

  const test = () =>
    start(async () => {
      const r = await testSmsAction({ phone: testPhone })
      if (!r.ok) return toast('error', r.error.message)
      toast('success', `أُرسلت رسالة الاختبار عبر «${r.data.provider}»${r.data.provider === 'console' ? ' (تُطبع في سجل الخادم فقط)' : ''}`)
    })

  const providerOk = sms.provider !== 'suivisms' || sms.keySource !== 'none'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquareText className="size-5 text-primary" /> المتجر والرسائل القصيرة
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <label className="flex items-start gap-3 rounded-lg border p-3">
          <input type="checkbox" className="mt-1 size-4" checked={requireOtp} onChange={(e) => togglePolicy(e.target.checked)} disabled={pending} />
          <span>
            <span className="flex items-center gap-1 font-semibold">
              <ShieldCheck className="size-4" /> طلب رمز تحقق بالهاتف قبل إرسال الطلب
            </span>
            <span className="block text-xs text-muted-foreground">من أكّد هاتفه في حسابه سلفاً يُعفى. مُعطَّل افتراضياً حتى يُضبط مزوّد الرسائل.</span>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-3">
          <span className="text-muted-foreground">مزوّد الرسائل القصيرة:</span>
          <Badge variant={providerOk ? 'success' : 'destructive'}>
            <span dir="ltr">{sms.provider}</span>
          </Badge>
          <span className="text-xs text-muted-foreground">({SOURCE[sms.keySource]})</span>
          {sms.provider === 'console' ? <span className="block w-full text-xs text-muted-foreground">الرسائل تُطبع في سجل الخادم فقط. اضبط SMS_PROVIDER=suivisms في البيئة ثم الصق المفتاح هنا.</span> : null}
        </div>

        {sms.hint ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/25 bg-primary/5 p-3">
            <span>
              مفتاح SuiviSMS محفوظ:{' '}
              <span dir="ltr" className="font-mono">
                …{sms.hint}
              </span>
              {sms.sender ? (
                <>
                  {' '}
                  · المرسِل <span dir="ltr">{sms.sender}</span>
                </>
              ) : null}
              {sms.updatedAt ? <span className="block text-xs text-muted-foreground">آخر تحديث: {formatDateTime(new Date(sms.updatedAt))}</span> : null}
              {sms.unusable ? <span className="block text-xs text-destructive">لا يمكن فكّ تشفيره (تغيّر سرّ الخادم): أدخله من جديد.</span> : null}
            </span>
            <Button type="button" size="sm" variant="ghost" onClick={clear} loading={pending}>
              <Trash2 className="size-4" /> حذف
            </Button>
          </div>
        ) : null}

        <form ref={form} action={action} className="space-y-3" autoComplete="off">
          <Field label="مفتاح SuiviSMS" htmlFor="sms-key" error={fieldError(state, 'apiKey')} hint="يُخزَّن مشفّراً ولا يُعرض بعد الحفظ إلا آخر 4 أحرف. يتقدّم على SUIVISMS_API_KEY في البيئة.">
            <Input id="sms-key" name="apiKey" type="password" dir="ltr" required spellCheck={false} autoComplete="new-password" />
          </Field>
          <Field label="اسم المرسِل (اختياري)" htmlFor="sms-sender" error={fieldError(state, 'sender')} hint="حتى 11 حرفاً لاتينياً كما سجّلته لدى المزوّد">
            <Input id="sms-sender" name="sender" dir="ltr" maxLength={11} placeholder="MADRASA" />
          </Field>
          <FormError state={state} />
          <SubmitButton size="sm">حفظ المفتاح</SubmitButton>
        </form>

        <div className="space-y-2 border-t pt-4">
          <Field label="إرسال رسالة اختبار" htmlFor="sms-test" hint="رقم جزائري 05 / 06 / 07 — للتأكد من المزوّد والمفتاح قبل تفعيل التحقق">
            <div className="flex gap-2">
              <Input id="sms-test" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} dir="ltr" inputMode="tel" placeholder="05XXXXXXXX" />
              <Button type="button" variant="outline" onClick={test} loading={pending} disabled={!/^0[5-7]\d{8}$/.test(testPhone.replace(/[\s\-().]/g, ''))}>
                <Send className="size-4" /> إرسال
              </Button>
            </div>
          </Field>
        </div>
      </CardContent>
    </Card>
  )
}
