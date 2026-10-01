/**
 * سوق الأساتذة (Exam Builder — المرحلة 11).
 * الأستاذ يعرض امتحاناً أو مجموعة تمارين أو حزمة أسئلة من بنكه (تُنسخ إلى مساحة المشتري الأستاذ)
 * أو ملخّصاً PDF (يُنزَّل)، مجاناً أو بثمن. المشرف يراجع ويُنشر العرض منتجاً في المتجر؛
 * الشراء بطلبات المتجر نفسها؛ عند التأكيد يُسلَّم العرض ويُحسب نصيب الأستاذ. الحقوق مؤكَّدة قبل الإرسال.
 */
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { bankQuestions, exams, examItems, files, levels, listingPurchases, listings, orderItems, orders, productFiles, products, profiles, subjects, teacherPayouts, teacherWorkspaces, users, type ListingRow } from '@/server/db/schema'
import type { ListingKind, ListingStatus } from '@/server/db/schema/enums'
import { LISTING_KINDS } from '@/server/db/schema/enums'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { copyExamToWorkspace, getExam, getExamUnchecked, type ExamView } from './exams.service'
import { notify } from './notifications.service'
import { copyQuestionsToWorkspace } from './question-bank.service'
import { slugify } from './store.service'

export const LISTING_KIND_AR: Record<ListingKind, string> = { EXAM: 'امتحان جاهز', EXERCISE_SET: 'مجموعة تمارين', SUMMARY: 'ملخّص (PDF)', QUESTION_BANK: 'حزمة أسئلة للبنك' }
export const LISTING_STATUS_AR: Record<ListingStatus, string> = { DRAFT: 'مسودة', PENDING_REVIEW: 'بانتظار المراجعة', PUBLISHED: 'منشور', REJECTED: 'مرفوض', ARCHIVED: 'مؤرشف' }

/** نصيب الأستاذ من كل بيع (%) — من البيئة، 70 افتراضياً */
export const teacherSharePct = (): number => Math.max(0, Math.min(100, Number(process.env.MARKETPLACE_TEACHER_SHARE_PCT ?? 70) || 70))

const ws = (actor: Actor): string => {
  assertRole(actor, 'TEACHER')
  if (!actor.workspaceId) throw new AppError('FORBIDDEN')
  return actor.workspaceId
}

export interface ListingInput {
  kind: ListingKind
  title: string
  description?: string | null
  priceDzd: number
  subjectId?: string | null
  levelId?: string | null
  streamId?: string | null
  examId?: string | null
  fileId?: string | null
  questionIds?: string[]
  rightsConfirmed?: boolean
}

/** الامتحان والأسئلة تُنسخ إلى مساحة المشتري ⇒ للأساتذة فقط؛ الملخّص للجميع */
const teachersOnlyFor = (kind: ListingKind) => kind !== 'SUMMARY'

async function validateSource(db: Db, actor: Actor, workspaceId: string, input: ListingInput) {
  if (!LISTING_KINDS.includes(input.kind)) throw new AppError('VALIDATION', { field: 'kind' })
  if (!input.title?.trim()) throw new AppError('VALIDATION', { field: 'title' })
  if (!(Number.isInteger(input.priceDzd) && input.priceDzd >= 0 && input.priceDzd <= 100_000)) throw new AppError('VALIDATION', { field: 'priceDzd' })
  if (input.kind === 'EXAM') {
    if (!input.examId) throw new AppError('LISTING_SOURCE_INVALID')
    const v = await getExam(db, actor, input.examId)
    if (!v.items.some((i) => i.kind === 'EXERCISE' || i.kind === 'QUESTION')) throw new AppError('LISTING_SOURCE_INVALID')
  } else if (input.kind === 'SUMMARY') {
    if (!input.fileId) throw new AppError('LISTING_SOURCE_INVALID')
    assertUuid(input.fileId, 'FILE_NOT_FOUND')
    const [f] = await db.select({ id: files.id }).from(files).where(and(eq(files.id, input.fileId), eq(files.workspaceId, workspaceId), isNull(files.deletedAt))).limit(1)
    if (!f) throw new AppError('LISTING_SOURCE_INVALID')
  } else {
    const ids = [...new Set(input.questionIds ?? [])]
    if (ids.length === 0 || ids.length > 200) throw new AppError('LISTING_SOURCE_INVALID')
    for (const id of ids) assertUuid(id, 'LISTING_SOURCE_INVALID')
    const rows = await db.select({ id: bankQuestions.id, rights: bankQuestions.rightsStatus }).from(bankQuestions).where(and(inArray(bankQuestions.id, ids), eq(bankQuestions.workspaceId, workspaceId), isNull(bankQuestions.deletedAt), isNull(bankQuestions.parentId), eq(bankQuestions.status, 'PUBLISHED')))
    if (rows.length !== ids.length) throw new AppError('LISTING_SOURCE_INVALID')
    // لا تُباع أسئلة طرف ثالث أو مجهولة الحقوق
    if (rows.some((r) => r.rights === 'THIRD_PARTY' || r.rights === 'UNKNOWN')) throw new AppError('LISTING_RIGHTS_REQUIRED')
  }
}

