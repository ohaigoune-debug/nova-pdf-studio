'use client'

import { EyeOff, Eye, Lock, LockOpen, Pin, PinOff, Send, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useRef, useTransition } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { createThreadAction, deletePostAction, deleteThreadAction, hidePostAction, moderateThreadAction, replyAction } from '@/server/actions/forum.actions'

type Opt = { id: string; name: string }

/** طرح موضوع جديد: عنوان، نصّ، والمادة والمستوى ليصل إلى من يهمّه */
export function NewThreadForm({ subjects, levels, defaultLevelId }: { subjects: Opt[]; levels: Opt[]; defaultLevelId?: string | null }) {
  const [state, action] = useActionState(createThreadAction, null)
  return (
    <form action={action} className="space-y-3">
      <Field label="العنوان" htmlFor="forum-title" error={fieldError(state, 'title')}>
        <Input id="forum-title" name="title" required minLength={4} maxLength={140} placeholder="مثال: كيف أُعرب البدل في «جاء الطالبُ محمدٌ»؟" dir="auto" />
      </Field>
      <Field label="سؤالك أو فكرتك" htmlFor="forum-body" error={fieldError(state, 'body')}>
        <Textarea id="forum-body" name="body" required maxLength={5000} rows={5} placeholder="اشرح ما تريد مناقشته بوضوح…" dir="auto" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="المادة" htmlFor="forum-subject">
          <Select id="forum-subject" name="subjectId" defaultValue="">
            <option value="">كل المواد</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="المستوى" htmlFor="forum-level">
          <Select id="forum-level" name="levelId" defaultValue={defaultLevelId ?? ''}>
            <option value="">كل المستويات</option>
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <FormError state={state} />
      <SubmitButton>
        <Send className="size-4" /> انشر الموضوع
      </SubmitButton>
    </form>
  )
}

export function ReplyForm({ threadId }: { threadId: string }) {
  const [state, action] = useActionState(replyAction, null)
  const ref = useRef<HTMLFormElement>(null)
  const router = useRouter()
  useEffect(() => {
    if (state?.ok) {
      ref.current?.reset()
      router.refresh()
    }
  }, [state, router])
  return (
    <form ref={ref} action={action} className="space-y-2">
      <input type="hidden" name="threadId" value={threadId} />
      <Field label="ردّك" htmlFor="reply-body" error={fieldError(state, 'body')}>
        <Textarea id="reply-body" name="body" required maxLength={5000} rows={4} placeholder="اكتب جوابك أو تعليقك…" dir="auto" />
      </Field>
      <FormError state={state} />
      <SubmitButton>
        <Send className="size-4" /> أرسل الردّ
      </SubmitButton>
    </form>
  )
}

type Result = { ok: boolean; error?: { message: string } }

function useRun() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<Result>, opts: { confirm?: string; done?: () => void } = {}) => {
    if (opts.confirm && !window.confirm(opts.confirm)) return
    start(async () => {
      const r = await fn()
      if (!r.ok) toast('error', r.error?.message ?? 'تعذّر')
      else {
        opts.done?.()
        router.refresh()
      }
    })
  }
  return { pending, run, router }
}

/** أدوات الموضوع: الحذف لصاحبه وللمشرف، والتثبيت والقفل والإخفاء للمشرف */
export function ThreadActions({ threadId, canDelete, admin, pinned, status }: { threadId: string; canDelete: boolean; admin: boolean; pinned: boolean; status: string }) {
  const { pending, run, router } = useRun()
  if (!canDelete && !admin) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {admin ? (
        <>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => moderateThreadAction(threadId, pinned ? 'unpin' : 'pin'))}>
            {pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />} {pinned ? 'إلغاء التثبيت' : 'تثبيت'}
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => moderateThreadAction(threadId, status === 'LOCKED' ? 'unlock' : 'lock'))}>
            {status === 'LOCKED' ? <LockOpen className="size-4" /> : <Lock className="size-4" />} {status === 'LOCKED' ? 'فتح الردود' : 'قفل الردود'}
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => moderateThreadAction(threadId, status === 'HIDDEN' ? 'unhide' : 'hide'))}>
            {status === 'HIDDEN' ? <Eye className="size-4" /> : <EyeOff className="size-4" />} {status === 'HIDDEN' ? 'إظهار' : 'إخفاء'}
          </Button>
        </>
      ) : null}
      {canDelete ? (
        <Button size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={() => run(() => deleteThreadAction(threadId), { confirm: 'حذف الموضوع بكل ردوده؟', done: () => router.push('/forum') })}>
          <Trash2 className="size-4" /> حذف
        </Button>
      ) : null}
    </div>
  )
}

export function PostActions({ postId, canDelete, admin, hidden }: { postId: string; canDelete: boolean; admin: boolean; hidden: boolean }) {
  const { pending, run } = useRun()
  if (!canDelete && !admin) return null
  return (
    <div className="flex gap-1">
      {admin ? (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => hidePostAction(postId, !hidden))} title={hidden ? 'إظهار الردّ' : 'إخفاء الردّ'}>
          {hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
        </Button>
      ) : null}
      {canDelete ? (
        <Button size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={() => run(() => deletePostAction(postId), { confirm: 'حذف هذا الردّ؟' })} title="حذف الردّ">
          <Trash2 className="size-4" />
        </Button>
      ) : null}
    </div>
  )
}
