'use client'

import { useActionState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Input, Select } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { t } from '@/i18n'
import { registerAction } from '@/server/actions/auth.actions'

type Opt = { id: string; name: string }

export function RegisterForm({ code, wilayas, levels, streams }: { code?: string; wilayas: Opt[]; levels: Opt[]; streams: Opt[] }) {
  const [state, action] = useActionState(registerAction, null)
  return (
    <form action={action} className="space-y-4">
      <Field label={t('auth.fullName')} htmlFor="fullName" error={fieldError(state, 'fullName')}>
        <Input id="fullName" name="fullName" autoComplete="name" required />
      </Field>
      <Field label={t('common.email')} htmlFor="email" error={fieldError(state, 'email')}>
        <Input id="email" name="email" type="email" autoComplete="email" required dir="ltr" />
      </Field>
      <Field label={`${t('common.phone')} (${t('common.optional')})`} htmlFor="phone">
        <Input id="phone" name="phone" type="tel" autoComplete="tel" dir="ltr" />
      </Field>
      <Field label={t('common.password')} htmlFor="password" hint={t('auth.passwordHint')} error={fieldError(state, 'password')}>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required dir="ltr" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('common.level')} htmlFor="levelId">
          <Select id="levelId" name="levelId" defaultValue="">
            <option value="">—</option>
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('common.stream')} htmlFor="streamId">
          <Select id="streamId" name="streamId" defaultValue="">
            <option value="">—</option>
            {streams.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={t('common.wilaya')} htmlFor="wilayaId">
        <Select id="wilayaId" name="wilayaId" defaultValue="">
          <option value="">—</option>
          {wilayas.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={`${t('activate.codeLabel')} (${t('common.optional')})`} htmlFor="code" hint="إن كان لديك كود من أستاذك، أدخله الآن وسننقلك لتفعيله مباشرة.">
        <Input id="code" name="code" defaultValue={code ?? ''} placeholder={t('activate.codePlaceholder')} dir="ltr" className="font-mono uppercase" />
      </Field>
      <FormError state={state} />
      <SubmitButton className="w-full" size="lg">
        {t('auth.registerButton')}
      </SubmitButton>
    </form>
  )
}
