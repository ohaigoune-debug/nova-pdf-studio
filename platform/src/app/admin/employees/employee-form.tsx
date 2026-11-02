'use client'

import { useActionState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Input, Select } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { createConfirmerAction } from '@/server/actions/confirmer.actions'

export function EmployeeForm() {
  const [state, action] = useActionState(createConfirmerAction, null)
  return (
    <form action={action} className="space-y-4">
      <Field label="الدور" htmlFor="employee-role" hint="مدير العمليات: نقاط البيع، والباقات، والأكواد، والمال المستلَم — بلا إعدادات ولا محتوى ولا أسعار.">
        <Select id="employee-role" name="role" defaultValue="CONFIRMER">
          <option value="CONFIRMER">موظف تأكيد الطلبات</option>
          <option value="MANAGER">مدير العمليات</option>
        </Select>
      </Field>
      <Field label="الاسم الكامل" htmlFor="employee-name" error={fieldError(state, 'fullName')}><Input id="employee-name" name="fullName" required minLength={3} maxLength={120} autoComplete="name" /></Field>
      <Field label="البريد الإلكتروني" htmlFor="employee-email" error={fieldError(state, 'email')}><Input id="employee-email" name="email" type="email" required dir="ltr" autoComplete="email" /></Field>
      <Field label="الهاتف" htmlFor="employee-phone" error={fieldError(state, 'phone')}><Input id="employee-phone" name="phone" type="tel" required dir="ltr" autoComplete="tel" placeholder="05XXXXXXXX" /></Field>
      <Field label="كلمة السر" htmlFor="employee-password" hint="8 أحرف على الأقل، مع حرف كبير وصغير ورقم ورمز." error={fieldError(state, 'password')}><Input id="employee-password" name="password" type="password" required minLength={8} maxLength={200} dir="ltr" autoComplete="new-password" /></Field>
      <FormError state={state} />
      {state?.ok ? <p className="text-sm text-success" role="status">تم إنشاء الحساب. يدخل ببريده أو بهاتفه وكلمة السر.</p> : null}
      <SubmitButton>إنشاء الحساب</SubmitButton>
    </form>
  )
}