export async function createListing(db: Db, actor: Actor, input: ListingInput): Promise<ListingRow> {
  const workspaceId = ws(actor)
  await validateSource(db, actor, workspaceId, input)
  const [row] = await db
    .insert(listings)
    .values({ workspaceId, teacherUserId: actor.userId, kind: input.kind, title: input.title.trim(), description: input.description?.trim() || null, priceDzd: input.priceDzd, subjectId: input.subjectId ?? null, levelId: input.levelId ?? null, streamId: input.streamId ?? null, examId: input.kind === 'EXAM' ? input.examId : null, fileId: input.kind === 'SUMMARY' ? input.fileId : null, questionIds: input.kind === 'EXERCISE_SET' || input.kind === 'QUESTION_BANK' ? [...new Set(input.questionIds ?? [])] : [], teachersOnly: teachersOnlyFor(input.kind), rightsConfirmed: Boolean(input.rightsConfirmed), teacherSharePct: teacherSharePct() })
    .returning()
  await writeAudit(db, { actorUserId: actor.userId, workspaceId, action: 'market.listing_create', entityType: 'listing', entityId: row!.id, newValue: { kind: row!.kind, title: row!.title, priceDzd: row!.priceDzd } })
  return row!
}

async function ownListing(db: Db, actor: Actor, id: string): Promise<ListingRow> {
  const workspaceId = ws(actor)
  assertUuid(id, 'LISTING_NOT_FOUND')
  const [row] = await db.select().from(listings).where(and(eq(listings.id, id), eq(listings.workspaceId, workspaceId), isNull(listings.deletedAt))).limit(1)
  if (!row) throw new AppError('LISTING_NOT_FOUND')
  return row
}

export async function updateListing(db: Db, actor: Actor, id: string, patch: Partial<Pick<ListingInput, 'title' | 'description' | 'priceDzd' | 'subjectId' | 'levelId' | 'streamId' | 'rightsConfirmed'>>): Promise<ListingRow> {
  const cur = await ownListing(db, actor, id)
  if (cur.status === 'PENDING_REVIEW' || cur.status === 'ARCHIVED') throw new AppError('LISTING_INVALID_STATE')
  if (patch.title !== undefined && !patch.title.trim()) throw new AppError('VALIDATION', { field: 'title' })
  if (patch.priceDzd !== undefined && !(Number.isInteger(patch.priceDzd) && patch.priceDzd >= 0 && patch.priceDzd <= 100_000)) throw new AppError('VALIDATION', { field: 'priceDzd' })
  const [row] = await db
    .update(listings)
    .set({ title: patch.title?.trim() ?? cur.title, description: patch.description !== undefined ? patch.description?.trim() || null : cur.description, priceDzd: patch.priceDzd ?? cur.priceDzd, subjectId: patch.subjectId !== undefined ? patch.subjectId : cur.subjectId, levelId: patch.levelId !== undefined ? patch.levelId : cur.levelId, streamId: patch.streamId !== undefined ? patch.streamId : cur.streamId, rightsConfirmed: patch.rightsConfirmed ?? cur.rightsConfirmed, updatedAt: new Date() })
    .where(eq(listings.id, id))
    .returning()
  // عرض منشور يتغيّر سعره/عنوانه ⇒ المنتج يتبع
  if (cur.productId && cur.status === 'PUBLISHED') await db.update(products).set({ title: row!.title, description: row!.description, priceDzd: row!.priceDzd, subjectId: row!.subjectId, levelId: row!.levelId, streamId: row!.streamId, updatedAt: new Date() }).where(eq(products.id, cur.productId))
  return row!
}

