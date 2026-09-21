'use client'

import { useActionState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { useT } from '@/i18n/client'
import { changePasswordAction } from '@/server/actions/auth.actions'

/** تغيير كلمة السر من داخل الحساب — يصلح لكل الأدوار */
export function ChangePasswordCard() {
  const t = useT()
  const [state, action] = useActionState(changePasswordAction, null)
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('auth.changeTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">{t('auth.changeSubtitle')}</p>
        <form action={action} className="space-y-4">
          <Field label={t('auth.currentPassword')} htmlFor="current" error={fieldError(state, 'current')}>
            <Input id="current" name="current" type="password" autoComplete="current-password" required dir="ltr" />
          </Field>
          <Field label={t('auth.newPassword')} htmlFor="password" hint={t('auth.passwordHint')} error={fieldError(state, 'password')}>
            <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} dir="ltr" />
          </Field>
          <Field label={t('auth.confirmPassword')} htmlFor="confirm" error={fieldError(state, 'confirm')}>
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} dir="ltr" />
          </Field>
          <FormError state={state} />
          <SubmitButton>{t('auth.changeButton')}</SubmitButton>
        </form>
      </CardContent>
    </Card>
  )
}
