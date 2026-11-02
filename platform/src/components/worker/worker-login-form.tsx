'use client'

import { useActionState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { loginAction } from '@/server/actions/auth.actions'

export function WorkerLoginForm() {
  const [state, action] = useActionState(loginAction, null)
  return (
    <form action={action} className="space-y-4 rounded-xl border bg-card p-5">
      <input type="hidden" name="next" value="/worker" />
      <Field label="رقم الهاتف" htmlFor="email" error={fieldError(state, 'email')}>
        <Input id="email" name="email" type="tel" inputMode="tel" autoComplete="username" placeholder="06XXXXXXXX" required dir="ltr" className="h-12 text-lg" />
      </Field>
      <Field label="كلمة السر" htmlFor="password" error={fieldError(state, 'password')}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required dir="ltr" className="h-12 text-lg" />
      </Field>
      <FormError state={state} />
      <SubmitButton className="h-12 w-full text-base" size="lg">
        دخول
      </SubmitButton>
    </form>
  )
}
