'use client'

import { useActionState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { saveIosAppLinkAction } from '@/server/actions/ios-app.actions'

export function IosAppLinkForm({ url }: { url: string }) {
  const [state, action] = useActionState(saveIosAppLinkAction, null)
  return (
    <form action={action} className="space-y-4">
      <Field
        label="رابط التطبيق في App Store"
        htmlFor="ios-url"
        hint="انسخه من App Store بعد موافقة Apple (زر المشاركة ← نسخ الرابط). اتركه فارغًا لإخفاء الزر."
        error={fieldError(state, 'url')}
      >
        <Input id="ios-url" name="url" defaultValue={url} dir="ltr" inputMode="url" placeholder="https://apps.apple.com/dz/app/…/id1234567890" />
      </Field>
      <FormError state={state} />
      {state?.ok ? <p className="text-sm text-success" role="status">حُفظ. يظهر للتلاميذ خلال دقيقة على الأكثر.</p> : null}
      <SubmitButton>حفظ</SubmitButton>
    </form>
  )
}
