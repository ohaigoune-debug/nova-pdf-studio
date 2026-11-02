'use client'

import { useActionState, useTransition } from 'react'
import { FormError, SubmitButton } from '@/components/forms/form-bits'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { clearGuiddiniAction, saveGuiddiniAction, testGuiddiniAction } from '@/server/actions/payment.actions'

export function GuiddiniForm({ view, defaultBase }: { view: { baseUrl: string; appKeyHint: string; secretHint: string; enabled: boolean } | null; defaultBase: string }) {
  const [state, action] = useActionState(saveGuiddiniAction, null)
  const [pending, start] = useTransition()
  const test = () =>
    start(async () => {
      const r = await testGuiddiniAction()
      if (r.ok) toast('success', 'الاتصال بـ eFawtara ناجح', 'المفاتيح مقبولة')
      else toast('error', r.error.message)
    })
  const clear = () =>
    start(async () => {
      if (!window.confirm('حذف مفاتيح الدفع؟ يتوقف «ادفع الآن» فورًا.')) return
      const r = await clearGuiddiniAction()
      if (!r.ok) toast('error', r.error.message)
    })
  return (
    <form action={action} className="space-y-4">
      <Field label="App Key" htmlFor="g-key" hint={view ? `المحفوظ ينتهي بـ …${view.appKeyHint}` : 'يبدأ بـ APP- — من بطاقة «CIB & Edahabia · Délégué» في eFawtara'}>
        <Input id="g-key" name="appKey" required dir="ltr" autoComplete="off" placeholder={view ? '(الصق المفتاح من جديد) APP-…' : 'APP-…'} />
      </Field>
      <Field label="App Secret" htmlFor="g-secret" hint={view?.secretHint ? `محفوظ ومختوم (…${view.secretHint}). اتركه فارغًا لإبقائه.` : 'يبدأ بـ SEC- — يُحفظ مختومًا ولا يظهر بعد الحفظ'}>
        <Input id="g-secret" name="appSecret" type="password" dir="ltr" autoComplete="new-password" required={!view} placeholder="SEC-…" />
      </Field>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">عنوان واجهة eFawtara (لا تغيّره إلا إن طلبت eFawtara ذلك)</summary>
        <Input className="mt-2" name="baseUrl" defaultValue={view?.baseUrl ?? defaultBase} dir="ltr" />
        <p className="mt-1 text-xs text-muted-foreground">عنوان لوحة التحكم (app.efawtara.com) أو عنوان Guiddini القديم يُصحَّح تلقائيًّا إلى {defaultBase}. ورابط العودة يُرسَل تلقائيًّا مع كل طلب.</p>
      </details>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="enabled" className="size-4" defaultChecked={view?.enabled ?? false} /> تفعيل «ادفع الآن» للتلاميذ
      </label>
      <FormError state={state} />
      {state?.ok ? <p className="text-sm text-success" role="status">حُفظ. اضغط «اختبر الاتصال».</p> : null}
      <div className="flex flex-wrap gap-2">
        <SubmitButton>حفظ</SubmitButton>
        {view ? <Button type="button" variant="outline" loading={pending} onClick={test}>اختبر الاتصال</Button> : null}
        {view ? <Button type="button" variant="ghost" disabled={pending} onClick={clear}>حذف المفاتيح</Button> : null}
      </div>
    </form>
  )
}
