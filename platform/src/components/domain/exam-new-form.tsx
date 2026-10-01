'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Input, Select } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { createExamAction } from '@/server/actions/exams.actions'
import { EXAM_KIND_AR } from '@/server/services/exams.service'

type Opt = { id: string; name: string }

export function ExamNewForm({ subjects, levels, streams }: { subjects: Opt[]; levels: Opt[]; streams: Opt[] }) {
  const router = useRouter()
  const [state, action] = useActionState(createExamAction, null)
  useEffect(() => {
    if (state?.ok) router.push(`/teacher/exams/${state.data.id}`)
  }, [state, router])
  return (
    <form action={action} className="space-y-4">
      <Field label="العنوان" htmlFor="title" error={fieldError(state, 'title')}>
        <Input id="title" name="title" required placeholder="اختبار الفصل الأول في اللغة العربية" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="النوع" htmlFor="kind">
          <Select id="kind" name="kind" defaultValue="TEST">
            {Object.entries(EXAM_KIND_AR).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="الفصل" htmlFor="schoolTerm">
          <Select id="schoolTerm" name="schoolTerm" defaultValue="1">
            <option value="">—</option>
            <option value="1">الفصل الأول</option>
            <option value="2">الفصل الثاني</option>
            <option value="3">الفصل الثالث</option>
          </Select>
        </Field>
        <Field label="المادة" htmlFor="subjectId">
          <Select id="subjectId" name="subjectId" defaultValue="">
            <option value="">—</option>
            {subjects.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="الصف" htmlFor="levelId">
          <Select id="levelId" name="levelId" defaultValue="">
            <option value="">—</option>
            {levels.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="الشعبة" htmlFor="streamId">
          <Select id="streamId" name="streamId" defaultValue="">
            <option value="">—</option>
            {streams.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="المدة (دقائق)" htmlFor="durationMinutes">
          <Input id="durationMinutes" name="durationMinutes" type="number" min="5" max="600" defaultValue={120} dir="ltr" />
        </Field>
        <Field label="المجموع المستهدف" htmlFor="targetPoints">
          <Input id="targetPoints" name="targetPoints" type="number" min="1" max="200" step="0.5" defaultValue={20} dir="ltr" />
        </Field>
      </div>
      <FormError state={state} />
      <SubmitButton>إنشاء وفتح المحرّر</SubmitButton>
    </form>
  )
}
