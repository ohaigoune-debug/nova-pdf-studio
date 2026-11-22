'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { createLiveSessionAction, updateLiveSessionAction } from '@/server/actions/live.actions'
import { LIVE_PROVIDERS } from '@/server/db/schema/enums'
import type { ActionResult } from '@/server/lib/action-result'
import { toDzInput } from '@/lib/dz-time'

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
  hasPasscode?: boolean
  /** اجتماع Zoom أنشأته المنصة */
  zoomAuto?: boolean
}

/** قيمة الخانة بتوقيت الجزائر (لا بتوقيت المتصفح): الخادم يقرؤها بتوقيت الجزائر أيضًا */
const toLocalInput = (v: string | Date | undefined): string => toDzInput(v)

/** نموذج حصة مباشرة (إنشاء/تعديل). رابط الانضمام يُختم في الخادم ولا يُعاد عرضه للمشرف إلا في صفحة التفاصيل. */
export function LiveSessionForm({ id, defaults = {}, courses, canAutoZoom = false }: { id?: string; defaults?: LiveFormDefaults; courses: { id: string; title: string; season: string }[]; canAutoZoom?: boolean }) {
  const [provider, setProvider] = useState(defaults.provider ?? 'ZOOM')
  const [auto, setAuto] = useState(true)
  // إنشاء حصة Zoom وحساب Zoom مربوط بصلاحية الاجتماعات ⇒ المنصة تُنشئ الاجتماع (لا رابط ولا رمز)
  const autoOn = !id && canAutoZoom && provider === 'ZOOM' && auto
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
          <Select id="l-provider" name="provider" value={provider} onChange={(e) => setProvider(e.target.value)}>
            {LIVE_PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {PROVIDER_AR[p]}
              </option>
            ))}
          </Select>
        </Field>
        {!id && canAutoZoom && provider === 'ZOOM' ? (
          <label className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm sm:col-span-2">
            <input type="checkbox" name="autoZoom" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="mt-0.5 size-4" />
            <span>
              <b>أنشئ اجتماع Zoom تلقائيًا</b>
              <span className="block text-xs text-muted-foreground">تُنشئه المنصة في حسابك على Zoom بالعنوان والموعد، فلا تحتاج إلى رابط ولا رمز.</span>
            </span>
          </label>
        ) : null}
        {id && defaults.zoomAuto ? (
          <p className="rounded-xl bg-muted p-3 text-xs leading-relaxed text-muted-foreground sm:col-span-2">اجتماع Zoom أنشأته المنصة: تعديل العنوان أو الموعد أو المدة يُحدَّث في Zoom تلقائيًا، وإلغاء الحصة يحذفه من Zoom.</p>
        ) : null}
        {autoOn ? null : (
          <>
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
            {/* Zoom Meeting SDK يحتاج رمز الاجتماع نفسه لا رمز الرابط المشفّر (22 نوفمبر 2026) */}
            <Field
              label="رمز اجتماع Zoom ‏(Passcode)"
              htmlFor="l-passcode"
              hint={id && defaults.hasPasscode ? 'محفوظ مشفّرًا. اتركه فارغًا مع «الإبقاء على الرمز» للاحتفاظ به.' : 'من تفاصيل الاجتماع في Zoom. به يدخل التلميذ الحصة داخل المنصة دون تطبيق Zoom؛ اتركه فارغًا إن لم يكن للاجتماع رمز.'}
              error={fieldError(state, 'meetingPasscode')}
              className="sm:col-span-2"
            >
              <Input id="l-passcode" name="meetingPasscode" maxLength={40} dir="ltr" autoComplete="off" placeholder={id && defaults.hasPasscode ? '••••••' : ''} />
            </Field>
            {id && defaults.hasPasscode ? (
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" name="keepPasscode" defaultChecked className="size-4" /> الإبقاء على الرمز المحفوظ إن تُرك الحقل فارغًا
              </label>
            ) : null}
          </>
        )}
        <Field label="وصف (اختياري)" htmlFor="l-desc" className="sm:col-span-2">
          <Textarea id="l-desc" name="description" rows={3} defaultValue={defaults.description ?? ''} dir="auto" />
        </Field>
      </div>
      <FormError state={state} />
      <SubmitButton>{id ? 'حفظ' : 'جدولة الحصة'}</SubmitButton>
    </form>
  )
}
