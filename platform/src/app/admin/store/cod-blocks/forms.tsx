'use client'

import { useActionState } from 'react'
import { FormError, SubmitButton } from '@/components/forms/form-bits'
import { Input } from '@/components/ui/input'
import { blockPhoneAction, liftPhoneAction } from '@/server/actions/cod-blocks.actions'

/** إضافة رقم يدويًا إلى الممنوعين */
export function BlockPhoneForm() {
  const [state, action] = useActionState(blockPhoneAction, null)
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <Input name="phone" placeholder="05XXXXXXXX" dir="ltr" inputMode="tel" className="w-40" required aria-label="رقم الهاتف" />
      <Input name="note" placeholder="سبب المنع (اختياري)" className="min-w-40 flex-1" aria-label="سبب المنع" />
      <SubmitButton variant="outline">منع</SubmitButton>
      <div className="basis-full">
        <FormError state={state} />
        {state?.ok ? <p className="text-sm text-success" role="status">مُنع الرقم من الدفع عند الاستلام.</p> : null}
      </div>
    </form>
  )
}

/** إعفاء رقم: يعود له الدفع عند الاستلام (ومرتجع جديد بلا سبب يمنعه من جديد) */
export function LiftPhoneButton({ phone }: { phone: string }) {
  const [state, action] = useActionState(liftPhoneAction, null)
  if (state?.ok) return <span className="text-xs font-semibold text-success">أُعفي</span>
  return (
    <form action={action} className="flex items-center gap-1.5">
      <input type="hidden" name="phone" value={phone} />
      <input type="hidden" name="note" value="أعفاه المشرف" />
      <SubmitButton size="sm" variant="ghost">إعفاء</SubmitButton>
      <FormError state={state} />
    </form>
  )
}
