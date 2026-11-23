'use client'

import { useActionState } from 'react'
import { FormError, SubmitButton } from '@/components/forms/form-bits'
import { Input, Select } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { CONTENT_KINDS, CONTENT_KIND_LABELS, CONTENT_UNITS, CONTENT_UNIT_LABELS, REPLY_KINDS, REPLY_KIND_LABELS, type AssistantPayConfig } from '@/lib/assistant-pay'
import { saveAssistantPayAction } from '@/server/actions/assistant-pay.actions'

function Num({ name, label, value, hint }: { name: string; label: string; value: number; hint?: string }) {
  return (
    <Field label={label} htmlFor={name} hint={hint}>
      <Input id={name} name={name} type="number" inputMode="numeric" min={0} defaultValue={value} required className="w-36" />
    </Field>
  )
}

/** أرقام أجر الأستاذ المساعد — تسري على كشوف الأشهر غير المدفوعة فور الحفظ */
export function AssistantPayForm({ config: c }: { config: AssistantPayConfig }) {
  const [state, action] = useActionState(saveAssistantPayAction, null)
  return (
    <form action={action} className="space-y-4">
      <fieldset className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
        <legend className="px-1 text-sm font-bold">الرّاتب والسّقف</legend>
        <Num name="baseSalary" label="الرّاتب الثّابت (دج)" value={c.baseSalary} />
        <Num name="includedReplies" label="الرّدود المشمولة بالرّاتب" value={c.includedReplies} />
        <Num name="extraCap" label="سقف الإضافيّ: الرّدود والمحتوى معًا (دج)" value={c.extraCap} />
        <Num name="detailedMinChars" label="الرّدّ المفصّل من (حرفًا)" value={c.detailedMinChars} />
        <Num name="termLimit" label="الاختبارات والمقترحات المدفوعة في كلّ فصل (معًا)" value={c.termLimit} hint="0 = بلا حدّ. تُحسب صفحات الموضوع وحدها والتّصحيح مجّانيّ." />
      </fieldset>
      <fieldset className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3">
        <legend className="px-1 text-sm font-bold">الرّدّ الزّائد (دج)</legend>
        {REPLY_KINDS.map((k) => (
          <Num key={k} name={`rate.${k}`} label={REPLY_KIND_LABELS[k]} value={c.replyRates[k]} />
        ))}
      </fieldset>
      <fieldset className="space-y-3 rounded-lg border p-3">
        <legend className="px-1 text-sm font-bold">المحتوى</legend>
        {CONTENT_KINDS.map((k) => (
          <div key={k} className="flex flex-wrap items-end gap-2">
            <Num name={`rate.${k}`} label={`${CONTENT_KIND_LABELS[k]} (دج)`} value={c.contentRates[k]} />
            <Field label="يُحسب" htmlFor={`unit.${k}`}>
              <Select id={`unit.${k}`} name={`unit.${k}`} defaultValue={c.contentUnits[k]} className="w-40">
                {CONTENT_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {CONTENT_UNIT_LABELS[u]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ))}
      </fieldset>
      <FormError state={state} />
      {state?.ok ? (
        <p className="text-sm text-success" role="status">
          حُفظ. يسري خلال 15 ثانية على الأكثر.
        </p>
      ) : null}
      <SubmitButton>حفظ</SubmitButton>
    </form>
  )
}
