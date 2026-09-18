'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Alert } from '@/components/ui/misc'
import { t } from '@/i18n'
import { loginAction } from '@/server/actions/auth.actions'

const DEMO = [
  { label: 'مشرف', email: 'admin@madrasa.dz', password: 'Admin@12345' },
  { label: 'أستاذ', email: 'osama@madrasa.dz', password: 'Teacher@12345' },
  { label: 'طالب', email: 'mohamed@madrasa.dz', password: 'Student@12345' }
]

export function LoginForm({ next, showDemo, resetDone = false }: { next?: string; showDemo: boolean; resetDone?: boolean }) {
  const [state, action] = useActionState(loginAction, null)
  return (
    <form action={action} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label={t('common.email')} htmlFor="email" error={fieldError(state, 'email')}>
        <Input id="email" name="email" type="email" autoComplete="email" required dir="ltr" />
      </Field>
      <Field label={t('common.password')} htmlFor="password" error={fieldError(state, 'password')}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required dir="ltr" />
      </Field>
      <div className="text-end text-xs">
        <Link href="/forgot-password" className="text-primary hover:underline">
          {t('auth.forgot')}
        </Link>
      </div>
      {resetDone ? <Alert tone="success">{t('auth.resetDone')}</Alert> : null}
      <FormError state={state} />
      <SubmitButton className="w-full" size="lg">
        {t('auth.loginButton')}
      </SubmitButton>
      {showDemo ? (
        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          <p className="mb-2 font-bold">{t('auth.demoAccounts')} (بعد `npm run db:seed`)</p>
          <ul className="space-y-1" dir="ltr">
            {DEMO.map((d) => (
              <li key={d.email} className="flex justify-between font-mono">
                <span>{d.email}</span>
                <span>{d.password}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </form>
  )
}
