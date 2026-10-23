'use client'

import { CheckCircle2, Send } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useRef, useTransition } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { SUPPORT_KINDS, SUPPORT_STATUSES, type SupportKind, type SupportStatus } from '@/server/db/schema/enums'
import { assignTicketAction, openTicketAction, replyTicketAction, setTicketStatusAction } from '@/server/actions/support.actions'
import { KIND_AR, STATUS_AR } from './labels'


/** نموذج فتح تذكرة (التلميذ أو أي مستخدم مسجَّل) */
export function NewTicketForm({ basePath, defaultKind, orderId, courseId, orders }: { basePath: string; defaultKind?: SupportKind; orderId?: string | null; courseId?: string | null; orders?: { id: string; number: string }[] }) {
  const [state, action] = useActionState(openTicketAction, null)
  if (state?.ok) {
    return (
      <div className="space-y-4 py-4 text-center">
        <CheckCircle2 className="mx-auto size-12 text-success" />
        <p className="text-lg font-bold">فُتحت التذكرة رقم #{state.data.number}</p>
        <p className="text-sm text-muted-foreground">سيصلك إشعار عند ردّ فريق الدعم.</p>
        <Button asChild>
          <Link href={`${basePath}/${state.data.id}`}>فتح التذكرة</Link>
        </Button>
      </div>
    )
  }
  return (
    <form action={action} className="space-y-4">
      {courseId ? <input type="hidden" name="courseId" value={courseId} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="نوع المشكلة" htmlFor="kind" error={fieldError(state, 'kind')}>
          <Select id="kind" name="kind" defaultValue={defaultKind ?? 'OTHER'}>
            {SUPPORT_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_AR[k]}
              </option>
            ))}
          </Select>
        </Field>
        {orders && orders.length > 0 ? (
          <Field label="الطلب المعني (اختياري)" htmlFor="orderId">
            <Select id="orderId" name="orderId" defaultValue={orderId ?? ''}>
              <option value="">— بلا طلب —</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.number}
                </option>
              ))}
            </Select>
          </Field>
        ) : orderId ? (
          <input type="hidden" name="orderId" value={orderId} />
        ) : null}
      </div>
      <Field label="الموضوع" htmlFor="subject" error={fieldError(state, 'subject')}>
        <Input id="subject" name="subject" required minLength={3} maxLength={200} placeholder="مثال: لم تُفعَّل الدورة بعد استلام الكتاب" />
      </Field>
      <Field label="التفاصيل" htmlFor="body" error={fieldError(state, 'body')} hint="اذكر رقم الطلب أو اسم الدورة وما حدث بالضبط؛ كلما كانت التفاصيل أدقّ كان الحلّ أسرع.">
        <Textarea id="body" name="body" required minLength={2} maxLength={5000} rows={5} />
      </Field>
      <p className="text-xs text-muted-foreground">الشكاوى عن الأساتذة سرّية: لا يطّلع عليها إلا المشرف العام.</p>
      <FormError state={state} />
      <SubmitButton>
        <Send className="size-4" /> إرسال التذكرة
      </SubmitButton>
    </form>
  )
}

/** نموذج الردّ داخل التذكرة؛ للموظف خيار «ملاحظة داخلية» */
export function ReplyForm({ ticketId, staff, disabled }: { ticketId: string; staff: boolean; disabled?: boolean }) {
  const [state, action] = useActionState(replyTicketAction, null)
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()
  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset()
      router.refresh()
    }
  }, [state, router])
  if (disabled) return <p className="rounded-md border border-dashed p-3 text-center text-sm text-muted-foreground">هذه التذكرة مغلقة. افتح تذكرة جديدة إن احتجت.</p>
  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="ticketId" value={ticketId} />
      <Textarea name="body" required minLength={2} maxLength={5000} rows={4} placeholder={staff ? 'اكتب ردّك للمستخدم…' : 'اكتب ردّك…'} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {staff ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="internal" className="size-4 accent-primary" /> ملاحظة داخلية (لا يراها صاحب التذكرة)
          </label>
        ) : (
          <span />
        )}
        <SubmitButton size="sm">
          <Send className="size-4" /> إرسال
        </SubmitButton>
      </div>
      <FormError state={state} />
    </form>
  )
}

/** صاحب التذكرة: إغلاق/إعادة فتح. المشرف: كل الحالات + الإسناد */
export function TicketControls({ ticketId, status, staff, assignedToUserId, agents }: { ticketId: string; status: SupportStatus; staff: boolean; assignedToUserId?: string | null; agents?: { id: string; name: string }[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, okMsg: string) =>
    start(async () => {
      const r = await fn()
      if (!r.ok) return toast('error', r.error!.message)
      toast('success', okMsg)
      router.refresh()
    })
  if (!staff) {
    return status === 'CLOSED' || status === 'RESOLVED' ? (
      <Button size="sm" variant="outline" loading={pending} onClick={() => run(() => setTicketStatusAction(ticketId, 'OPEN'), 'أُعيد فتح التذكرة')}>
        إعادة فتح
      </Button>
    ) : (
      <Button size="sm" variant="ghost" loading={pending} onClick={() => confirm('إغلاق التذكرة؟') && run(() => setTicketStatusAction(ticketId, 'CLOSED'), 'أُغلقت التذكرة')}>
        إغلاق التذكرة
      </Button>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select aria-label="الحالة" className="h-9 w-auto text-xs" value={status} disabled={pending} onChange={(e) => run(() => setTicketStatusAction(ticketId, e.target.value as SupportStatus), 'حُدّثت الحالة')}>
        {SUPPORT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_AR[s]}
          </option>
        ))}
      </Select>
      {agents ? (
        <Select aria-label="المسؤول" className="h-9 w-auto text-xs" value={assignedToUserId ?? ''} disabled={pending} onChange={(e) => run(() => assignTicketAction(ticketId, e.target.value || null), 'حُدّث الإسناد')}>
          <option value="">— غير مُسنَدة —</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      ) : null}
    </div>
  )
}
