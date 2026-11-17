/**
 * منع الدفع عند الاستلام لمن أرجع طلبًا بلا سبب (قرار المالك 17 نوفمبر 2026).
 *
 * الرقم ممنوع إذا:
 *  1) كان في القائمة المستوردة من نوفا أو أضافه المشرف (cod_phone_blocks) ولم يُعفَ، أو
 *  2) له في مدرسة طلب «مرتجع» بلا سبب بعد آخر إعفاء.
 * الإرجاع معذور (لا يُحسب) إذا كان للرقم نفسه طلب آخر سُلِّم أو شُحن خلال 7 أيام قبله أو بعده:
 * الزبون استلم طلبًا آخر فأرجع المكرَّر — القاعدة نفسها التي صُفّيت بها قائمة نوفا.
 * الممنوع يطلب بالبطاقة فقط؛ الحساب كله من الخادم (لا يُوثق بالمتصفح).
 */
import { and, desc, eq, ilike, inArray, isNull, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { codPhoneBlocks, orders, profiles } from '@/server/db/schema'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError } from '@/server/lib/errors'

export const EXCUSE_WINDOW_DAYS = 7
const PHONE_RE = /^0[5-7]\d{8}$/

export type CodBlockSource = 'NOVA' | 'ADMIN' | 'MADRASA'

export interface CodBlock {
  phone: string
  source: CodBlockSource
  returns: number
  lastReturnAt: Date | null
}

export const COD_SOURCE_AR: Record<CodBlockSource, string> = {
  NOVA: 'مرتجع في متجر نوفا',
  ADMIN: 'أضافه المشرف',
  MADRASA: 'مرتجع في مدرسة'
}

/** 0XXXXXXXXX من أي صيغة (+213، فراغات، شُرط)؛ null لغير الصالح */
export function localPhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '')
  const p = digits.length === 12 && digits.startsWith('213') ? `0${digits.slice(3)}` : digits.length === 9 ? `0${digits}` : digits
  return PHONE_RE.test(p) ? p : null
}

function uniquePhones(phones: readonly (string | null | undefined)[]): string[] {
  return [...new Set(phones.map(localPhone).filter((p): p is string => Boolean(p)))]
}

/** مرتجعات مدرسة بلا سبب لهذه الأرقام (كل مرتجع بتاريخه) */
async function unexcusedReturns(db: Db, phones: readonly string[]): Promise<{ phone: string; returnedAt: Date }[]> {
  if (!phones.length) return []
  const rows = await db
    .select({ phone: orders.phone, returnedAt: sql<Date>`coalesce(${orders.returnedAt}, ${orders.updatedAt})` })
    .from(orders)
    .where(
      and(
        inArray(orders.phone, [...phones]),
        eq(orders.status, 'RETURNED'),
        sql`not exists (
          select 1 from orders d
          where d.phone = ${orders.phone} and d.id <> ${orders.id} and d.status in ('DELIVERED', 'SHIPPED')
            and d.created_at between ${orders.createdAt} - make_interval(days => ${EXCUSE_WINDOW_DAYS}) and ${orders.createdAt} + make_interval(days => ${EXCUSE_WINDOW_DAYS})
        )`
      )
    )
  return rows.map((r) => ({ phone: r.phone, returnedAt: new Date(r.returnedAt) }))
}

/** أول منع ينطبق على أحد هذه الأرقام (هاتف الطلب وهاتف الحساب)، أو null */
export async function codBlockFor(db: Db, phones: readonly (string | null | undefined)[]): Promise<CodBlock | null> {
  const list = uniquePhones(phones)
  if (!list.length) return null
  const rows = await db.select().from(codPhoneBlocks).where(inArray(codPhoneBlocks.phone, list))
  const byPhone = new Map(rows.map((r) => [r.phone, r]))
  for (const phone of list) {
    const r = byPhone.get(phone)
    if (r && !r.liftedAt && r.source !== 'MADRASA') return { phone, source: r.source as CodBlockSource, returns: r.returns, lastReturnAt: r.lastReturnAt }
  }
  const returns = await unexcusedReturns(db, list)
  for (const phone of list) {
    const liftedAt = byPhone.get(phone)?.liftedAt ?? null
    const mine = returns.filter((x) => x.phone === phone && (!liftedAt || x.returnedAt > liftedAt))
    if (mine.length) return { phone, source: 'MADRASA', returns: mine.length, lastReturnAt: new Date(Math.max(...mine.map((x) => x.returnedAt.getTime()))) }
  }
  return null
}

/** هاتف الحساب (من التسجيل): يُفحص مع هاتف الطلب حتى لا يكفي تغيير رقم الاستلام */
export async function accountPhone(db: Db, userId: string): Promise<string | null> {
  const [p] = await db.select({ phone: profiles.phone }).from(profiles).where(eq(profiles.userId, userId)).limit(1)
  return p?.phone ?? null
}

/** يرفض الدفع عند الاستلام لرقم ممنوع — في كل مسار طلب (دورة، متجر): هاتف الطلب وهاتف الحساب */
export async function assertCodAllowed(db: Db, userId: string, orderPhone: string | null | undefined): Promise<void> {
  const block = await codBlockFor(db, [orderPhone, await accountPhone(db, userId)])
  if (block) throw new AppError('COD_BLOCKED', { source: block.source })
}

export interface CodBlockRow extends CodBlock {
  note: string | null
}