/** إرسال للمراجعة: يلزم تأكيد الحقوق */
export async function submitListing(db: Db, actor: Actor, id: string): Promise<ListingRow> {
  const cur = await ownListing(db, actor, id)
  if (!(cur.status === 'DRAFT' || cur.status === 'REJECTED')) throw new AppError('LISTING_INVALID_STATE')
  if (!cur.rightsConfirmed) throw new AppError('LISTING_RIGHTS_REQUIRED')
  const [row] = await db.update(listings).set({ status: 'PENDING_REVIEW', submittedAt: new Date(), reviewNote: null, updatedAt: new Date() }).where(eq(listings.id, id)).returning()
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: cur.workspaceId, action: 'market.listing_submit', entityType: 'listing', entityId: id, newValue: { title: cur.title } })
  const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, 'SUPER_ADMIN'))
  for (const a of admins) await notify(db, { userId: a.id, workspaceId: null, type: 'SYSTEM', title: 'عرض جديد في السوق بانتظار المراجعة', body: `${cur.title} · ${LISTING_KIND_AR[cur.kind as ListingKind]} · ${cur.priceDzd ? `${cur.priceDzd} دج` : 'مجاني'}`, link: '/admin/market' })
  return row!
}

/** سحب العرض (يُخفى المنتج من المتجر؛ المشتريات السابقة تبقى) */
export async function archiveListing(db: Db, actor: Actor, id: string): Promise<void> {
  const cur = await ownListing(db, actor, id)
  await db.update(listings).set({ status: 'ARCHIVED', updatedAt: new Date() }).where(eq(listings.id, id))
  if (cur.productId) await db.update(products).set({ status: 'ARCHIVED', updatedAt: new Date() }).where(eq(products.id, cur.productId))
}

export async function myListings(db: Db, actor: Actor) {
  const workspaceId = ws(actor)
  return db
    .select({ l: listings, subjectName: subjects.nameAr, levelName: levels.nameAr, productSlug: products.slug, earnedDzd: sql<number>`(select coalesce(sum(lp.teacher_share_dzd), 0)::int from listing_purchases lp where lp.listing_id = listings.id)` })
    .from(listings)
    .leftJoin(subjects, eq(subjects.id, listings.subjectId))
    .leftJoin(levels, eq(levels.id, listings.levelId))
    .leftJoin(products, eq(products.id, listings.productId))
    .where(and(eq(listings.workspaceId, workspaceId), isNull(listings.deletedAt)))
    .orderBy(desc(listings.updatedAt))
}

/* --------------------------------- المراجعة --------------------------------- */

export async function listListingsAdmin(db: Db, actor: Actor, status?: ListingStatus | null) {
  assertRole(actor, 'SUPER_ADMIN')
  return db
    .select({ l: listings, teacherName: profiles.fullName, workspaceName: teacherWorkspaces.name, subjectName: subjects.nameAr, levelName: levels.nameAr })
    .from(listings)
    .leftJoin(profiles, eq(profiles.userId, listings.teacherUserId))
    .leftJoin(teacherWorkspaces, eq(teacherWorkspaces.id, listings.workspaceId))
    .leftJoin(subjects, eq(subjects.id, listings.subjectId))
    .leftJoin(levels, eq(levels.id, listings.levelId))
    .where(and(isNull(listings.deletedAt), status ? eq(listings.status, status) : undefined))
    .orderBy(desc(listings.submittedAt), desc(listings.updatedAt))
    .limit(300)
}

