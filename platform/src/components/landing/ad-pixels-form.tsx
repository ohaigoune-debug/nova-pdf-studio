'use client'

import { useActionState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { saveAdPixelsAction } from '@/server/actions/landing.actions'

/** معرّفا بكسل Meta و TikTok: فارغ = معطّل؛ يعملان على صفحات الهبوط وصفحة الطلب بعد إرساله فقط */
export function AdPixelsForm({ meta, tiktok }: { meta: string; tiktok: string }) {
  const [state, action] = useActionState(saveAdPixelsAction, null)
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Meta Pixel (فيسبوك وإنستغرام)" htmlFor="px-meta" hint="مدير الأحداث ← مصادر البيانات ← المعرّف (أرقام)." error={fieldError(state, 'meta')}>
          <Input id="px-meta" name="meta" defaultValue={meta} dir="ltr" inputMode="numeric" placeholder="123456789012345" autoComplete="off" />
        </Field>
        <Field label="TikTok Pixel" htmlFor="px-tiktok" hint="مدير الأحداث في TikTok Ads ← Pixel ← المعرّف." error={fieldError(state, 'tiktok')}>
          <Input id="px-tiktok" name="tiktok" defaultValue={tiktok} dir="ltr" autoCapitalize="characters" placeholder="C1A2B3C4D5E6F7G8H9I0" autoComplete="off" />
        </Field>
      </div>
      <FormError state={state} />
      {state?.ok ? <p className="text-sm text-success" role="status">حُفظ. يسري على صفحات الهبوط خلال دقيقة.</p> : null}
      <SubmitButton>حفظ</SubmitButton>
    </form>
  )
}
