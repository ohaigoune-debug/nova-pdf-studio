'use client'

import { useActionState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Alert } from '@/components/ui/misc'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useT } from '@/i18n/client'
import { forgotPasswordAction } from '@/server/actions/auth.actions'
import { PhoneRecoveryForm } from './phone-recovery-form'

export function ForgotForm() {
  return (
    <Tabs defaultValue="email" dir="rtl">
      <TabsList className="grid w-full grid-cols-2" aria-label="طريقة استعادة كلمة السر">
        <TabsTrigger value="email">عبر البريد</TabsTrigger>
        <TabsTrigger value="phone">عبر الهاتف</TabsTrigger>
      </TabsList>
      <TabsContent value="email">
        <EmailForgotForm />
      </TabsContent>
      <TabsContent value="phone">
        <PhoneRecoveryForm />
      </TabsContent>
    </Tabs>
  )
}

function EmailForgotForm() {
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
