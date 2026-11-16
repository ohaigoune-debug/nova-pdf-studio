'use client'

import { useActionState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { cancelInvoiceAction } from '@/server/actions/invoices.actions'

/** إلغاء فاتورة (المشرف): لا حذف — تبقى برقمها وتُطبع عليها «ملغاة» */
export function CancelInvoiceForm({ id }: { id: string }) {
  const [state, action] = useActionState(cancelInvoiceAction, null)
  return (
    <details className="rounded-lg border bg-card p-3 text-sm">
      <summary className="cursor-pointer font-semibold text-destructive">إلغاء هذه الفاتورة</summary>
      <form action={action} className="mt-3 space-y-3">
        <input type="hidden" name="id" value={id} />
        <Field label="سبب الإلغاء" htmlFor="reason" error={fieldError(state, 'reason')} hint="لا تُحذف الفاتورة: يبقى رقمها في التسلسل ويُطبع عليها «ملغاة».">
          <Input id="reason" name="reason" required maxLength={300} />
        </Field>
        <FormError state={state} />
        <SubmitButton variant="destructive">ألغِ الفاتورة</SubmitButton>
      </form>
    </details>
  )
}
