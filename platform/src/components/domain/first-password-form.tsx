'use client'

import { useActionState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { setFirstPasswordAction } from '@/server/actions/auth.actions'

/** إنشاء أول كلمة سر (حساب سجّل دون كلمة سر): كلمة السر وتأكيدها فقط */
export function FirstPasswordForm({ next }: { next?: string }) {
  const [state, action] = useActionState(setFirstPasswordAction, null)
  return (
    <form action={action} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label="كلمة السر الجديدة" htmlFor="fp-password" hint="8 أحرف على الأقل — حروف وأرقام تتذكّرها" error={fieldError(state, 'password')}>
        <Input id="fp-password" name="password" type="password" autoComplete="new-password" minLength={8} required dir="ltr" />
      </Field>
      <Field label="أعد كتابتها" htmlFor="fp-confirm" error={fieldError(state, 'confirm')}>
        <Input id="fp-confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required dir="ltr" />
      </Field>
      <FormError state={state} />
      <SubmitButton className="w-full" size="lg">
        احفظ كلمة السر
      </SubmitButton>
    </form>
  )
}
