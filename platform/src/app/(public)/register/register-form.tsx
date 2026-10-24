'use client'

import { useActionState, useState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Input, Select } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { useT } from '@/i18n/client'
import { registerAction } from '@/server/actions/auth.actions'

type Opt = { id: string; name: string }

export function RegisterForm({ wilayas, levels, streams }: { wilayas: Opt[]; levels: (Opt & { secondary?: boolean })[]; streams: Opt[] }) {
  const t = useT()
  const [state, action] = useActionState(registerAction, null)
  const [levelId, setLevelId] = useState('')
  const needsStream = Boolean(levels.find((l) => l.id === levelId)?.secondary)
  return (
    <form action={action} className="space-y-4">
      <Field label={t('auth.fullName')} htmlFor="fullName" error={fieldError(state, 'fullName')}>
        <Input id="fullName" name="fullName" autoComplete="name" required />
      </Field>
      <Field label={t('common.email')} htmlFor="email" error={fieldError(state, 'email')}>
        <Input id="email" name="email" type="email" autoComplete="email" required dir="ltr" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="هاتفك" htmlFor="phone" error={fieldError(state, 'phone')} hint="05 / 06 / 07 — يصلك عليه رمز تأكيد">
          <Input id="phone" name="phone" type="tel" autoComplete="tel" dir="ltr" inputMode="tel" placeholder="05XXXXXXXX" required />
        </Field>
        <Field label="هاتف الولي" htmlFor="guardianPhone" error={fieldError(state, 'guardianPhone')} hint="يمكن استلام الكتاب وتفعيل الدورة به">
          <Input id="guardianPhone" name="guardianPhone" type="tel" dir="ltr" inputMode="tel" placeholder="06XXXXXXXX" required />
        </Field>
      </div>
      <Field label={t('common.password')} htmlFor="password" hint={t('auth.passwordHint')} error={fieldError(state, 'password')}>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required dir="ltr" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('common.level')} htmlFor="levelId" error={fieldError(state, 'levelId')}>
          <Select id="levelId" name="levelId" value={levelId} onChange={(e) => setLevelId(e.target.value)} required>
            <option value="">—</option>
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('common.stream')} htmlFor="streamId" error={fieldError(state, 'streamId')} hint={needsStream ? 'لا يمكن طلب كتاب أو دورة لشعبة أخرى' : undefined}>
          <Select id="streamId" name="streamId" defaultValue="" required={needsStream} disabled={Boolean(levelId) && !needsStream}>
            <option value="">—</option>
            {streams.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={t('common.wilaya')} htmlFor="wilayaId" error={fieldError(state, 'wilayaId')}>
        <Select id="wilayaId" name="wilayaId" defaultValue="" required>
          <option value="">—</option>
          {wilayas.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </Select>
      </Field>
      <FormError state={state} />
      <SubmitButton className="w-full" size="lg">
        {t('auth.registerButton')}
      </SubmitButton>
    </form>
  )
}
