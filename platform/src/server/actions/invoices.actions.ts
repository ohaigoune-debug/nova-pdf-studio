'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { INVOICE_PAYMENT_METHODS, type InvoicePaymentMethod } from '@/server/db/schema'
import { fail, ok, runAction, type ActionResult } from '@/server/lib/action-result'
import { isAppError } from '@/server/lib/errors'
import { cancelInvoice, createManualInvoice, findStudentsForInvoice, issueMissingInvoices, setInvoiceSettings } from '@/server/services/invoices.service'

const FIELD_MSG: Record<string, string> = {
  sellerName: 'اكتب اسم البائع (120 حرفًا على الأكثر)',
  sellerAddress: 'العنوان طويل جدًا (300 حرف على الأكثر)',
  sellerLegal: 'الأرقام القانونية طويلة جدًا (600 حرف على الأكثر)',
  footer: 'التذييل طويل جدًا (300 حرف على الأكثر)',
  prefix: 'البادئة: حروف لاتينية كبيرة وأرقام فقط (1 إلى 8)، مثل F أو MDZ',
  customerName: 'اكتب اسم الزبون أو اختر تلميذًا',
  lines: 'أضف سطرًا واحدًا على الأقل: الوصف، الكمية (1 فأكثر)، والسعر بالدينار',
  shippingDzd: 'التوصيل: عدد صحيح بالدينار',
  discountDzd: 'التخفيض: عدد صحيح لا يتجاوز المجموع',
  paymentMethod: 'اختر طريقة الدفع',
  studentId: 'التلميذ غير موجود',
  reason: 'اكتب سبب الإلغاء'
}

/** خطأ حقل من الخدمة ⇒ تحت الحقل نفسه؛ غيره برسالته المعتادة */
async function guarded<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await fn())
  } catch (err) {
    if (isAppError(err) && err.code === 'VALIDATION' && typeof err.details?.field === 'string') {
      const field = err.details.field
      return fail('VALIDATION', { [field]: FIELD_MSG[field] ?? 'قيمة غير صحيحة' })
    }
    return runAction(() => Promise.reject(err))
  }
}

const str = (form: FormData, k: string) => String(form.get(k) ?? '')

export async function saveInvoiceSettingsAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const actor = await requireActor()
  const r = await guarded(async () => {
    await setInvoiceSettings(await getDb(), actor, { sellerName: str(form, 'sellerName'), sellerAddress: str(form, 'sellerAddress'), sellerLegal: str(form, 'sellerLegal'), footer: str(form, 'footer'), prefix: str(form, 'prefix') })
  })
  if (r.ok) revalidatePath('/admin/invoices/settings')
  return r.ok ? ok(undefined) : r
}

const toInt = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim()
  return s === '' ? 0 : Number(s)
}

export async function createManualInvoiceAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const actor = await requireActor()
  const titles = form.getAll('lineTitle').map(String)
  const qtys = form.getAll('lineQty')
  const prices = form.getAll('linePrice')
  const lines = titles
    .map((title, i) => ({ title, qty: toInt(qtys[i] ?? null), unitDzd: toInt(prices[i] ?? null) }))
    .filter((l) => l.title.trim() || l.unitDzd)
  const method = str(form, 'paymentMethod')
  if (!(INVOICE_PAYMENT_METHODS as readonly string[]).includes(method)) return fail('VALIDATION', { paymentMethod: FIELD_MSG.paymentMethod! })
  const r = await guarded(async () =>
    createManualInvoice(await getDb(), actor, {
      studentId: str(form, 'studentId') || null,
      customerName: str(form, 'customerName'),
      customerPhone: str(form, 'customerPhone'),
      lines,
      shippingDzd: toInt(form.get('shippingDzd')),
      discountDzd: toInt(form.get('discountDzd')),
      paymentMethod: method as InvoicePaymentMethod,
      note: str(form, 'note')
    })
  )
  if (!r.ok) return r
  revalidatePath('/admin/invoices')
  redirect(`/print/invoices/${r.data.id}`)
}

export async function cancelInvoiceAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const actor = await requireActor()
  const id = str(form, 'id')
  const r = await guarded(async () => {
    await cancelInvoice(await getDb(), actor, id, str(form, 'reason'))
  })
  if (r.ok) {
    revalidatePath(`/print/invoices/${id}`)
    revalidatePath('/admin/invoices')
  }
  return r.ok ? ok(undefined) : r
}

export async function issueMissingInvoicesAction(_prev: ActionResult<{ issued: number; remaining: number }> | null): Promise<ActionResult<{ issued: number; remaining: number }>> {
  const actor = await requireActor()
  const r = await guarded(async () => issueMissingInvoices(await getDb(), actor))
  if (r.ok) revalidatePath('/admin/invoices')
  return r
}

/** بحث التلميذ في نموذج الفاتورة اليدوية */
export async function searchInvoiceStudentsAction(q: string): Promise<{ id: string; label: string; name: string; phone: string | null }[]> {
  const actor = await requireActor()
  const rows = await findStudentsForInvoice(await getDb(), actor, q).catch(() => [])
  return rows.map((r) => ({ id: r.id, name: r.fullName ?? '', phone: r.phone, label: [r.fullName, r.phone, r.email].filter(Boolean).join(' · ') }))
}
