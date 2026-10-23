'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { saveCourseAction } from '@/server/actions/courses.actions'
import type { CourseRow } from '@/server/db/schema'
import { COURSE_STATUSES } from '@/server/db/schema/enums'

type Opt = { id: string; name: string }
const STATUS_AR: Record<string, string> = { DRAFT: 'مسودة', PUBLISHED: 'منشورة', ARCHIVED: 'مؤرشفة' }

const DEFAULT_TERMS = `## النظام الداخلي للدورة

1. الاشتراك شخصي ولا يجوز مشاركة الحساب؛ المشاركة تؤدي إلى إيقاف الاشتراك دون تعويض.
2. الحصص المباشرة تُبثّ في مواعيدها، وتُرفع التسجيلات داخل الدورة بعدها.
3. الفيديوهات والملفات تختفي بعد البكالوريا (تاريخ انتهاء الوصول المحدّد في الدورة).
4. يُمنع تصوير أو تنزيل أو إعادة نشر أي محتوى من الدورة.
5. الاحترام المتبادل في القسم الافتراضي شرط للبقاء في الدورة.`

/** نموذج دورة مدفوعة (إنشاء/تعديل) — المشرف ينشئها لمساحة أستاذ */
export function CourseForm({
  course,
  options
}: {
  course?: CourseRow | null
  options: { workspaces: { id: string; name: string; teacherName: string }[]; subjects: Opt[]; levels: Opt[]; streams: Opt[] }
}) {
  const router = useRouter()
  const [state, action] = useActionState(saveCourseAction, null)
  useEffect(() => {
    if (state?.ok) {
      toast('success', 'حُفظت الدورة')
      router.push(`/admin/courses/${state.data.id}`)
    }
  }, [state, router])
  const thisYear = new Date().getFullYear()
  const defaultSeason = `${thisYear}/${thisYear + 1}`
  return (
    <form action={action} className="space-y-4">
      {course ? <input type="hidden" name="id" value={course.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="عنوان الدورة" htmlFor="c-title" error={fieldError(state, 'title')} className="sm:col-span-2">
          <Input id="c-title" name="title" defaultValue={course?.title ?? ''} maxLength={200} required dir="auto" placeholder="مثال: دورة البكالوريا في الأدب العربي 2026" />
        </Field>
        {course ? (
          <Field label="الأستاذ / المساحة" htmlFor="c-ws" hint="لا يتغيّر بعد الإنشاء (الفوج الخلفي مرتبط به)">
            <Input id="c-ws" value={options.workspaces.find((w) => w.id === course.workspaceId)?.teacherName ?? '—'} disabled />
            <input type="hidden" name="workspaceId" value={course.workspaceId} />
          </Field>
        ) : (
          <Field label="الأستاذ / المساحة" htmlFor="c-ws" error={fieldError(state, 'workspaceId')} hint="يُنشأ فوج باسم الدورة في مساحة هذا الأستاذ">
            <Select id="c-ws" name="workspaceId" required defaultValue="">
              <option value="" disabled>
                اختر الأستاذ…
              </option>
              {options.workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.teacherName} — {w.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="الموسم" htmlFor="c-season" error={fieldError(state, 'season')}>
          <Input id="c-season" name="season" defaultValue={course?.season ?? defaultSeason} maxLength={20} required dir="ltr" />
        </Field>
        <Field label="الصيغة" htmlFor="c-plan">
          <Select id="c-plan" name="plan" defaultValue={course?.plan ?? 'ANNUAL'}>
            <option value="ANNUAL">اشتراك سنوي</option>
            <option value="TERM">اشتراك فصلي</option>
          </Select>
        </Field>
        <Field label="الحالة" htmlFor="c-status">
          <Select id="c-status" name="status" defaultValue={course?.status ?? 'DRAFT'}>
            {COURSE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_AR[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="الصف" htmlFor="c-level">
          <Select id="c-level" name="levelId" defaultValue={course?.levelId ?? ''}>
            <option value="">—</option>
            {options.levels.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="المادة" htmlFor="c-subject" hint="تربط الدورة بقسم PLAY المناسب">
          <Select id="c-subject" name="subjectId" defaultValue={course?.subjectId ?? ''}>
            <option value="">—</option>
            {options.subjects.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="الشعب المعنية" htmlFor="c-streams" hint="اترك الكل بلا تحديد = كل الشعب (Ctrl/⌘ لاختيار أكثر من واحدة)" className="sm:col-span-2">
          <Select id="c-streams" name="streamIds" multiple defaultValue={course?.streamIds ?? []} className="h-auto min-h-[7rem] py-2">
            {options.streams.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="بداية الدورة" htmlFor="c-starts" error={fieldError(state, 'startsOn')}>
          <Input id="c-starts" name="startsOn" type="date" defaultValue={course?.startsOn ?? ''} dir="ltr" />
        </Field>
        <Field label="نهاية الدورة" htmlFor="c-ends" error={fieldError(state, 'endsOn')}>
          <Input id="c-ends" name="endsOn" type="date" defaultValue={course?.endsOn ?? ''} dir="ltr" />
        </Field>
        <Field label="آخر يوم للوصول إلى المحتوى" htmlFor="c-access" error={fieldError(state, 'accessEndsOn')} hint="بعده تختفي الفيديوهات (بعد البكالوريا). يُستعمل تاريخاً افتراضياً لانتهاء الاشتراكات.">
          <Input id="c-access" name="accessEndsOn" type="date" defaultValue={course?.accessEndsOn ?? ''} dir="ltr" />
        </Field>
        <Field label="السعر (دج)" htmlFor="c-price" error={fieldError(state, 'priceDzd')} hint="للعرض فقط؛ التفعيل يتم بشراء الكتاب المرتبط أو يدوياً">
          <Input id="c-price" name="priceDzd" type="number" min="0" step="1" defaultValue={course?.priceDzd ?? 0} dir="ltr" required />
        </Field>
        <Field label="الرابط (slug)" htmlFor="c-slug" hint="فارغ = من العنوان">
          <Input id="c-slug" name="slug" defaultValue={course?.slug ?? ''} maxLength={80} dir="ltr" />
        </Field>
        <Field label="صورة الغلاف" htmlFor="c-cover" hint={course?.coverFileId ? 'يوجد غلاف؛ ارفع صورة لاستبداله' : 'اختياري'}>
          <Input id="c-cover" name="cover" type="file" accept="image/*" />
        </Field>
        <Field label="الوصف" htmlFor="c-desc" className="sm:col-span-2">
          <Textarea id="c-desc" name="description" rows={3} defaultValue={course?.description ?? ''} maxLength={4000} dir="auto" />
        </Field>
        <Field label="النظام الداخلي والشروط (Markdown)" htmlFor="c-terms" hint="يوافق عليها التلميذ قبل أول دخول. تعديل النص يرفع رقم النسخة فيُطلب القبول من جديد." className="sm:col-span-2">
          <Textarea id="c-terms" name="termsText" rows={10} defaultValue={course?.termsText ?? (course ? '' : DEFAULT_TERMS)} maxLength={20_000} dir="auto" className="font-mono text-xs" />
        </Field>
      </div>
      <FormError state={state} />
      <SubmitButton>{course ? 'حفظ التعديلات' : 'إنشاء الدورة'}</SubmitButton>
    </form>
  )
}
