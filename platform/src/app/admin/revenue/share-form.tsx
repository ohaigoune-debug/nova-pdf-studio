'use client'

import { useActionState } from 'react'
import { FormError, SubmitButton } from '@/components/forms/form-bits'
import { Input, Select } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { VAT_MODES, VAT_MODE_LABELS, type TeacherShareConfig } from '@/lib/teacher-share'
import { saveTeacherShareAction } from '@/server/actions/teacher-share.actions'

/** نسب نصيب الأستاذ، والأساتذة الشركاء الذين لهم نصيب */
export function TeacherShareForm({ config: c, teachers }: { config: TeacherShareConfig; teachers: { workspaceId: string; teacherName: string }[] }) {
  const [state, action] = useActionState(saveTeacherShareAction, null)
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="بالبطاقة: نصيب الأستاذ (%) بعد TVA" htmlFor="cardPct">
          <Input id="cardPct" name="cardPct" type="number" inputMode="decimal" min={0} max={100} step="0.01" defaultValue={c.cardPct} required className="w-28" />
        </Field>
        <Field label="TVA على البطاقة (%)" htmlFor="vatPct">
          <Input id="vatPct" name="vatPct" type="number" inputMode="decimal" min={0} max={100} step="0.01" defaultValue={c.vatPct} required className="w-28" />
        </Field>
        <Field label="بغير البطاقة: نصيب الأستاذ (%)" htmlFor="otherPct">
          <Input id="otherPct" name="otherPct" type="number" inputMode="decimal" min={0} max={100} step="0.01" defaultValue={c.otherPct} required className="w-28" />
        </Field>
      </div>
      <Field label="حذف TVA" htmlFor="vatMode">
        <Select id="vatMode" name="vatMode" defaultValue={c.vatMode}>
          {VAT_MODES.map((m) => (
            <option key={m} value={m}>
              {VAT_MODE_LABELS[m]}
            </option>
          ))}
        </Select>
      </Field>
      <fieldset className="space-y-2 rounded-lg border p-3">
        <legend className="px-1 text-sm font-bold">الأساتذة الشركاء (لهم نصيب)</legend>
        {teachers.length === 0 ? <p className="text-sm text-muted-foreground">لا أساتذة بعد.</p> : null}
        {teachers.map((t) => (
          <label key={t.workspaceId} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="partners" value={t.workspaceId} defaultChecked={c.partners.includes(t.workspaceId)} className="size-4" />
            {t.teacherName}
          </label>
        ))}
        <p className="text-xs text-muted-foreground">لا تعلّم حسابك أنت: دوراتك مداخيلها لك كاملة.</p>
      </fieldset>
      <FormError state={state} />
      {state?.ok ? (
        <p className="text-sm text-success" role="status">
          حُفظ.
        </p>
      ) : null}
      <SubmitButton>حفظ</SubmitButton>
    </form>
  )
}
