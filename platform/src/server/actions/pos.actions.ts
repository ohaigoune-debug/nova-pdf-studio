'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requestMeta, requireActor, requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { AppError } from '@/server/lib/errors'
import { checkRateLimit } from '@/server/lib/rate-limit'
import {
  addPosMember,
  cancelPosCode,
  confirmPosSale,
  createPointOfSale,
  generatePosCode,
  generatePosCodeFor,
  movePosStock,
  pickPosSaleStudent,
  recordPosPayment,
  requestRestock,
  resetPosMemberPassword,
  setPosMemberActive,
  setPosStatus,
  startPosSale,
  undoPosActivation,
  updatePointOfSale,
  type GeneratedPosCode,
  type PosCredentials,
  type PosSaleResult
} from '@/server/services/points-of-sale.service'

const uuid = z.string().uuid()
const STAFF = ['SUPER_ADMIN', 'MANAGER'] as const

function revalidatePos(posId?: string) {
  revalidatePath('/admin/points-of-sale')
  if (posId) revalidatePath(`/admin/points-of-sale/${posId}`)
  revalidatePath('/pos')
}

const posSchema = z.object({
  name: z.string().trim().min(2, 'اسم المدرسة أو المكتبة').max(120),
  wilayaId: z.union([uuid, z.literal('')]).optional(),
  address: z.string().trim().max(300).optional(),
  phone: z.string().trim().max(20).optional(),
  listed: z.boolean(),
  commissionDzd: z.number().int().min(0).max(1_000_000).optional(),
  lowStockAlert: z.number().int().min(0).max(1000).optional(),
  note: z.string().trim().max(500).optional()
})

function posFromForm(fd: FormData) {
  const num = (k: string) => {
    const v = String(fd.get(k) ?? '').trim()
    return v === '' ? undefined : Number(v)
  }
  return posSchema.safeParse({
    name: fd.get('name') ?? '',
    wilayaId: fd.get('wilayaId') ?? '',
    address: fd.get('address') ?? '',
    phone: fd.get('phone') ?? '',
    listed: fd.get('listed') === 'on',
    commissionDzd: num('commissionDzd'),
    lowStockAlert: num('lowStockAlert'),
    note: fd.get('note') ?? ''
  })
}

/** المشرف/مدير العمليات: نقطة بيع جديدة (العمولة يأخذها المشرف وحده) */
export async function createPosAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = posFromForm(fd)
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    const row = await createPointOfSale(await getDb(), await requireRole(...STAFF), { ...parsed.data, wilayaId: parsed.data.wilayaId || null })
    return { id: row.id }
  })
  if (r.ok) revalidatePos(r.data.id)
  return r
}

export async function updatePosAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const id = uuid.safeParse(fd.get('id'))
  if (!id.success) return failValidation(id.error)
  const parsed = posFromForm(fd)
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    await updatePointOfSale(await getDb(), await requireRole(...STAFF), id.data, { ...parsed.data, wilayaId: parsed.data.wilayaId || null })
    return { id: id.data }
  })
  if (r.ok) revalidatePos(id.data)
  return r
}

export async function setPosStatusAction(posId: string, status: 'ACTIVE' | 'SUSPENDED'): Promise<ActionResult> {
  const parsed = z.object({ posId: uuid, status: z.enum(['ACTIVE', 'SUSPENDED']) }).safeParse({ posId, status })
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    await setPosStatus(await getDb(), await requireRole(...STAFF), parsed.data.posId, parsed.data.status)
    return undefined
  })
  if (r.ok) revalidatePos(posId)
  return r
}

/** حساب جديد للنقطة: كلمة السر تظهر مرة واحدة مع رابط واتساب */
export async function addPosMemberAction(posId: string, input: { fullName: string; phone: string }): Promise<ActionResult<PosCredentials>> {
  const parsed = z.object({ posId: uuid, fullName: z.string().trim().min(2, 'الاسم').max(120), phone: z.string().trim().min(9, 'رقم الهاتف').max(20) }).safeParse({ posId, ...input })
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => addPosMember(await getDb(), await requireRole(...STAFF), parsed.data.posId, { fullName: parsed.data.fullName, phone: parsed.data.phone }))
  if (r.ok) revalidatePos(posId)
  return r
}

export async function resetPosMemberAction(userId: string): Promise<ActionResult<PosCredentials>> {
  const parsed = uuid.safeParse(userId)
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => resetPosMemberPassword(await getDb(), await requireRole(...STAFF), parsed.data))
}

export async function setPosMemberActiveAction(posId: string, userId: string, active: boolean): Promise<ActionResult> {
  const parsed = z.object({ posId: uuid, userId: uuid, active: z.boolean() }).safeParse({ posId, userId, active })
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    await setPosMemberActive(await getDb(), await requireRole(...STAFF), parsed.data.userId, parsed.data.active)
    return undefined
  })
  if (r.ok) revalidatePos(posId)
  return r
}

/** إرسال باقات (+) أو استرجاع ما لم يُبع (−) */
export async function movePosStockAction(posId: string, input: { courseId: string; qty: number; note?: string | null }): Promise<ActionResult<{ remaining: number }>> {
  const parsed = z.object({ posId: uuid, courseId: uuid, qty: z.number().int().refine((v) => v !== 0 && Math.abs(v) <= 10_000, 'عدد الباقات'), note: z.string().trim().max(300).nullish() }).safeParse({ posId, ...input })
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => movePosStock(await getDb(), await requireRole(...STAFF), parsed.data.posId, { courseId: parsed.data.courseId, qty: parsed.data.qty, note: parsed.data.note }))
  if (r.ok) revalidatePos(posId)
  return r
}

