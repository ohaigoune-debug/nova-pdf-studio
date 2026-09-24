'use client'

import { Megaphone } from 'lucide-react'
import { useActionState, useEffect, useRef, useState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Input, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { sendAnnouncementAction } from '@/server/actions/classroom.actions'

/** رسالة واحدة تصل التلاميذ كلّهم أو أفواجاً مختارة، إشعاراً داخل المنصة وعلى الهاتف */
export function AnnouncementForm({ groups }: { groups: { id: string; name: string }[] }) {
  const [state, action] = useActionState(sendAnnouncementAction, null)
  const [audience, setAudience] = useState<'all' | 'groups'>('all')
  const ref = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state?.ok) {
      toast('success', `أُرسلت الرسالة إلى ${state.data.recipients} تلميذ`)
      ref.current?.reset()
      setAudience('all')
    }
  }, [state])
  return (
    <form ref={ref} action={action} className="space-y-4">
      <Field label="العنوان" htmlFor="an-title" error={fieldError(state, 'title')}>
        <Input id="an-title" name="title" maxLength={150} required placeholder="مثلاً: تأجيل حصة السبت" />
      </Field>
      <Field label="الرسالة" htmlFor="an-body" error={fieldError(state, 'body')}>
        <Textarea id="an-body" name="body" rows={5} maxLength={3000} required />
      </Field>
      <Field label="رابط (اختياري)" htmlFor="an-link" hint="يفتحه التلميذ حين يضغط على الإشعار — درس، واجب، أو رابط خارجي https://">
        <Input id="an-link" name="link" dir="ltr" placeholder="/student/assignments أو https://…" />
      </Field>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold">إلى من؟</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="audience" value="all" checked={audience === 'all'} onChange={() => setAudience('all')} className="size-4 accent-[hsl(var(--primary))]" /> كل تلاميذي
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="audience" value="groups" checked={audience === 'groups'} onChange={() => setAudience('groups')} className="size-4 accent-[hsl(var(--primary))]" /> أفواج محدّدة
        </label>
        {audience === 'groups' ? (
          <div className="flex flex-wrap gap-2 ps-6 text-sm">
            {groups.map((g) => (
              <label key={g.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
                <input type="checkbox" name="groupIds" value={g.id} className="size-4 accent-[hsl(var(--primary))]" /> {g.name}
              </label>
            ))}
          </div>
        ) : null}
        {fieldError(state, 'groupIds') ? <p className="text-xs text-destructive">{fieldError(state, 'groupIds')}</p> : null}
      </fieldset>
      <FormError state={state} />
      <SubmitButton size="lg">
        <Megaphone className="size-4" /> أرسل الرسالة
      </SubmitButton>
    </form>
  )
}
