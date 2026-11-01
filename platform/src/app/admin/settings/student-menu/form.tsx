'use client'

import { useActionState } from 'react'
import { FormError, SubmitButton } from '@/components/forms/form-bits'
import type { HideableEntry } from '@/lib/student-menu'
import { saveStudentMenuAction } from '@/server/actions/student-menu.actions'

export function StudentMenuForm({ entries, hidden }: { entries: HideableEntry[]; hidden: string[] }) {
  const [state, action] = useActionState(saveStudentMenuAction, null)
  const groups = [...new Set(entries.map((e) => e.group))]
  return (
    <form action={action} className="space-y-4">
      {groups.map((g) => (
        <fieldset key={g} className="space-y-2 rounded-lg border p-3">
          <legend className="px-1 text-sm font-bold">{g}</legend>
          {entries.filter((e) => e.group === g).map((e) => (
            <label key={e.href} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="hidden" value={e.href} defaultChecked={hidden.includes(e.href)} className="size-4" />
              إخفاء: {e.label}
            </label>
          ))}
        </fieldset>
      ))}
      <FormError state={state} />
      {state?.ok ? <p className="text-sm text-success" role="status">حُفظ. يظهر التغيير للتلاميذ فورًا.</p> : null}
      <SubmitButton>حفظ</SubmitButton>
    </form>
  )
}