async function uniqueProductSlug(db: Db, base: string, excludeId?: string | null): Promise<string> {
  let slug = base
  for (let i = 2; i < 50; i++) {
    const [hit] = await db.select({ id: products.id }).from(products).where(eq(products.slug, slug)).limit(1)
    if (!hit || hit.id === excludeId) return slug
    slug = `${base}-${i}`
  }
  return `${base}-${Date.now().toString(36)}`
}

/** قبول ⇒ منتج منشور في المتجر (أو تحديثه)؛ رفض ⇒ ملاحظة للأستاذ. في الحالتين يُخطَر */
export async function reviewListing(db: Db, actor: Actor, id: string, decision: { approve: boolean; note?: string | null }): Promise<ListingRow> {
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(id, 'LISTING_NOT_FOUND')
  const [cur] = await db.select().from(listings).where(and(eq(listings.id, id), isNull(listings.deletedAt))).limit(1)
  if (!cur) throw new AppError('LISTING_NOT_FOUND')
  if (cur.status !== 'PENDING_REVIEW') throw new AppError('LISTING_INVALID_STATE')
  let productId = cur.productId
  if (decision.approve) {
    const slug = await uniqueProductSlug(db, slugify(cur.title), productId)
    const values = { workspaceId: cur.workspaceId, title: cur.title, description: cur.description, type: 'PDF' as const, priceDzd: cur.priceDzd, subjectId: cur.subjectId, levelId: cur.levelId, streamId: cur.streamId, status: 'PUBLISHED' as const, updatedAt: new Date() }
    if (productId) await db.update(products).set(values).where(eq(products.id, productId))
    else {
      const [p] = await db.insert(products).values({ ...values, createdByUserId: actor.userId, slug }).returning()
      productId = p!.id
      if (cur.kind === 'SUMMARY' && cur.fileId) await db.insert(productFiles).values({ productId, fileId: cur.fileId, label: cur.title, sortOrder: 0 })
    }
  }
  const [row] = await db
    .update(listings)
    .set({ status: decision.approve ? 'PUBLISHED' : 'REJECTED', reviewNote: decision.note?.trim() || null, productId, publishedAt: decision.approve ? new Date() : cur.publishedAt, teacherSharePct: decision.approve ? teacherSharePct() : cur.teacherSharePct, updatedAt: new Date() })
    .where(eq(listings.id, id))
    .returning()
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: cur.workspaceId, action: 'market.listing_review', entityType: 'listing', entityId: id, newValue: { approve: decision.approve, note: decision.note ?? null } })
  await notify(db, { userId: cur.teacherUserId, workspaceId: cur.workspaceId, type: 'SYSTEM', title: decision.approve ? `نُشر عرضك «${cur.title}» في المتجر` : `لم يُقبل عرضك «${cur.title}»`, body: decision.approve ? `نصيبك ${row!.teacherSharePct}% من كل بيع.` : decision.note?.trim() || 'راجع العرض وأعد إرساله.', link: '/teacher/market' })
  return row!
}

/* --------------------------------- التسليم --------------------------------- */

/**
 * بعد تأكيد طلب في المتجر: لكل سطر يخصّ عرضاً، إن لم يُسلَّم للمشتري من قبل:
 * امتحان ⇒ نسخة في مساحته؛ أسئلة ⇒ نسخ إلى بنكه؛ ملخّص ⇒ التنزيل من الطلب. ثم الأنصبة والإشعار.
 */