/** مدير العمليات يولّد كودًا نيابة عن نقطة */
export async function generatePosCodeForAction(posId: string, courseId: string): Promise<ActionResult<GeneratedPosCode>> {
  const parsed = z.object({ posId: uuid, courseId: uuid }).safeParse({ posId, courseId })
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => generatePosCodeFor(await getDb(), await requireRole(...STAFF), parsed.data.posId, parsed.data.courseId))
  if (r.ok) revalidatePos(posId)
  return r
}

/** المال المستلَم من النقطة (قيد لا يُحذف) */
export async function recordPosPaymentAction(posId: string, input: { amountDzd: number; note?: string | null }): Promise<ActionResult> {
  const parsed = z.object({ posId: uuid, amountDzd: z.number().int().positive('المبلغ').max(100_000_000), note: z.string().trim().max(300).nullish() }).safeParse({ posId, ...input })
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    await recordPosPayment(await getDb(), await requireRole(...STAFF), parsed.data.posId, { amountDzd: parsed.data.amountDzd, note: parsed.data.note })
    return undefined
  })
  if (r.ok) revalidatePos(posId)
  return r
}

/* ───────────── واجهة نقطة البيع ───────────── */

/** «بعت باقة — أعطني الكود» */
export async function generatePosCodeAction(courseId: string): Promise<ActionResult<GeneratedPosCode>> {
  const parsed = uuid.safeParse(courseId)
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    const actor = await requireRole('POINT_OF_SALE')
    const db = await getDb()
    await checkRateLimit(db, { scope: 'pos-code', subject: actor.userId, limit: 60, windowSeconds: 3600 })
    return generatePosCode(db, actor, parsed.data)
  })
  if (r.ok) revalidatePath('/pos')
  return r
}

/* ───── البيع برمز SMS (18 نوفمبر 2026) ───── */

const saleStartSchema = z.object({ courseId: uuid, phone: z.string().trim().min(9).max(20) })

/** «أرسل رمز التفعيل للتلميذ»: رسالة واحدة إلى هاتف التلميذ (لا بيع قبل الرمز) */
export async function startPosSaleAction(input: { courseId: string; phone: string }): Promise<ActionResult<{ phoneMasked: string }>> {
  const parsed = saleStartSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => {
    const actor = await requireRole('POINT_OF_SALE')
    const db = await getDb()
    // سقف للرسائل من حساب مكتبة واحد (كل رسالة كلفة): يكفي يوم بيع مزدحم
    await checkRateLimit(db, { scope: 'pos-sms', subject: actor.userId, limit: 40, windowSeconds: 3600 })
    const r = await startPosSale(db, actor, { ...parsed.data, ip: (await requestMeta()).ip })
    return { phoneMasked: r.phoneMasked }
  })
}

const saleConfirmSchema = z.object({ courseId: uuid, phone: z.string().trim().min(9).max(20), code: z.string().trim().min(4).max(12) })

/** «فعّل الدورة الآن»: الرمز الذي قرأه التلميذ */
export async function confirmPosSaleAction(input: { courseId: string; phone: string; code: string }): Promise<ActionResult<PosSaleResult>> {
  const parsed = saleConfirmSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => confirmPosSale(await getDb(), await requireRole('POINT_OF_SALE'), parsed.data))
  if (r.ok) revalidatePath('/pos')
  return r
}

/** رقم يحمله أكثر من حساب: اختيار التلميذ */
export async function pickPosSaleStudentAction(input: { ticket: string; studentId: string }): Promise<ActionResult<PosSaleResult>> {
  const parsed = z.object({ ticket: z.string().min(10).max(4000), studentId: uuid }).safeParse(input)
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => pickPosSaleStudent(await getDb(), await requireRole('POINT_OF_SALE'), parsed.data))
  if (r.ok) revalidatePath('/pos')
  return r
}

/** تراجع عن تفعيل خاطئ: المكتبة خلال 24 ساعة، والمشرف/مدير العمليات دائمًا */
export async function undoPosActivationAction(codeId: string): Promise<ActionResult> {
  const parsed = uuid.safeParse(codeId)
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    const actor = await requireActor()
    if (!['POINT_OF_SALE', ...STAFF].includes(actor.role)) throw new AppError('FORBIDDEN')
    await undoPosActivation(await getDb(), actor, parsed.data)
    return undefined
  })
  if (r.ok) revalidatePos()
  return r
}

/** إلغاء كود لم يُستعمل (النقطة خلال 48 ساعة، أو المشرف/مدير العمليات) */
export async function cancelPosCodeAction(codeId: string): Promise<ActionResult> {
  const parsed = uuid.safeParse(codeId)
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    const actor = await requireActor()
    if (actor.role !== 'POINT_OF_SALE' && actor.role !== 'SUPER_ADMIN' && actor.role !== 'MANAGER') throw new AppError('FORBIDDEN')
    await cancelPosCode(await getDb(), actor, parsed.data)
    return undefined
  })
  if (r.ok) {
    revalidatePath('/pos')
    revalidatePath('/admin/points-of-sale', 'layout')
  }
  return r
}

export async function requestRestockAction(input: { courseId?: string | null; qty?: number | null; note?: string | null }): Promise<ActionResult> {
  const parsed = z.object({ courseId: uuid.nullish(), qty: z.number().int().min(1).max(1000).nullish(), note: z.string().trim().max(200).nullish() }).safeParse(input)
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => {
    const actor = await requireRole('POINT_OF_SALE')
    const db = await getDb()
    await checkRateLimit(db, { scope: 'pos-restock', subject: actor.userId, limit: 5, windowSeconds: 3600 })
    await requestRestock(db, actor, parsed.data)
    return undefined
  })
}
