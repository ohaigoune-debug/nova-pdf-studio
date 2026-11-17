'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { fail, failValidation, ok, runAction, type ActionResult } from '@/server/lib/action-result'
import { isAppError } from '@/server/lib/errors'
import { cancelMyScopeRequest, decideScopeRequest, requestScopeChange, saveStudentLevelStream } from '@/server/services/student-scope.service'

const schema = z.object({
  levelId: z.string().uuid('اختر المستوى'),
  streamId: z.string().uuid().optional().or(z.literal(''))
})

const FIELD_MSG: Record<string, string> = {
  levelId: 'اختر المستوى',
  streamId: 'اختر شعبة من شعب سنتك',
  pending: 'لديك طلب قيد المراجعة؛ انتظر قرار عون التأكيد أو اسحبه أولًا',
  note: 'اكتب سبب الرفض ليصل إلى التلميذ',
  status: 'قُرّر في هذا الطلب من قبل أو سحبه التلميذ'
}

const STUDENT_PATHS = ['/student/lessons', '/student/files', '/student/profile', '/student', '/lessons']

/** خطأ حقل ⇒ تحت الحقل نفسه؛ «نفس المستوى والشعبة» برسالة خاصة؛ غيره برسالته المعتادة */
async function guarded(fn: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await fn()
    return ok(undefined)
  } catch (err) {
    if (isAppError(err) && err.code === 'VALIDATION' && typeof err.details?.field === 'string') {
      const field = err.details.field
      const msg = err.details.reason === 'SAME_SCOPE' ? 'هذا هو مستواك وشعبتك الحاليان' : (FIELD_MSG[field] ?? 'قيمة غير صحيحة')
      return fail('VALIDATION', { [field === 'pending' || field === 'status' ? '_' : field]: msg })
    }
    if (isAppError(err) && err.code === 'FORBIDDEN' && err.details?.reason === 'SCOPE_CHANGE_NEEDS_REQUEST') return fail('VALIDATION', { _: 'مستواك وشعبتك محفوظان؛ لتغييرهما أرسل طلبًا من «حسابي»' })
    return runAction(() => Promise.reject(err))
  }
}

/** الاختيار الأول (مرة واحدة) لمن لا مستوى أو شعبة له */
export async function saveMyLevelStreamAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = schema.safeParse({ levelId: form.get('levelId') ?? '', streamId: form.get('streamId') ?? '' })
  if (!parsed.success) return failValidation(parsed.error)
  const actor = await requireActor()
  const r = await guarded(async () => saveStudentLevelStream(await getDb(), actor, { levelId: parsed.data.levelId, streamId: parsed.data.streamId || null }))
  if (r.ok) for (const p of STUDENT_PATHS) revalidatePath(p)
  return r
}

/** طلب تغيير المستوى/الشعبة: يراجعه عون التأكيد */
export async function requestScopeChangeAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = schema.safeParse({ levelId: form.get('levelId') ?? '', streamId: form.get('streamId') ?? '' })
  if (!parsed.success) return failValidation(parsed.error)
  const actor = await requireActor()
  const r = await guarded(async () => requestScopeChange(await getDb(), actor, { levelId: parsed.data.levelId, streamId: parsed.data.streamId || null, reason: String(form.get('reason') ?? '') }))
  if (r.ok) revalidatePath('/student/profile')
  return r
}

export async function cancelScopeRequestAction(): Promise<void> {
  const actor = await requireActor()
  await cancelMyScopeRequest(await getDb(), actor)
  revalidatePath('/student/profile')
}

/** عون التأكيد (أو المشرف): قبول أو رفض بسبب */
export async function decideScopeRequestAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const actor = await requireActor()
  const r = await guarded(async () => decideScopeRequest(await getDb(), actor, String(form.get('id') ?? ''), { approve: form.get('decision') === 'approve', note: String(form.get('note') ?? '') }))
  if (r.ok) revalidatePath('/admin/scope-requests')
  return r
}