export async function grantPurchasesForOrder(db: Db, orderId: string): Promise<{ granted: number }> {
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  if (!o) return { granted: 0 }
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId))
  if (items.length === 0) return { granted: 0 }
  const ls = await db.select().from(listings).where(and(inArray(listings.productId, items.map((i) => i.productId)), isNull(listings.deletedAt)))
  if (ls.length === 0) return { granted: 0 }
  const [buyer] = await db.select({ id: users.id, role: users.role, fullName: profiles.fullName }).from(users).leftJoin(profiles, eq(profiles.userId, users.id)).where(eq(users.id, o.userId)).limit(1)
  const [buyerWs] = buyer?.role === 'TEACHER' ? await db.select({ id: teacherWorkspaces.id }).from(teacherWorkspaces).where(eq(teacherWorkspaces.ownerUserId, o.userId)).limit(1) : []
  let granted = 0
  for (const l of ls) {
    const [exists] = await db.select({ id: listingPurchases.id }).from(listingPurchases).where(and(eq(listingPurchases.listingId, l.id), eq(listingPurchases.buyerUserId, o.userId))).limit(1)
    if (exists) continue
    const item = items.find((i) => i.productId === l.productId)!
    const [seller] = await db.select({ name: teacherWorkspaces.name }).from(teacherWorkspaces).where(eq(teacherWorkspaces.id, l.workspaceId)).limit(1)
    const sourceLabel = `من السوق: ${seller?.name ?? 'أستاذ'}`
    const delivered: Record<string, unknown> = {}
    if (buyerWs) {
      if (l.kind === 'EXAM' && l.examId) delivered.examId = (await copyExamToWorkspace(db, l.examId, { workspaceId: buyerWs.id, userId: o.userId, fullName: buyer?.fullName ?? '' }, sourceLabel)).id
      else if ((l.kind === 'EXERCISE_SET' || l.kind === 'QUESTION_BANK') && l.questionIds.length) delivered.copied = (await copyQuestionsToWorkspace(db, l.questionIds, { workspaceId: buyerWs.id, userId: o.userId }, sourceLabel)).copied
    }
    if (l.kind === 'EXAM' && l.examId) delivered.printAccess = true
    const price = item.unitPriceDzd
    const teacherShare = Math.round((price * l.teacherSharePct) / 100)
    await db.insert(listingPurchases).values({ listingId: l.id, buyerUserId: o.userId, orderId, priceDzd: price, teacherShareDzd: teacherShare, platformShareDzd: price - teacherShare, delivered })
    await db.update(listings).set({ salesCount: sql`${listings.salesCount} + 1` }).where(eq(listings.id, l.id))
    await writeAudit(db, { actorUserId: o.userId, workspaceId: l.workspaceId, action: 'market.purchase_grant', entityType: 'listing', entityId: l.id, newValue: { orderId, price, teacherShare, delivered } })
    await notify(db, { userId: l.teacherUserId, workspaceId: l.workspaceId, type: 'SYSTEM', title: `بيع جديد: ${l.title}`, body: price ? `${price} دج — نصيبك ${teacherShare} دج` : 'تنزيل مجاني', link: '/teacher/market' })
    if (delivered.examId) await notify(db, { userId: o.userId, workspaceId: buyerWs?.id ?? null, type: 'SYSTEM', title: `امتحان «${l.title}» أُضيف إلى ورشتك`, body: 'نسخة قابلة للتعديل والطباعة في «الامتحانات».', link: `/teacher/exams/${String(delivered.examId)}` })
    if (delivered.copied) await notify(db, { userId: o.userId, workspaceId: buyerWs?.id ?? null, type: 'SYSTEM', title: `${String(delivered.copied)} سؤالاً أُضيف إلى بنكك`, body: l.title, link: '/teacher/bank' })
    granted++
  }
  return { granted }
}

/** هل لهذا المستخدم حقّ قراءة الامتحان (مشترٍ لعرض يحويه)؟ */
export async function canReadExam(db: Db, actor: Actor, examId: string): Promise<boolean> {
  assertUuid(examId, 'EXAM_NOT_FOUND')
  const [hit] = await db
    .select({ id: listingPurchases.id })
    .from(listingPurchases)
    .innerJoin(listings, eq(listings.id, listingPurchases.listingId))
    .where(and(eq(listingPurchases.buyerUserId, actor.userId), eq(listings.examId, examId)))
    .limit(1)
  return Boolean(hit)
}

