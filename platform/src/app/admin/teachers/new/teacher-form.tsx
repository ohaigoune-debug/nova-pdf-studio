'use client'

import { useActionState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { t } from '@/i18n'
import { createTeacherAction } from '@/server/actions/admin.actions'

export function TeacherForm() {
  const [state, action] = useActionState(createTeacherAction, null)
  return (
    <form action={action} className="space-y-4">
      <Field label={t('auth.fullName')} htmlFor="fullName" error={fieldError(state, 'fullName')}>
        <Input id="fullName" name="fullName" required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('common.email')} htmlFor="email" error={fieldError(state, 'email')}>
          <Input id="email" name="email" type="email" required dir="ltr" />
        </Field>
        <Field label={t('common.phone')} htmlFor="phone">
          <Input id="phone" name="phone" type="tel" dir="ltr" />
        </Field>
      </div>
      <Field label={t('common.password')} htmlFor="password" hint={t('auth.passwordHint')} error={fieldError(state, 'password')}>
        <Input id="password" name="password" type="password" minLength={8} required dir="ltr" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('admin.workspaceName')} htmlFor="workspaceName">
          <Input id="workspaceName" name="workspaceName" placeholder="مثال: الأستاذ فلان — قالمة" />
        </Field>
        <Field label={t('admin.subject')} htmlFor="subject">
          <Input id="subject" name="subject" defaultValue="اللغة العربية وآدابها" />
        </Field>
      </div>
      <FormError state={state} />
      <SubmitButton size="lg">{t('common.create')}</SubmitButton>
    </form>
  )
}
