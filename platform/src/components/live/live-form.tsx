'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { createLiveSessionAction, updateLiveSessionAction } from '@/server/actions/live.actions'
import { LIVE_PROVIDERS } from '@/server/db/schema/enums'
import type { ActionResult } from '@/server/lib/action-result'

const PROVIDER_AR: Record<string, string> = { ZOOM: 'Zoom', MEET: 'Google Meet', YOUTUBE: 'بث يوتيوب', OTHER: 'آخر' }

export interface LiveFormDefaults {
  courseId?: string
  title?: string
  description?: string | null
  startsAt?: string | Date
  durationMinutes?: number
  provider?: string
  joinUrl?: string | null
  hasJoinUrl?: boolean
  providerMeetingId?: string | null
}

/** قيمة datetime-local بالتوقيت المحلي للمتصفح */
function toLocalInput(v: string | Date | undefined): string {
  if (!v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16)
}

/** نموذج حصة مباشرة (إنشاء/تعديل). رابط الانضمام يُختم في الخادم ولا يُعاد عرضه للمشرف إلا في صفحة التفاصيل. */
export function LiveSessionForm({ id, defaults = {}, courses }: { id?: string; defaults?: LiveFormDefaults; courses: { id: string; title: string; season: string }[] }) {
  const router = useRouter()
  const action = id
    ? (updateLiveSessionAction.bind(null, id) as (p: ActionResult<{ id: string }> | null, fd: FormData) => Promise<ActionResult<{ id: string }>>)
    : createLiveSessionAction
  const [state, formAction] = useActionState(action, null)
  useEffect(() => {
    if (state?.ok) {
      toast('success', id ? 'حُفظت الحصة' : 'جُدولت الحصة')
      router.push(`/admin/live/${state.data.id}`)
    }
  }, [state, router, id])
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="الدورة" htmlFor="l-course" error={fieldError(state, 'courseId')} className="sm:col-span-2">
          <Select id="l-course" name="courseId" defaultValue={defaults.courseId ?? ''} required>
            <option value="">—</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} · {c.season}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="عنوان الحصة" htmlFor="l-title" error={fieldError(state, 'title')} className="sm:col-span-2">
          <Input id="l-title" name="title" defaultValue={defaults.title ?? ''} maxLength={200} required dir="auto" />
        </Field>
        <Field label="الموعد" htmlFor="l-starts" error={fieldError(state, 'startsAt')}>
          <Input id="l-starts" name="startsAt" type="datetime-local" defaultValue={toLocalInput(defaults.startsAt)} required dir="ltr" />
        </Field>
        <Field label="المدة (دقائق)" htmlFor="l-duration" error={fieldError(state, 'durationMinutes')}>
          <Input id="l-duration" name="durationMinutes" type="number" min={10} max={600} defaultValue={defaults.durationMinutes ?? 90} dir="ltr" required />
        </Field>
        <Field label="المنصة" htmlFor="l-provider">
          <Select id="l-provider" name="provider" defaultValue={defaults.provider ?? 'ZOOM'}>
            {LIVE_PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {PROVIDER_AR[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="معرّف الاجتماع (اختياري)" htmlFor="l-meeting" error={fieldError(state, 'providerMeetingId')}>
          <Input id="l-meeting" name="providerMeetingId" defaultValue={defaults.providerMeetingId ?? ''} dir="ltr" />
        </Field>
        <Field label="رابط الانضمام" htmlFor="l-url" hint={id && defaults.hasJoinUrl ? 'اتركه فارغاً مع تفعيل «الإبقاء على الرابط» للاحتفاظ بالرابط المحفوظ.' : 'يُحفظ مشفّراً ولا يُعرض للتلميذ إلا داخل نافذة الحصة.'} error={fieldError(state, 'joinUrl')} className="sm:col-span-2">
          <Input id="l-url" name="joinUrl" type="url" defaultValue={defaults.joinUrl ?? ''} dir="ltr" placeholder="https://zoom.us/j/…" />
        </Field>
        {id && defaults.hasJoinUrl ? (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="keepJoinUrl" defaultChecked className="size-4" /> الإبقاء على الرابط المحفوظ إن تُرك الحقل فارغاً
          </label>
        ) : null}
        <Field label="وصف (اختياري)" htmlFor="l-desc" className="sm:col-span-2">
          <Textarea id="l-desc" name="description" rows={3} defaultValue={defaults.description ?? ''} dir="auto" />
        </Field>
      </div>
      <FormError state={state} />
      <SubmitButton>{id ? 'حفظ' : 'جدولة الحصة'}</SubmitButton>
    </form>
  )
}
