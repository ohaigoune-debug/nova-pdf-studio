'use client'

import { useActionState, useEffect, useRef } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { CONTENT_KINDS, CONTENT_KIND_LABELS, rateLabel, type AssistantPayConfig } from '@/lib/assistant-pay'
import { submitAssistantContentAction } from '@/server/actions/assistant-pay.actions'

/** رفع محتوى: الدورة والنّوع والعنوان وعدد الصّفحات وملفّ PDF — يُنشر في «الملفات» داخل الدورة */
export function ContentForm({ config, courses }: { config: AssistantPayConfig; courses: { id: string; title: string }[] }) {
  const [state, action] = useActionState(submitAssistantContentAction, null)
  const ref = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state?.ok) ref.current?.reset()
  }, [state])
  return (
    <form ref={ref} action={action} className="space-y-3">
      <Field label="الدّورة الّتي يُنشر فيها" htmlFor="courseId" hint="يصل فورًا إلى تلاميذ هذه الدّورة في قسم «الملفات» داخلها." error={fieldError(state, 'courseId')}>
        <Select id="courseId" name="courseId" required defaultValue="">
          <option value="" disabled>
            اختر الدّورة…
          </option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="النّوع" htmlFor="kind">
        <Select id="kind" name="kind" defaultValue="SUMMARY" required>
          {CONTENT_KINDS.map((k) => (
            <option key={k} value={k}>
              {CONTENT_KIND_LABELS[k]} — {rateLabel(k, config)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="العنوان" htmlFor="title" error={fieldError(state, 'title')}>
        <Input id="title" name="title" required minLength={3} maxLength={200} placeholder="مثال: ملخّص درس الإعراب — الجمل الّتي لها محلّ" />
      </Field>
      <Field label="عدد الصّفحات" htmlFor="pages" hint="للاختبار والمقترح: صفحات الموضوع وحدها، والتّصحيح مجّانيّ." error={fieldError(state, 'pages')}>
        <Input id="pages" name="pages" type="number" inputMode="numeric" min={1} max={500} required className="w-32" />
      </Field>
      <Field label="الملفّ (PDF، حتى 9 ميغابايت)" htmlFor="file" error={fieldError(state, 'file')}>
        <Input id="file" name="file" type="file" required accept=".pdf,application/pdf" />
      </Field>
      <Field label="ملاحظة (اختياريّة)" htmlFor="note">
        <Textarea id="note" name="note" rows={2} maxLength={500} />
      </Field>
      <FormError state={state} />
      {state?.ok ? (
        <p className="text-sm text-success" role="status">
          رُفع ونُشر لتلاميذ الدّورة، وأُضيف إلى كشف الشّهر.
        </p>
      ) : null}
      <SubmitButton>رفع ونشر</SubmitButton>
    </form>
  )
}
