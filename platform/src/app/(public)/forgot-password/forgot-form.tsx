'use client'

import { useActionState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Alert } from '@/components/ui/misc'
import { useT } from '@/i18n/client'
import { forgotPasswordAction } from '@/server/actions/auth.actions'

export function ForgotForm() {
  const t = useT()
  const [state, action] = useActionState(forgotPasswordAction, null)
  if (state?.ok) return <Alert tone="success">{t('auth.forgotSent')}</Alert>
  return (
    <form action={action} className="space-y-4">
      <Field label={t('common.email')} htmlFor="email" error={fieldError(state, 'email')}>
        <Input id="email" name="email" type="email" autoComplete="email" required dir="ltr" />
      </Field>
      <FormError state={state} />
      <SubmitButton className="w-full" size="lg">
        {t('auth.forgotButton')}
      </SubmitButton>
    </form>
  )
}