/** للطباعة: المالك، أو مشترٍ من السوق (قراءة فقط) */
export async function getExamForReader(db: Db, actor: Actor, id: string): Promise<{ exam: ExamView; readOnly: boolean }> {
  if (actor.role === 'TEACHER' && actor.workspaceId) {
    try {
      return { exam: await getExam(db, actor, id), readOnly: false }
    } catch (e) {
      if (!(e instanceof AppError && e.code === 'EXAM_NOT_FOUND')) throw e
    }
  }
  if (!(await canReadExam(db, actor, id))) throw new AppError('EXAM_NOT_FOUND')
  return { exam: await getExamUnchecked(db, id), readOnly: true }
}

/* --------------------------------- الأرباح --------------------------------- */

export async function teacherEarnings(db: Db, actor: Actor) {
  const workspaceId = ws(actor)
  const [[sums], payouts, recent] = await Promise.all([
    db
      .select({ sales: sql<number>`count(*)::int`, earned: sql<number>`coalesce(sum(${listingPurchases.teacherShareDzd}), 0)::int`, gross: sql<number>`coalesce(sum(${listingPurchases.priceDzd}), 0)::int` })
      .from(listingPurchases)
      .innerJoin(listings, eq(listings.id, listingPurchases.listingId))
      .where(eq(listings.workspaceId, workspaceId)),
    db.select().from(teacherPayouts).where(eq(teacherPayouts.workspaceId, workspaceId)).orderBy(desc(teacherPayouts.createdAt)).limit(50),
    db
      .select({ id: listingPurchases.id, title: listings.title, priceDzd: listingPurchases.priceDzd, teacherShareDzd: listingPurchases.teacherShareDzd, createdAt: listingPurchases.createdAt })
      .from(listingPurchases)
      .innerJoin(listings, eq(listings.id, listingPurchases.listingId))
      .where(eq(listings.workspaceId, workspaceId))
      .orderBy(desc(listingPurchases.createdAt))
      .limit(20)
  ])
  const paid = payouts.filter((p) => p.status === 'PAID').reduce((s, p) => s + p.amountDzd, 0)
  const pending = payouts.filter((p) => p.status === 'PENDING').reduce((s, p) => s + p.amountDzd, 0)
  return { sales: sums?.sales ?? 0, earnedDzd: sums?.earned ?? 0, grossDzd: sums?.gross ?? 0, paidDzd: paid, pendingDzd: pending, balanceDzd: (sums?.earned ?? 0) - paid - pending, payouts, recent, sharePct: teacherSharePct() }
}

/** المشرف: ما يستحقه كل أستاذ (المكتسب − المدفوع − المعلّق) */
export async function balancesAdmin(db: Db, actor: Actor) {
  assertRole(actor, 'SUPER_ADMIN')
  const earned = await db
    .select({ workspaceId: listings.workspaceId, name: teacherWorkspaces.name, sales: sql<number>`count(*)::int`, earned: sql<number>`coalesce(sum(${listingPurchases.teacherShareDzd}), 0)::int` })
    .from(listingPurchases)
    .innerJoin(listings, eq(listings.id, listingPurchases.listingId))
    .innerJoin(teacherWorkspaces, eq(teacherWorkspaces.id, listings.workspaceId))
    .groupBy(listings.workspaceId, teacherWorkspaces.name)
  const paid = await db.select({ workspaceId: teacherPayouts.workspaceId, status: teacherPayouts.status, amount: sql<number>`coalesce(sum(${teacherPayouts.amountDzd}), 0)::int` }).from(teacherPayouts).groupBy(teacherPayouts.workspaceId, teacherPayouts.status)
  return earned
    .map((e) => {
      const p = paid.filter((x) => x.workspaceId === e.workspaceId)
      const paidDzd = p.find((x) => x.status === 'PAID')?.amount ?? 0
      const pendingDzd = p.find((x) => x.status === 'PENDING')?.amount ?? 0
      return { ...e, paidDzd, pendingDzd, balanceDzd: e.earned - paidDzd - pendingDzd }
    })
    .sort((a, b) => b.balanceDzd - a.balanceDzd)
}

