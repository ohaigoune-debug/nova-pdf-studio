'use client'

import { useActionState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { createUploaderAction, setUploaderCoursesAction } from '@/server/actions/uploader.actions'

type CourseOpt = { id: string; title: string }

function CourseChecks({ courses, selected }: { courses: CourseOpt[]; selected?: string[] }) {
  if (courses.length === 0) return <p className="text-xs text-muted-foreground">لا دورات بعد — أنشئ دورة أولًا.</p>
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {courses.map((c) => (
        <label key={c.id} className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="courseIds" value={c.id} defaultChecked={selected?.includes(c.id)} className="size-4" /> {c.title}
        </label>
      ))}
    </div>
  )
}

export function UploaderForm({ courses }: { courses: CourseOpt[] }) {
  const [state, action] = useActionState(createUploaderAction, null)
  return (
    <form action={action} className="space-y-4">
      <Field label="الاسم الكامل" htmlFor="up-name" error={fieldError(state, 'fullName')}><Input id="up-name" name="fullName" required minLength={3} maxLength={120} /></Field>
      <Field label="البريد الإلكتروني (للدخول)" htmlFor="up-email" error={fieldError(state, 'email')}><Input id="up-email" name="email" type="email" required dir="ltr" /></Field>
      <Field label="الهاتف" htmlFor="up-phone" error={fieldError(state, 'phone')}><Input id="up-phone" name="phone" type="tel" required dir="ltr" placeholder="05XXXXXXXX" /></Field>
      <Field label="كلمة السر" htmlFor="up-pass" hint="8 أحرف على الأقل، مع حرف كبير وصغير ورقم ورمز." error={fieldError(state, 'password')}><Input id="up-pass" name="password" type="password" required minLength={8} dir="ltr" autoComplete="new-password" /></Field>
      <fieldset className="space-y-2 rounded-lg border p-3">
        <legend className="px-1 text-sm font-bold">الدورات التي يرفع دروسها</legend>
        <CourseChecks courses={courses} />
      </fieldset>
      <FormError state={state} />
      {state?.ok ? <p className="text-sm text-success" role="status">أُنشئ حساب رافع المحتوى. يدخل بالبريد وكلمة السر فيجد دوراته فقط.</p> : null}
      <SubmitButton>إنشاء رافع محتوى</SubmitButton>
    </form>
  )
}

export function UploaderCoursesForm({ userId, courses, selected }: { userId: string; courses: CourseOpt[]; selected: string[] }) {
  const [state, action] = useActionState(setUploaderCoursesAction, null)
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="userId" value={userId} />
      <CourseChecks courses={courses} selected={selected} />
      <FormError state={state} />
      {state?.ok ? <p className="text-xs text-success" role="status">حُفظ.</p> : null}
      <SubmitButton size="sm" variant="outline">حفظ الدورات</SubmitButton>
    </form>
  )
}