/** المشرف: الأرقام الممنوعة الآن (المستوردة واليدوية ومرتجعات مدرسة)، الأحدث إرجاعًا أولًا */
export async function listCodBlocks(db: Db, actor: Actor, opts: { q?: string; limit?: number } = {}): Promise<{ rows: CodBlockRow[]; total: number; lifted: number }> {
  assertRole(actor, 'SUPER_ADMIN')
  const q = (opts.q ?? '').replace(/\D/g, '').slice(0, 10)
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 500)
  const stored = await db
    .select()
    .from(codPhoneBlocks)
    .where(q ? ilike(codPhoneBlocks.phone, `%${q}%`) : undefined)
    .orderBy(desc(codPhoneBlocks.lastReturnAt))
  const liftedAtOf = new Map(stored.map((r) => [r.phone, r.liftedAt]))
  const out: CodBlockRow[] = stored.filter((r) => !r.liftedAt && r.source !== 'MADRASA').map((r) => ({ phone: r.phone, source: r.source as CodBlockSource, returns: r.returns, lastReturnAt: r.lastReturnAt, note: r.note }))
  const listed = new Set(out.map((r) => r.phone))
  // مرتجعات مدرسة بلا سبب (قليلة): كل الأرقام التي لها مرتجع، ثم تصفية المعذور والمُعفى
  const returnedPhones = await db
    .selectDistinct({ phone: orders.phone })
    .from(orders)
    .where(and(eq(orders.status, 'RETURNED'), q ? ilike(orders.phone, `%${q}%`) : undefined))
  const madrasa = await unexcusedReturns(db, returnedPhones.map((r) => r.phone).filter((p) => !listed.has(p)))
  const grouped = new Map<string, Date[]>()
  for (const x of madrasa) {
    const liftedAt = liftedAtOf.get(x.phone) ?? null
    if (liftedAt && x.returnedAt <= liftedAt) continue
    grouped.set(x.phone, [...(grouped.get(x.phone) ?? []), x.returnedAt])
  }
  for (const [phone, dates] of grouped) out.push({ phone, source: 'MADRASA', returns: dates.length, lastReturnAt: new Date(Math.max(...dates.map((d) => d.getTime()))), note: null })
  out.sort((a, b) => (b.lastReturnAt?.getTime() ?? 0) - (a.lastReturnAt?.getTime() ?? 0))
  const lifted = stored.filter((r) => r.liftedAt).length
  return { rows: out.slice(0, limit), total: out.length, lifted }
}

/** المشرف: يمنع رقمًا يدويًا (أو يعيد منع رقم أُعفي) */
export async function blockPhone(db: Db, actor: Actor, raw: string, note?: string | null): Promise<void> {
  assertRole(actor, 'SUPER_ADMIN')
  const phone = localPhone(raw)
  if (!phone) throw new AppError('VALIDATION', { field: 'phone' })
  const now = new Date()
  const [before] = await db.select().from(codPhoneBlocks).where(eq(codPhoneBlocks.phone, phone)).limit(1)
  const clean = note?.trim().slice(0, 300) || null
  if (before) {
    await db
      .update(codPhoneBlocks)
      .set({ source: before.source === 'MADRASA' ? 'ADMIN' : before.source, liftedAt: null, liftedBy: null, note: clean ?? before.note, updatedAt: now })
      .where(eq(codPhoneBlocks.phone, phone))
  } else {
    await db.insert(codPhoneBlocks).values({ phone, source: 'ADMIN', note: clean })
  }
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'store.cod_block', entityType: 'phone', entityId: null, oldValue: before ? { source: before.source, liftedAt: before.liftedAt } : null, newValue: { phone, note: clean } })
}

/** المشرف: يُعفي رقمًا (أرجع لسبب مقبول) — مرتجع جديد بلا سبب بعد الإعفاء يمنعه من جديد */
export async function liftPhone(db: Db, actor: Actor, raw: string, note?: string | null): Promise<void> {
  assertRole(actor, 'SUPER_ADMIN')
  const phone = localPhone(raw)
  if (!phone) throw new AppError('VALIDATION', { field: 'phone' })
  const now = new Date()
  const clean = note?.trim().slice(0, 300) || null
  const [before] = await db.select().from(codPhoneBlocks).where(eq(codPhoneBlocks.phone, phone)).limit(1)
  if (before) {
    await db.update(codPhoneBlocks).set({ liftedAt: now, liftedBy: actor.userId, note: clean ?? before.note, updatedAt: now }).where(eq(codPhoneBlocks.phone, phone))
  } else {
    const mine = await unexcusedReturns(db, [phone])
    if (!mine.length) throw new AppError('NOT_FOUND')
    await db.insert(codPhoneBlocks).values({ phone, source: 'MADRASA', returns: mine.length, lastReturnAt: new Date(Math.max(...mine.map((x) => x.returnedAt.getTime()))), note: clean, liftedAt: now, liftedBy: actor.userId })
  }
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'store.cod_lift', entityType: 'phone', entityId: null, oldValue: before ? { source: before.source, liftedAt: before.liftedAt } : null, newValue: { phone, note: clean } })
}

/** عدد الأرقام الممنوعة من كل مصدر (لرأس الصفحة) — المستوردة غير المُعفاة فقط */
export async function codBlockCounts(db: Db): Promise<Record<'NOVA' | 'ADMIN', number>> {
  const rows = await db
    .select({ source: codPhoneBlocks.source, n: sql<number>`count(*)::int` })
    .from(codPhoneBlocks)
    .where(isNull(codPhoneBlocks.liftedAt))
    .groupBy(codPhoneBlocks.source)
  const m = Object.fromEntries(rows.map((r) => [r.source, Number(r.n)]))
  return { NOVA: m.NOVA ?? 0, ADMIN: m.ADMIN ?? 0 }
}
