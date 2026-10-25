'use client'

import { useActionState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { updateGuardianContactAction } from '@/server/actions/student-contact.actions'

export function GuardianContactCard({ phone }: { phone: string | null }) {
  const [state, action] = useActionState(updateGuardianContactAction, null)
  return (
    <Card>
      <CardHeader><CardTitle>هاتف الأب أو ولي الأمر</CardTitle></CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <Field label="رقم التواصل" htmlFor="guardianPhone" error={fieldError(state, 'guardianPhone')} hint="رقم خاص للتواصل بشأن التوصيل والإشعارات المناسبة. لا ينشئ حساباً مستقلاً للولي؛ أضفه بإذنه.">
            <Input id="guardianPhone" name="guardianPhone" defaultValue={phone ?? ''} type="tel" inputMode="tel" dir="ltr" required placeholder="06XXXXXXXX" />
          </Field>
          <FormError state={state} />
          {state?.ok ? <p role="status" className="text-sm font-semibold">تم حفظ رقم التواصل.</p> : null}
          <SubmitButton>حفظ رقم ولي الأمر</SubmitButton>
        </form>
      </CardContent>
    </Card>
  )
}
