'use client'

import { useActionState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { useT } from '@/i18n/client'
import { deleteAccountAction } from '@/server/actions/auth.actions'

/** حذف التلميذ حسابه بنفسه — شرط Google Play، وحقّ للتلميذ قبل ذلك */
/** needsPassword=false: حساب أُنشئ بـ Google أو Apple، يؤكَّد حذفه بكتابة كلمة «حذف» */
export function DeleteAccountCard({ needsPassword = true }: { needsPassword?: boolean }) {
  const t = useT()
  const [state, action] = useActionState(deleteAccountAction, null)
  return (
    <Card id="delete" className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-destructive">{t('auth.deleteTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">{t('auth.deleteSubtitle')}</p>
        <form action={action} className="space-y-4">
          {needsPassword ? (
            <Field label={t('common.password')} htmlFor="delete-password" error={fieldError(state, 'password')}>
              <Input id="delete-password" name="password" type="password" autoComplete="current-password" required dir="ltr" />
            </Field>
          ) : (
            <Field label="اكتب كلمة «حذف» للتأكيد" htmlFor="delete-password" error={fieldError(state, 'password')} hint="حسابك مرتبط بـ Google أو Apple ولا كلمة سر له">
              <Input id="delete-password" name="password" type="text" autoComplete="off" required placeholder="حذف" />
            </Field>
          )}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="understood" required className="mt-1 size-4 accent-[hsl(var(--destructive))]" />
            <span>{t('auth.deleteConfirm')}</span>
          </label>
          {fieldError(state, 'understood') ? <p className="text-xs text-destructive">{t('auth.deleteNeedConfirm')}</p> : null}
          <FormError state={state} />
          <SubmitButton variant="destructive">{t('auth.deleteButton')}</SubmitButton>
        </form>
      </CardContent>
    </Card>
  )
}
