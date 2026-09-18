'use client'

import { useActionState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { t } from '@/i18n'
import { resetPasswordAction } from '@/server/actions/auth.actions'

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, null)
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label={t('auth.newPassword')} htmlFor="password" hint={t('auth.passwordHint')} error={fieldError(state, 'password')}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} dir="ltr" />
      </Field>
      <Field label={t('auth.confirmPassword')} htmlFor="confirm" error={fieldError(state, 'confirm')}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} dir="ltr" />
      </Field>
      <FormError state={state} />
      <SubmitButton className="w-full" size="lg">
        {t('auth.resetButton')}
      </SubmitButton>
    </form>
  )
}
