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
      if (r.ok) toast('success', 'الاتصال بـ Guiddini ناجح', 'المفاتيح مقبولة')
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
      <Field label="x-app-key" htmlFor="g-key" hint={view ? `المحفوظ ينتهي بـ …${view.appKeyHint}` : 'من لوحة Guiddini'}>
        <Input id="g-key" name="appKey" required dir="ltr" autoComplete="off" placeholder={view ? '(الصق المفتاح من جديد)' : ''} />
      </Field>
      <Field label="x-app-secret" htmlFor="g-secret" hint={view?.secretHint ? `محفوظ ومختوم (…${view.secretHint}). اتركه فارغًا لإبقائه.` : 'يُحفظ مختومًا ولا يظهر بعد الحفظ'}>
        <Input id="g-secret" name="appSecret" type="password" dir="ltr" autoComplete="new-password" required={!view} />
      </Field>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">عنوان البوابة (لا تغيّره إلا إن طلبت Guiddini ذلك)</summary>
        <Input className="mt-2" name="baseUrl" defaultValue={view?.baseUrl ?? defaultBase} dir="ltr" />
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