export async function createPayout(db: Db, actor: Actor, input: { workspaceId: string; amountDzd: number; note?: string | null; paid?: boolean }) {
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(input.workspaceId, 'NOT_FOUND')
  if (!(Number.isInteger(input.amountDzd) && input.amountDzd > 0)) throw new AppError('VALIDATION', { field: 'amountDzd' })
  const [ws] = await db.select({ id: teacherWorkspaces.id, owner: teacherWorkspaces.ownerUserId, name: teacherWorkspaces.name }).from(teacherWorkspaces).where(eq(teacherWorkspaces.id, input.workspaceId)).limit(1)
  if (!ws) throw new AppError('NOT_FOUND')
  const [row] = await db.insert(teacherPayouts).values({ workspaceId: ws.id, amountDzd: input.amountDzd, note: input.note?.trim() || null, status: input.paid ? 'PAID' : 'PENDING', paidAt: input.paid ? new Date() : null, createdByUserId: actor.userId }).returning()
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: ws.id, action: 'market.payout', entityType: 'teacher_payout', entityId: row!.id, newValue: { amountDzd: input.amountDzd, paid: Boolean(input.paid) } })
  await notify(db, { userId: ws.owner, workspaceId: ws.id, type: 'SYSTEM', title: input.paid ? `حُوّلت لك دفعة ${input.amountDzd} دج` : `دفعة ${input.amountDzd} دج قيد التحويل`, body: input.note?.trim() || 'من مبيعاتك في السوق.', link: '/teacher/market' })
  return row!
}

export async function markPayoutPaid(db: Db, actor: Actor, id: string) {
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(id, 'NOT_FOUND')
  const [row] = await db.update(teacherPayouts).set({ status: 'PAID', paidAt: new Date() }).where(eq(teacherPayouts.id, id)).returning()
  if (!row) throw new AppError('NOT_FOUND')
  return row
}

export async function marketStats(db: Db, actor: Actor) {
  assertRole(actor, 'SUPER_ADMIN')
  const [byStatus, [sums]] = await Promise.all([
    db.select({ status: listings.status, n: sql<number>`count(*)::int` }).from(listings).where(isNull(listings.deletedAt)).groupBy(listings.status),
    db.select({ sales: sql<number>`count(*)::int`, gross: sql<number>`coalesce(sum(${listingPurchases.priceDzd}), 0)::int`, platform: sql<number>`coalesce(sum(${listingPurchases.platformShareDzd}), 0)::int`, teachers: sql<number>`coalesce(sum(${listingPurchases.teacherShareDzd}), 0)::int` }).from(listingPurchases)
  ])
  const s = Object.fromEntries(byStatus.map((x) => [x.status, x.n])) as Partial<Record<ListingStatus, number>>
  return { pending: s.PENDING_REVIEW ?? 0, published: s.PUBLISHED ?? 0, rejected: s.REJECTED ?? 0, sales: sums?.sales ?? 0, grossDzd: sums?.gross ?? 0, platformDzd: sums?.platform ?? 0, teachersDzd: sums?.teachers ?? 0, sharePct: teacherSharePct() }
}

/** مصادر العرض المتاحة للأستاذ: امتحاناته بعناصر، وملفاته PDF */
export async function listingSources(db: Db, actor: Actor) {
  const workspaceId = ws(actor)
  const [examRows, fileRows] = await Promise.all([
    db
      .select({ id: exams.id, title: exams.title, items: sql<number>`(select count(*)::int from exam_items i where i.exam_id = exams.id and i.kind in ('EXERCISE','QUESTION'))` })
      .from(exams)
      .where(and(eq(exams.workspaceId, workspaceId), isNull(exams.deletedAt), sql`${exams.status} <> 'ARCHIVED'`))
      .orderBy(desc(exams.updatedAt))
      .limit(100),
    db.select({ id: files.id, name: files.originalName }).from(files).where(and(eq(files.workspaceId, workspaceId), isNull(files.deletedAt), eq(files.mimeType, 'application/pdf'))).orderBy(desc(files.createdAt)).limit(100)
  ])
  void examItems
  return { exams: examRows.filter((e) => e.items > 0), files: fileRows }
}
