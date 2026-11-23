'use client'

import { useActionState } from 'react'
import { FormError, SubmitButton } from '@/components/forms/form-bits'
import type { HideablePublicEntry } from '@/lib/public-menu'
import { savePublicMenuAction } from '@/server/actions/student-menu.actions'

/** تبويبات الواجهة العامّة (ترويسة الموقع وتذييله): المؤشَّر يختفي من التنقّل، وتبقى صفحته تعمل برابطها */
export function PublicMenuForm({ entries, hidden }: { entries: HideablePublicEntry[]; hidden: string[] }) {
  const [state, action] = useActionState(savePublicMenuAction, null)
  return (
    <form action={action} className="space-y-3">
      <fieldset className="space-y-2 rounded-lg border p-3">
        <legend className="px-1 text-sm font-bold">الواجهة العامّة (ترويسة الموقع وتذييله)</legend>
        <p className="text-xs leading-relaxed text-muted-foreground">
          المؤشَّر يختفي من أعلى الموقع وأسفله للجميع. الصفحة نفسها تبقى تعمل برابطها (رموز QR في الكتب لا تنكسر).
        </p>
        {entries.map((e) => (
          <label key={e.key} className="flex min-h-9 items-center gap-2 text-sm">
            <input type="checkbox" name="hidden" value={e.key} defaultChecked={hidden.includes(e.key)} className="size-4" />
            إخفاء: {e.label}
          </label>
        ))}
      </fieldset>
      <FormError state={state} />
      {state?.ok ? <p className="text-sm text-success" role="status">حُفظ. يسري خلال 15 ثانية على الأكثر.</p> : null}
      <SubmitButton>حفظ</SubmitButton>
    </form>
  )
}
