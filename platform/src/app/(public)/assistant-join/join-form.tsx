'use client'

import { useActionState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { useT } from '@/i18n/client'
import { joinAssistantAction } from '@/server/actions/assistants.actions'

export function JoinAssistantForm({ code, email }: { code?: string; email?: string }) {
  const t = useT()
  const [state, action] = useActionState(joinAssistantAction, null)
  return (
    <form action={action} className="space-y-4">
      <Field label={t('assistant.codeLabel')} htmlFor="code" error={fieldError(state, 'code')}>
        <Input
          id="code"
          name="code"
          defaultValue={code ?? ''}
          placeholder={t('activate.codePlaceholder')}
          required
          dir="ltr"
          autoFocus={!code}
          className="h-14 text-center font-mono text-2xl uppercase tracking-[0.3em]"
          autoComplete="off"
        />
      </Field>
      <Field label={t('common.email')} htmlFor="email" error={fieldError(state, 'email')}>
        <Input id="email" name="email" type="email" defaultValue={email ?? ''} autoComplete="email" required dir="ltr" />
      </Field>
      <Field label={t('auth.fullName')} htmlFor="fullName" error={fieldError(state, 'fullName')}>
        <Input id="fullName" name="fullName" autoComplete="name" required />
      </Field>
      <Field label={t('assistant.passwordLabel')} htmlFor="password" hint={t('assistant.passwordHint')} error={fieldError(state, 'password')}>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required dir="ltr" />
      </Field>
      <FormError state={state} />
      <SubmitButton className="w-full" size="lg">
        {t('assistant.joinButton')}
      </SubmitButton>
    </form>
  )
}
