'use client'

import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { useActionState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { t } from '@/i18n'
import { activateCodeAction } from '@/server/actions/auth.actions'

export function ActivateForm({ code }: { code?: string }) {
  const [state, action] = useActionState(activateCodeAction, null)
  if (state?.ok) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto size-14 text-success" />
        <p className="text-lg font-bold">{t('activate.success', { group: state.data.groupName })}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button asChild>
            <Link href="/student">{t('nav.dashboard')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/student/attendance/card">{t('nav.attendanceCard')}</Link>
          </Button>
        </div>
      </div>
    )
  }
  return (
    <form action={action} className="space-y-4">
      <Field label={t('activate.codeLabel')} htmlFor="code" error={fieldError(state, 'code')}>
        <Input
          id="code"
          name="code"
          defaultValue={code ?? ''}
          placeholder={t('activate.codePlaceholder')}
          required
          dir="ltr"
          autoFocus
          className="h-14 text-center font-mono text-2xl uppercase tracking-[0.3em]"
          autoComplete="off"
        />
      </Field>
      <FormError state={state} />
      <SubmitButton className="w-full" size="lg">
        {t('activate.button')}
      </SubmitButton>
    </form>
  )
}
