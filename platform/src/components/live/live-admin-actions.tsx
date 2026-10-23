'use client'

import { Radio, Square, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useTransition } from 'react'
import { FormError, SubmitButton } from '@/components/forms/form-bits'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { attachRecordingAction, setLiveStatusAction } from '@/server/actions/live.actions'

/** أزرار حالة الحصة: على الهواء / انتهت / إلغاء */
export function LiveStatusButtons({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const set = (next: 'LIVE' | 'ENDED' | 'CANCELLED') => {
    if (next === 'CANCELLED' && !confirm('إلغاء هذه الحصة؟ لن يتمكن التلاميذ من الانضمام.')) return
    start(async () => {
      const r = await setLiveStatusAction({ id, status: next })
      if (!r.ok) toast('error', r.error.message)
      else {
        toast('success', 'حُدّثت الحالة')
        router.refresh()
      }
    })
  }
  return (
    <div className="flex flex-wrap gap-2">
      {status === 'SCHEDULED' ? (
        <Button size="sm" variant="destructive" onClick={() => set('LIVE')} loading={pending}>
          <Radio className="size-4" /> على الهواء
        </Button>
      ) : null}
      {status === 'SCHEDULED' || status === 'LIVE' ? (
        <Button size="sm" variant="outline" onClick={() => set('ENDED')} loading={pending}>
          <Square className="size-4" /> انتهت
        </Button>
      ) : null}
      {status !== 'CANCELLED' && status !== 'ENDED' ? (
        <Button size="sm" variant="ghost" onClick={() => set('CANCELLED')} loading={pending}>
          <XCircle className="size-4" /> إلغاء
        </Button>
      ) : null}
    </div>
  )
}

/** ربط تسجيل الحصة بمحتوى فيديو من مساحة الدورة */
export function AttachRecordingForm({ id, current, candidates }: { id: string; current: string | null; candidates: { id: string; title: string }[] }) {
  const router = useRouter()
  const [state, action] = useActionState(attachRecordingAction, null)
  useEffect(() => {
    if (state?.ok) {
      toast('success', 'حُفظ التسجيل')
      router.refresh()
    }
  }, [state, router])
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <Field label="التسجيل (محتوى فيديو)" htmlFor="rec" hint="أنشئ محتوى من نوع فيديو (يوتيوب غير مدرج أو Bunny) موجّهاً لفوج الدورة ثم اختره هنا.">
        <Select id="rec" name="recordingContentId" defaultValue={current ?? ''}>
          <option value="">— بلا تسجيل —</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </Select>
      </Field>
      <FormError state={state} />
      <SubmitButton size="sm" variant="outline">
        حفظ التسجيل
      </SubmitButton>
    </form>
  )
}
