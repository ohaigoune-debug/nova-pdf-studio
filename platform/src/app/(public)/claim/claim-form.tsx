'use client'

import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { useActionState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { claimCourseAction } from '@/server/actions/delivery.actions'

export function ClaimForm({ phone, code }: { phone?: string; code?: string }) {
  const [state, action] = useActionState(claimCourseAction, null)
  if (state?.ok) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto size-14 text-success" />
        <p className="text-lg font-bold">فُعّلت دورة «{state.data.courseTitle}» على حسابك</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button asChild>
            <Link href="/student/groups">أفواجي</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/student">لوحتي</Link>
          </Button>
        </div>
      </div>
    )
  }
  return (
    <form action={action} className="space-y-4">
      <Field label="رقم الهاتف الذي وصله الرمز" htmlFor="phone" error={fieldError(state, 'phone')} hint="هاتف الطلب (مثال: 0550123456)">
        <Input id="phone" name="phone" type="tel" inputMode="numeric" defaultValue={phone ?? ''} placeholder="05XXXXXXXX" required dir="ltr" className="h-12 text-center font-mono text-lg" autoComplete="tel" />
      </Field>
      <Field label="رمز التفعيل (6 أرقام)" htmlFor="code" error={fieldError(state, 'code')}>
        <Input id="code" name="code" inputMode="numeric" pattern="[0-9]{6}" defaultValue={code ?? ''} placeholder="••••••" required dir="ltr" className="h-14 text-center font-mono text-2xl tracking-[0.3em]" autoComplete="one-time-code" maxLength={6} />
      </Field>
      <FormError state={state} />
      <SubmitButton className="w-full" size="lg">
        تفعيل الدورة
      </SubmitButton>
    </form>
  )
}
