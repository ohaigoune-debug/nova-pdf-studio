'use client'

import { Send } from 'lucide-react'
import { useActionState, useEffect, useRef } from 'react'
import { FormError, SubmitButton } from '@/components/forms/form-bits'
import { Input, Select, Textarea } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { createPostAction } from '@/server/actions/classroom.actions'

type Opt = { id: string; name: string }

/** كتابة منشور في القسم: لفوج أو لكل الأفواج، مع رابط أو ملف اختياريين */
export function ClassComposer({ groups, files, defaultGroup }: { groups: Opt[]; files: Opt[]; defaultGroup: string | null }) {
  const [state, action] = useActionState(createPostAction, null)
  const ref = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state?.ok) {
      toast('success', 'نُشر المنشور ووصل التلاميذ إشعار به')
      ref.current?.reset()
    }
  }, [state])
  return (
    <form ref={ref} action={action} className="space-y-3 rounded-lg border bg-card p-4 shadow-soft">
      <Textarea name="body" rows={3} maxLength={5000} required placeholder="اكتب لتلاميذك: إعلان، سؤال للنقاش، تذكير بموعد…" />
      <div className="grid gap-2 sm:grid-cols-3">
        <Select name="groupId" defaultValue={defaultGroup ?? ''} aria-label="الفوج">
          <option value="">كل الأفواج</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
        <Input name="linkUrl" dir="ltr" placeholder="رابط (اختياري) https://…" />
        <Select name="fileId" defaultValue="" aria-label="ملف مرفق">
          <option value="">بلا ملف مرفق</option>
          {files.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="allowComments" defaultChecked className="size-4 accent-[hsl(var(--primary))]" /> السماح بتعليقات التلاميذ
        </label>
        <SubmitButton>
          <Send className="size-4" /> انشر
        </SubmitButton>
      </div>
      <FormError state={state} />
    </form>
  )
}
