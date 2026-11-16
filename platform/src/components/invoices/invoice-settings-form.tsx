'use client'

import { useActionState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Input, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { saveInvoiceSettingsAction } from '@/server/actions/invoices.actions'
import type { InvoiceSettings } from '@/server/services/invoices.service'

/** بيانات البائع على الفاتورة — تُنسخ في كل فاتورة لحظة إصدارها (لا تغيّر الفواتير السابقة) */
export function InvoiceSettingsForm({ value }: { value: InvoiceSettings }) {
  const [state, action] = useActionState(saveInvoiceSettingsAction, null)
  return (
    <form action={action} className="space-y-4">
      <Field label="اسم البائع" htmlFor="sellerName" error={fieldError(state, 'sellerName')} hint="كما يظهر في أعلى الفاتورة.">
        <Input id="sellerName" name="sellerName" defaultValue={value.sellerName} maxLength={120} required />
      </Field>
      <Field label="رقم التعريف الجبائي (NIF)" htmlFor="nif" error={fieldError(state, 'nif')} hint="أرقام فقط.">
        <Input id="nif" name="nif" defaultValue={value.nif} maxLength={30} dir="ltr" inputMode="numeric" />
      </Field>
      <Field label="رقم الحساب البنكي (RIB)" htmlFor="bankAccount" error={fieldError(state, 'bankAccount')} hint="أو رقم الحساب البريدي. أرقام وحروف لاتينية فقط.">
        <Input id="bankAccount" name="bankAccount" defaultValue={value.bankAccount} maxLength={40} dir="ltr" />
      </Field>
      <Field label="تذييل الفاتورة" htmlFor="footer" error={fieldError(state, 'footer')}>
        <Textarea id="footer" name="footer" defaultValue={value.footer} rows={2} maxLength={300} />
      </Field>
      <Field label="بادئة الرقم" htmlFor="prefix" error={fieldError(state, 'prefix')} hint="حروف لاتينية كبيرة وأرقام: F ⇐ F-2026-000001. تغييرها يمسّ الفواتير الجديدة فقط، والتسلسل يبقى واحدًا.">
        <Input id="prefix" name="prefix" defaultValue={value.prefix} maxLength={8} dir="ltr" className="w-32" required />
      </Field>
      <FormError state={state} />
      {state?.ok ? <p role="status" className="text-sm font-semibold">حُفظت. تظهر في الفواتير الجديدة.</p> : null}
      <SubmitButton>حفظ</SubmitButton>
    </form>
  )
}
