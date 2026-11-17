'use client'

import { useActionState } from 'react'
import { FormError, SubmitButton } from '@/components/forms/form-bits'
import { Alert } from '@/components/ui/misc'
import { issueMissingInvoicesAction } from '@/server/actions/invoices.actions'

/** طلبات مُسلَّمة بلا فاتورة (قبل هذه الميزة): تُصدر بزرّ، بترتيب تاريخ التسليم */
export function IssueMissingInvoices({ missing }: { missing: number }) {
  const [state, action] = useActionState(issueMissingInvoicesAction, null)
  return (
    <Alert tone="warning" title={`${missing} طلبًا مُسلَّمًا بلا فاتورة`}>
      <form action={action} className="mt-2 flex flex-wrap items-center gap-3">
        <span className="text-sm">طلبات سُلّمت قبل تفعيل الفواتير. أصدرها الآن بترتيب تاريخ تسليمها.</span>
        <SubmitButton variant="outline">أصدر الفواتير الناقصة</SubmitButton>
        {state?.ok ? <span role="status" className="text-sm font-semibold">صدرت {state.data.issued} فاتورة{state.data.remaining ? ` — بقي ${state.data.remaining}، أعد الضغط` : ''}.</span> : null}
        <FormError state={state} />
      </form>
    </Alert>
  )
}
