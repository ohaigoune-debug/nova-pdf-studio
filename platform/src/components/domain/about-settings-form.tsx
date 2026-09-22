'use client'

import { useActionState, useEffect } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Input, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'
import { updateAboutAction } from '@/server/actions/admin.actions'
import type { AboutSettings } from '@/server/services/about.service'

export function AboutSettingsForm({ value }: { value: AboutSettings }) {
  const [state, action] = useActionState(updateAboutAction, null)
  useEffect(() => {
    if (state?.ok) toast('success', t('about.saved'))
  }, [state])
  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('about.hint')}</p>
      <Field label={t('about.name')} htmlFor="about-name" error={fieldError(state, 'name')}>
        <Input id="about-name" name="name" defaultValue={value.name} maxLength={80} />
      </Field>
      <Field label={t('about.jobTitle')} htmlFor="about-title" hint={t('about.jobTitleHint')} error={fieldError(state, 'title')}>
        <Input id="about-title" name="title" defaultValue={value.title} maxLength={120} />
      </Field>
      <Field label={t('about.bio')} htmlFor="about-bio" hint={t('about.bioHint')} error={fieldError(state, 'bio')}>
        <Textarea id="about-bio" name="bio" defaultValue={value.bio} maxLength={600} rows={3} />
      </Field>
      <Field label={t('about.quote')} htmlFor="about-quote" hint={t('about.quoteHint')} error={fieldError(state, 'quote')}>
        <Input id="about-quote" name="quote" defaultValue={value.quote} maxLength={240} />
      </Field>
      <FormError state={state} />
      <SubmitButton>{t('common.save')}</SubmitButton>
    </form>
  )
}
