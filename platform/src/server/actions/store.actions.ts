'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireActor, requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { ORDER_STATUSES, PRODUCT_STATUSES, PRODUCT_TYPES } from '@/server/db/schema/enums'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { RATE_LIMITS, checkRateLimit } from '@/server/lib/rate-limit'
import { uploadFile } from '@/server/services/files.service'
import { attachProductFile, createProduct, deleteProduct, detachProductFile, downloadUrl, placeOrder, setOrderStatus, updateProduct, type ProductInput } from '@/server/services/store.service'

const uuid = z.string().uuid()
const optUuid = z.string().uuid().nullish()
const productSchema = z.object({
  title: z.string().min(2).max(200),
  slug: z.string().max(80).nullish(),
  description: z.string().max(4000).nullish(),
  type: z.enum(PRODUCT_TYPES).optional(),
  author: z.string().max(120).nullish(),
  pages: z.coerce.number().int().min(1).max(5000).nullish(),
  priceDzd: z.coerce.number().int().min(0).max(1_000_000),
  comparePriceDzd: z.coerce.number().int().min(0).max(1_000_000).nullish(),
  stock: z.coerce.number().int().min(0).max(100_000).nullish(),
  subjectId: optUuid,
  levelId: optUuid,
  streamId: optUuid,
  coverUrl: z.string().url().max(500).nullish(),
  status: z.enum(PRODUCT_STATUSES).optional(),
  sortOrder: z.coerce.number().int().min(0).max(10_000).optional()
})

const revalidate = () => {
  revalidatePath('/admin/store')
  revalidatePath('/store')
}

function fromForm(fd: FormData) {
  const s = (k: string) => {
    const v = fd.get(k)
    return typeof v === 'string' && v.trim() ? v.trim() : null
  }
  return { title: s('title') ?? '', slug: s('slug'), description: s('description'), type: s('type') ?? undefined, author: s('author'), pages: s('pages'), priceDzd: s('priceDzd') ?? '0', comparePriceDzd: s('comparePriceDzd'), stock: s('stock'), subjectId: s('subjectId'), levelId: s('levelId'), streamId: s('streamId'), coverUrl: s('coverUrl'), status: s('status') ?? undefined, sortOrder: s('sortOrder') ?? undefined }
}

/** إنشاء/تعديل منتج من نموذج (مع ملف غلاف اختياري وملفات رقمية اختيارية) */
export async function saveProductAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const id = fd.get('id')
  const parsed = productSchema.safeParse(fromForm(fd))
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    const db = await getDb()
    const input = parsed.data as ProductInput
    const cover = fd.get('cover')
    if (cover instanceof File && cover.size > 0) {
      const f = await uploadFile(db, actor, { originalName: cover.name, mimeType: cover.type || 'application/octet-stream', bytes: Buffer.from(await cover.arrayBuffer()) })
      input.coverFileId = f.id
    }
    const row = typeof id === 'string' && id ? await updateProduct(db, actor, id, input) : await createProduct(db, actor, input)
    for (const f of fd.getAll('files')) {
      if (f instanceof File && f.size > 0) {
        const up = await uploadFile(db, actor, { originalName: f.name, mimeType: f.type || 'application/pdf', bytes: Buffer.from(await f.arrayBuffer()) })
        await attachProductFile(db, actor, row.id, up.id, f.name)
      }
    }
    return { id: row.id }
  })
  if (result.ok) revalidate()
  return result
}

export async function setProductStatusAction(id: string, status: (typeof PRODUCT_STATUSES)[number]): Promise<ActionResult> {
  const parsed = z.object({ id: uuid, status: z.enum(PRODUCT_STATUSES) }).safeParse({ id, status })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await updateProduct(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data.id, { status: parsed.data.status })
    return undefined
  })
  if (result.ok) revalidate()
  return result
}

export async function deleteProductAction(id: string): Promise<ActionResult> {
  const parsed = uuid.safeParse(id)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await deleteProduct(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data)
    return undefined
  })
  if (result.ok) revalidate()
  return result
}

export async function detachProductFileAction(productFileId: string): Promise<ActionResult> {
  const parsed = uuid.safeParse(productFileId)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await detachProductFile(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data)
    return undefined
  })
  if (result.ok) revalidate()
  return result
}

export async function placeOrderAction(input: { items: { productId: string; qty: number }[]; customerName: string; phone: string; wilayaId?: string | null; address?: string | null; note?: string | null }): Promise<ActionResult<{ id: string; number: string; status: string }>> {
  const parsed = z.object({ items: z.array(z.object({ productId: uuid, qty: z.number().int().min(1).max(20) })).min(1).max(20), customerName: z.string().min(2).max(120), phone: z.string().min(9).max(20), wilayaId: optUuid, address: z.string().max(400).nullish(), note: z.string().max(500).nullish() }).safeParse(input)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireActor()
    const db = await getDb()
    await checkRateLimit(db, { scope: 'store-order', subject: actor.userId, ...RATE_LIMITS.aiRequest })
    const o = await placeOrder(db, actor, parsed.data)
    return { id: o.id, number: o.number, status: o.status }
  })
  if (result.ok) {
    revalidatePath('/store/orders')
    revalidatePath('/admin/store')
  }
  return result
}

export async function setOrderStatusAction(id: string, status: (typeof ORDER_STATUSES)[number], opts?: { reason?: string | null; adminNote?: string | null; shippingDzd?: number | null }): Promise<ActionResult> {
  const parsed = z.object({ id: uuid, status: z.enum(ORDER_STATUSES), reason: z.string().max(300).nullish(), adminNote: z.string().max(500).nullish(), shippingDzd: z.number().int().min(0).max(100_000).nullish() }).safeParse({ id, status, ...(opts ?? {}) })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await setOrderStatus(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data.id, parsed.data.status, { reason: parsed.data.reason ?? null, adminNote: parsed.data.adminNote, shippingDzd: parsed.data.shippingDzd ?? null })
    return undefined
  })
  if (result.ok) {
    revalidatePath('/admin/store')
    revalidatePath(`/store/orders/${id}`)
  }
  return result
}

export async function downloadUrlAction(orderId: string, productFileId: string): Promise<ActionResult<{ url: string; name: string }>> {
  const parsed = z.object({ orderId: uuid, productFileId: uuid }).safeParse({ orderId, productFileId })
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => downloadUrl(await getDb(), await requireActor(), parsed.data.orderId, parsed.data.productFileId))
}
