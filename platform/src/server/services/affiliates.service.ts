/**
 * المسوّقون بالعمولة وطلبات «كن شريكًا» (قرار المالك 2 نوفمبر 2026).
 *
 *  - المسوّق صاحب صفحة أو حساب معروف (أكثر من 1000 متابع تقريبًا) يقدّم طلبه من صفحة «كن شريكًا»،
 *    ويقبله مدير العمليات أو المشرف بعد مراجعة صفحته: حساب بالهاتف وكلمة سر تُرسل عبر واتساب، وكود خاص.
 *  - عمولة ثابتة (300 دج افتراضيًّا، يغيّرها المشرف وحده) عن كل تلميذ جديد يشتري دورته بالكود،
 *    تُستحق عند التسليم وتُدفع نقدًا بعد مهلة الإرجاع. ما دُفع قيد لا يُحذف.
 *  - يرى المسوّق زبائنه بأسماء وأرقام مقنّعة وحالة كل واحد، ويذكّر من لم يشترِ بزر «ذكّره»
 *    (إشعار من المنصة، لا رقم هاتف التلميذ).
 */
import { randomUUID } from 'node:crypto'
import { and, desc, eq, inArray, isNull, lte, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { affiliatePayouts, affiliates, partnerApplications, profiles, promoCodes, referralRewards, referrals, users, wilayas } from '@/server/db/schema'
import type { PartnerApplicationKind } from '@/server/db/schema/enums'
import { hashPassword } from '@/server/auth/password'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { notify, notifyMany } from './notifications.service'
import { normalizePhone } from './otp.service'
import { addPosMember, createPointOfSale, generateReadablePassword } from './points-of-sale.service'
import { appBaseUrl, changePromoCode, createPromoCode, inviteLink, inviteesOf, referralPolicy, INVITEE_STATUS_AR } from './referrals.service'

/** تذكير واحد لكل زبون كل 48 ساعة */
export const REMIND_EVERY_MS = 48 * 3600 * 1000

function assertPartnerStaff(actor: Actor): void {
  assertRole(actor, 'SUPER_ADMIN', 'MANAGER')
}

type AffiliateRow = typeof affiliates.$inferSelect

async function loadAffiliate(db: Db, id: string): Promise<AffiliateRow> {
  assertUuid(id, 'NOT_FOUND')
  const [a] = await db.select().from(affiliates).where(eq(affiliates.id, id)).limit(1)
  if (!a) throw new AppError('NOT_FOUND')
  return a
}

/** رسالة واتساب جاهزة: الدخول، الهاتف، كلمة السر، والكود */
export function affiliateCredentialsWhatsapp(input: { name: string; phone: string; password: string; code: string }): string {
  const base = appBaseUrl()
  const text = [
    `مرحبًا ${input.name.split(/\s+/)[0] ?? ''}، قُبل طلبك مسوّقًا لمنصة مدرسة.`,
    `الدخول: ${base}/login`,
    `الهاتف: ${input.phone}`,
    `كلمة السر: ${input.password}`,
    `كودك: ${input.code} — رابطك: ${inviteLink(input.code)}`,
    'تجد في حسابك زبائنك وعمولاتك.'
  ].join('\n')
  return `https://wa.me/213${input.phone.slice(1)}?text=${encodeURIComponent(text)}`
}

export interface AffiliateCredentials {
  affiliateId: string
  userId: string
  phone: string
  password: string
  code: string
  whatsappUrl: string
}

export interface AffiliateInput {
  fullName: string
  phone: string
  wilayaId?: string | null
  socialUrl?: string | null
  followers?: number | null
  /** كود مطلوب (حروف لاتينية وأرقام)، وإلا يُولَّد */
  code?: string | null
  /** للمشرف وحده؛ وإلا العمولة الافتراضية */
  commissionDzd?: number | null
  note?: string | null
  applicationId?: string | null
}

function cleanSocial(v: string | null | undefined): string | null {
  const s = v?.trim()
  if (!s) return null
  if (s.length > 300) throw new AppError('VALIDATION', { field: 'socialUrl' })
  return s
}

function cleanFollowers(v: number | null | undefined): number | null {
  if (v == null) return null
  if (!Number.isInteger(v) || v < 0 || v > 1_000_000_000) throw new AppError('VALIDATION', { field: 'followers' })
  return v
}

function cleanCommission(v: number | null | undefined): number | null {
  if (v == null) return null
  if (!Number.isInteger(v) || v < 0 || v > 100_000) throw new AppError('VALIDATION', { field: 'commissionDzd' })
  return v
}

/** حساب مسوّق جديد: الدخول بالهاتف وكلمة سر تظهر مرة واحدة، والكود */
export async function createAffiliate(db: Db, actor: Actor, input: AffiliateInput): Promise<AffiliateCredentials> {
  assertPartnerStaff(actor)
  const fullName = input.fullName.trim()
  if (fullName.length < 2 || fullName.length > 120) throw new AppError('VALIDATION', { field: 'fullName' })
  const phone = normalizePhone(input.phone)
  if (input.wilayaId) assertUuid(input.wilayaId, 'VALIDATION')
  const [taken] = await db.select({ id: users.id }).from(users).innerJoin(profiles, eq(profiles.userId, users.id)).where(and(eq(profiles.phone, phone), eq(users.role, 'AFFILIATE'), isNull(users.deletedAt))).limit(1)
  if (taken) throw new AppError('AFFILIATE_PHONE_TAKEN')
  const policy = await referralPolicy(db)
  const commission = (actor.role === 'SUPER_ADMIN' ? cleanCommission(input.commissionDzd) : null) ?? policy.affiliateDefaultDzd
  const password = generateReadablePassword()
  const email = `aff-${randomUUID()}@accounts.madrasadz.com`
  const out = await db.transaction(async (tx) => {
    const [u] = await tx.insert(users).values({ email, passwordHash: await hashPassword(password), role: 'AFFILIATE' }).returning({ id: users.id })
    if (!u) throw new AppError('INTERNAL')
    await tx.insert(profiles).values({ userId: u.id, fullName, phone })
    const [a] = await tx
      .insert(affiliates)
      .values({ userId: u.id, wilayaId: input.wilayaId || null, socialUrl: cleanSocial(input.socialUrl), followers: cleanFollowers(input.followers), commissionDzd: commission, note: input.note?.trim().slice(0, 500) || null, applicationId: input.applicationId ?? null, createdByUserId: actor.userId })
      .returning({ id: affiliates.id })
    const code = await createPromoCode(tx, { ownerUserId: u.id, kind: 'AFFILIATE', wanted: input.code || null })
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId: null, action: 'affiliate.create', entityType: 'affiliate', entityId: a!.id, newValue: { userId: u.id, code: code.code, commissionDzd: commission, phoneTail: phone.slice(-4) } })
    return { affiliateId: a!.id, userId: u.id, code: code.code }
  })
  return { ...out, phone, password, whatsappUrl: affiliateCredentialsWhatsapp({ name: fullName, phone, password, code: out.code }) }
}

export async function updateAffiliate(db: Db, actor: Actor, id: string, input: { socialUrl?: string | null; followers?: number | null; wilayaId?: string | null; note?: string | null; code?: string | null; commissionDzd?: number | null }): Promise<void> {
  assertPartnerStaff(actor)
  const a = await loadAffiliate(db, id)
  if (input.wilayaId) assertUuid(input.wilayaId, 'VALIDATION')
  const set: Partial<AffiliateRow> = { socialUrl: cleanSocial(input.socialUrl), followers: cleanFollowers(input.followers), wilayaId: input.wilayaId || null, note: input.note?.trim().slice(0, 500) || null, updatedAt: new Date() }
  const commission = actor.role === 'SUPER_ADMIN' ? cleanCommission(input.commissionDzd) : null
  if (commission != null) set.commissionDzd = commission
  await db.update(affiliates).set(set).where(eq(affiliates.id, a.id))
  const code = input.code?.trim() ? await changePromoCode(db, a.userId, input.code) : null
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'affiliate.update', entityType: 'affiliate', entityId: a.id, oldValue: { commissionDzd: a.commissionDzd }, newValue: { commissionDzd: commission ?? a.commissionDzd, code } })
}

/** إيقاف المسوّق: كوده لا يقبل تلاميذ جدد (يبقى يرى ما استحقّه) */
export async function setAffiliateStatus(db: Db, actor: Actor, id: string, status: 'ACTIVE' | 'SUSPENDED'): Promise<void> {
  assertPartnerStaff(actor)
  const a = await loadAffiliate(db, id)
  await db.update(affiliates).set({ status, updatedAt: new Date() }).where(eq(affiliates.id, a.id))
  await db.update(promoCodes).set({ active: status === 'ACTIVE' }).where(eq(promoCodes.ownerUserId, a.userId))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'affiliate.status', entityType: 'affiliate', entityId: a.id, oldValue: { status: a.status }, newValue: { status } })
}

export async function resetAffiliatePassword(db: Db, actor: Actor, id: string): Promise<AffiliateCredentials> {
  assertPartnerStaff(actor)
  const a = await loadAffiliate(db, id)
  const [p] = await db.select({ name: profiles.fullName, phone: profiles.phone }).from(profiles).where(eq(profiles.userId, a.userId)).limit(1)
  if (!p?.phone) throw new AppError('NOT_FOUND')
  const code = (await createPromoCode(db, { ownerUserId: a.userId, kind: 'AFFILIATE' })).code
  const password = generateReadablePassword()
  await db.update(users).set({ passwordHash: await hashPassword(password), status: 'ACTIVE', updatedAt: new Date() }).where(eq(users.id, a.userId))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'affiliate.reset', entityType: 'affiliate', entityId: a.id, newValue: { userId: a.userId } })
  return { affiliateId: a.id, userId: a.userId, phone: p.phone, password, code, whatsappUrl: affiliateCredentialsWhatsapp({ name: p.name, phone: p.phone, password, code }) }
}

/* ───────────── الحساب المالي ───────────── */

export interface AffiliateMoney {
  /** كل العمولات المستحقّة (غير الملغاة) */
  earnedDzd: number
  /** ما زال في مهلة الإرجاع */
  holdingDzd: number
  /** ما دُفع له */
  paidDzd: number
  /** المستحق الآن = ما تجاوز المهلة − ما دُفع */
  dueDzd: number
}

export async function affiliateMoney(db: Db, affiliate: Pick<AffiliateRow, 'id' | 'userId'>, now = new Date()): Promise<AffiliateMoney> {
  const [r] = await db
    .select({
      earned: sql<number>`coalesce(sum(${referralRewards.amountDzd}), 0)::int`,
      available: sql<number>`coalesce(sum(case when ${referralRewards.availableAt} <= ${now.toISOString()}::timestamptz then ${referralRewards.amountDzd} else 0 end), 0)::int`
    })
    .from(referralRewards)
    .where(and(eq(referralRewards.beneficiaryUserId, affiliate.userId), eq(referralRewards.kind, 'AFFILIATE_CASH'), eq(referralRewards.status, 'EARNED')))
  const [p] = await db.select({ paid: sql<number>`coalesce(sum(${affiliatePayouts.amountDzd}), 0)::int` }).from(affiliatePayouts).where(eq(affiliatePayouts.affiliateId, affiliate.id))
  const earned = Number(r?.earned ?? 0)
  const available = Number(r?.available ?? 0)
  const paid = Number(p?.paid ?? 0)
  return { earnedDzd: earned, holdingDzd: earned - available, paidDzd: paid, dueDzd: available - paid }
}

/** ما دُفع للمسوّق نقدًا — لا يتجاوز المستحق الآن */
export async function recordAffiliatePayout(db: Db, actor: Actor, id: string, input: { amountDzd: number; note?: string | null }, now = new Date()): Promise<void> {
  assertPartnerStaff(actor)
  if (!Number.isInteger(input.amountDzd) || input.amountDzd <= 0) throw new AppError('VALIDATION', { field: 'amountDzd' })
  const a = await loadAffiliate(db, id)
  const money = await affiliateMoney(db, a, now)
  if (input.amountDzd > money.dueDzd) throw new AppError('AFFILIATE_PAYOUT_TOO_MUCH', { dueDzd: money.dueDzd })
  const [row] = await db.insert(affiliatePayouts).values({ affiliateId: a.id, amountDzd: input.amountDzd, note: input.note?.trim().slice(0, 300) || null, createdByUserId: actor.userId }).returning({ id: affiliatePayouts.id })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'affiliate.payout', entityType: 'affiliate', entityId: a.id, newValue: { payoutId: row!.id, amountDzd: input.amountDzd } })
  await notify(db, { userId: a.userId, workspaceId: null, type: 'SYSTEM', title: `استلمت ${input.amountDzd} دج`, body: 'سُجّل دفع عمولتك في حسابك.', link: '/affiliate' })
}

/* ───────────── القوائم ───────────── */

export interface AffiliateListItem {
  id: string
  name: string
  phone: string | null
  code: string | null
  status: string
  socialUrl: string | null
  followers: number | null
  commissionDzd: number
  registered: number
  buyers: number
  money: AffiliateMoney
}

async function countsByReferrer(db: Db, userIds: string[]): Promise<Map<string, { registered: number; buyers: number }>> {
  const out = new Map<string, { registered: number; buyers: number }>()
  if (!userIds.length) return out
  const rows = await db
    .select({ uid: referrals.referrerUserId, registered: sql<number>`count(*)::int`, buyers: sql<number>`count(*) filter (where ${referrals.status} = 'QUALIFIED')::int` })
    .from(referrals)
    .where(inArray(referrals.referrerUserId, userIds))
    .groupBy(referrals.referrerUserId)
  for (const r of rows) out.set(r.uid, { registered: Number(r.registered), buyers: Number(r.buyers) })
  return out
}

export async function listAffiliates(db: Db, actor: Actor, now = new Date()): Promise<AffiliateListItem[]> {
  assertPartnerStaff(actor)
  const rows = await db
    .select({ a: affiliates, name: profiles.fullName, phone: profiles.phone, code: promoCodes.code })
    .from(affiliates)
    .leftJoin(profiles, eq(profiles.userId, affiliates.userId))
    .leftJoin(promoCodes, eq(promoCodes.ownerUserId, affiliates.userId))
    .orderBy(desc(affiliates.createdAt))
  const counts = await countsByReferrer(db, rows.map((r) => r.a.userId))
  const out: AffiliateListItem[] = []
  for (const r of rows) {
    const c = counts.get(r.a.userId) ?? { registered: 0, buyers: 0 }
    out.push({ id: r.a.id, name: r.name ?? '', phone: r.phone, code: r.code, status: r.a.status, socialUrl: r.a.socialUrl, followers: r.a.followers, commissionDzd: r.a.commissionDzd, registered: c.registered, buyers: c.buyers, money: await affiliateMoney(db, r.a, now) })
  }
  return out
}

/** صفحة المسوّق للإدارة: كل التفاصيل (الأسماء والأرقام كاملة للموظفين) */
export async function getAffiliate(db: Db, actor: Actor, id: string, now = new Date()) {
  assertPartnerStaff(actor)
  const a = await loadAffiliate(db, id)
  const [p] = await db.select({ name: profiles.fullName, phone: profiles.phone, status: users.status, lastLoginAt: users.lastLoginAt }).from(profiles).innerJoin(users, eq(users.id, profiles.userId)).where(eq(profiles.userId, a.userId)).limit(1)
  const code = (await createPromoCode(db, { ownerUserId: a.userId, kind: 'AFFILIATE' })).code
  const wilaya = a.wilayaId ? (await db.select({ name: wilayas.nameAr }).from(wilayas).where(eq(wilayas.id, a.wilayaId)).limit(1))[0]?.name ?? null : null
  const [customers, rewards, payouts, money] = await Promise.all([
    inviteesOf(db, a.userId),
    db
      .select({ id: referralRewards.id, amountDzd: referralRewards.amountDzd, status: referralRewards.status, availableAt: referralRewards.availableAt, createdAt: referralRewards.createdAt, reverseReason: referralRewards.reverseReason, buyer: profiles.fullName })
      .from(referralRewards)
      .innerJoin(referrals, eq(referrals.id, referralRewards.referralId))
      .leftJoin(profiles, eq(profiles.userId, referrals.referredUserId))
      .where(and(eq(referralRewards.beneficiaryUserId, a.userId), eq(referralRewards.kind, 'AFFILIATE_CASH')))
      .orderBy(desc(referralRewards.createdAt))
      .limit(300),
    db.select({ id: affiliatePayouts.id, amountDzd: affiliatePayouts.amountDzd, note: affiliatePayouts.note, createdAt: affiliatePayouts.createdAt, by: profiles.fullName }).from(affiliatePayouts).leftJoin(profiles, eq(profiles.userId, affiliatePayouts.createdByUserId)).where(eq(affiliatePayouts.affiliateId, a.id)).orderBy(desc(affiliatePayouts.createdAt)).limit(200),
    affiliateMoney(db, a, now)
  ])
  return {
    affiliate: a,
    name: p?.name ?? '',
    phone: p?.phone ?? null,
    accountStatus: p?.status ?? 'ACTIVE',
    lastLoginAt: p?.lastLoginAt ?? null,
    wilaya,
    code,
    link: inviteLink(code),
    customers: customers.map((c) => ({ ...c, statusAr: INVITEE_STATUS_AR[c.status] })),
    rewards,
    payouts,
    money
  }
}

/* ───────────── واجهة المسوّق ───────────── */

export async function affiliateOfActor(db: Db, actor: Actor): Promise<AffiliateRow> {
  assertRole(actor, 'AFFILIATE')
  const [a] = await db.select().from(affiliates).where(eq(affiliates.userId, actor.userId)).limit(1)
  if (!a) throw new AppError('FORBIDDEN')
  return a
}

/** صفحة المسوّق: كوده ورابطه، أرباحه، وزبائنه بأسماء وأرقام مقنّعة */
export async function affiliateHome(db: Db, actor: Actor, now = new Date()) {
  const a = await affiliateOfActor(db, actor)
  const code = (await createPromoCode(db, { ownerUserId: a.userId, kind: 'AFFILIATE' })).code
  const [policy, customers, money, payouts] = await Promise.all([
    referralPolicy(db),
    inviteesOf(db, a.userId),
    affiliateMoney(db, a, now),
    db.select({ id: affiliatePayouts.id, amountDzd: affiliatePayouts.amountDzd, createdAt: affiliatePayouts.createdAt }).from(affiliatePayouts).where(eq(affiliatePayouts.affiliateId, a.id)).orderBy(desc(affiliatePayouts.createdAt)).limit(50)
  ])
  return {
    status: a.status,
    commissionDzd: a.commissionDzd,
    holdDays: policy.holdDays,
    welcomeCreditDzd: policy.welcomeCreditDzd,
    code,
    link: inviteLink(code),
    money,
    registered: customers.length,
    buyers: customers.filter((c) => c.status === 'BOUGHT').length,
    customers: customers.map((c) => ({
      referralId: c.referralId,
      name: c.name,
      phoneMasked: c.phoneMasked,
      status: c.status,
      statusAr: INVITEE_STATUS_AR[c.status],
      createdAt: c.createdAt,
      canRemind: (c.status === 'REGISTERED' || c.status === 'CANCELLED') && (!c.remindedAt || now.getTime() - c.remindedAt.getTime() >= REMIND_EVERY_MS)
    })),
    payouts
  }
}

/** «ذكّره»: إشعار من المنصة إلى تلميذ سجّل بالكود ولم يشترِ (لا يصل المسوّق رقمه) */
export async function remindCustomer(db: Db, actor: Actor, referralId: string, now = new Date()): Promise<void> {
  const a = await affiliateOfActor(db, actor)
  assertUuid(referralId, 'NOT_FOUND')
  const [r] = await db.select().from(referrals).where(and(eq(referrals.id, referralId), eq(referrals.referrerUserId, a.userId))).limit(1)
  if (!r || r.status !== 'PENDING') throw new AppError('NOT_FOUND')
  const cutoff = new Date(now.getTime() - REMIND_EVERY_MS)
  const [ok] = await db
    .update(referrals)
    .set({ remindedAt: now, remindCount: sql`${referrals.remindCount} + 1`, updatedAt: now })
    .where(and(eq(referrals.id, r.id), sql`(${referrals.remindedAt} is null or ${referrals.remindedAt} <= ${cutoff.toISOString()}::timestamptz)`))
    .returning({ id: referrals.id })
  if (!ok) throw new AppError('REMIND_TOO_SOON')
  const policy = await referralPolicy(db)
  await notify(db, { userId: r.referredUserId, workspaceId: null, type: 'SYSTEM', title: 'دورتك في انتظارك', body: `أكمل طلب دورتك في مدرسة${policy.welcomeCreditDzd ? `، ويُضاف إلى رصيدك ${policy.welcomeCreditDzd} دج هدية بعد الاستلام` : ''}.`, link: '/student/courses' })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'affiliate.remind', entityType: 'referral', entityId: r.id, newValue: { count: r.remindCount + 1 } })
}

/** مستحقّات المسوّقين القابلة للدفع الآن (للتنبيه) — مجموع واحد */
export async function totalAffiliateDue(db: Db, actor: Actor, now = new Date()): Promise<number> {
  assertPartnerStaff(actor)
  const list = await db.select({ id: affiliates.id, userId: affiliates.userId }).from(affiliates)
  let sum = 0
  for (const a of list) sum += Math.max(0, (await affiliateMoney(db, a, now)).dueDzd)
  return sum
}

/* ───────────── طلبات «كن شريكًا» ───────────── */

export interface PartnerApplicationInput {
  kind: PartnerApplicationKind
  fullName: string
  phone: string
  wilayaId?: string | null
  orgName?: string | null
  address?: string | null
  socialUrl?: string | null
  followers?: number | null
  subject?: string | null
  message?: string | null
}

export const PARTNER_KIND_AR: Record<PartnerApplicationKind, string> = { AFFILIATE: 'مسوّق بالعمولة', POINT_OF_SALE: 'نقطة بيع (مدرسة أو مكتبة)', TEACHER: 'أستاذ' }

async function partnerStaffIds(db: Db): Promise<string[]> {
  const rows = await db.select({ id: users.id }).from(users).where(and(inArray(users.role, ['SUPER_ADMIN', 'MANAGER']), eq(users.status, 'ACTIVE'), isNull(users.deletedAt)))
  return rows.map((r) => r.id)
}

/** من الصفحة العامة (بلا حساب). طلب مفتوح بالرقم والنوع نفسيهما لا يتكرر */
export async function submitPartnerApplication(db: Db, input: PartnerApplicationInput, meta: { ip?: string | null } = {}): Promise<{ id: string; duplicate: boolean }> {
  const fullName = input.fullName.trim()
  if (fullName.length < 3 || fullName.length > 120) throw new AppError('VALIDATION', { field: 'fullName' })
  const phone = normalizePhone(input.phone)
  if (input.wilayaId) assertUuid(input.wilayaId, 'VALIDATION')
  const orgName = input.orgName?.trim().slice(0, 160) || null
  const socialUrl = cleanSocial(input.socialUrl)
  const followers = cleanFollowers(input.followers)
  if (input.kind === 'AFFILIATE' && !socialUrl) throw new AppError('VALIDATION', { field: 'socialUrl' })
  if (input.kind === 'POINT_OF_SALE' && !orgName) throw new AppError('VALIDATION', { field: 'orgName' })
  const [open] = await db.select({ id: partnerApplications.id }).from(partnerApplications).where(and(eq(partnerApplications.phone, phone), eq(partnerApplications.kind, input.kind), eq(partnerApplications.status, 'NEW'))).limit(1)
  if (open) return { id: open.id, duplicate: true }
  const [row] = await db
    .insert(partnerApplications)
    .values({ kind: input.kind, fullName, phone, wilayaId: input.wilayaId || null, orgName, address: input.address?.trim().slice(0, 300) || null, socialUrl, followers, subject: input.subject?.trim().slice(0, 120) || null, message: input.message?.trim().slice(0, 1000) || null, ip: meta.ip?.slice(0, 64) ?? null })
    .returning({ id: partnerApplications.id })
  await writeAudit(db, { actorUserId: null, workspaceId: null, action: 'partner.apply', entityType: 'partner_application', entityId: row!.id, newValue: { kind: input.kind, phoneTail: phone.slice(-4) } })
  const staff = await partnerStaffIds(db)
  await notifyMany(db, staff.map((userId) => ({ userId, workspaceId: null, type: 'SYSTEM' as const, title: `طلب شراكة جديد: ${PARTNER_KIND_AR[input.kind]}`, body: `${fullName}${orgName ? ` — ${orgName}` : ''}${followers != null ? ` · ${followers} متابع` : ''}`, link: '/admin/affiliates' })))
  return { id: row!.id, duplicate: false }
}

export async function listPartnerApplications(db: Db, actor: Actor, status: 'NEW' | 'APPROVED' | 'REJECTED' = 'NEW', limit = 100) {
  assertPartnerStaff(actor)
  return db
    .select({ a: partnerApplications, wilaya: wilayas.nameAr })
    .from(partnerApplications)
    .leftJoin(wilayas, eq(wilayas.id, partnerApplications.wilayaId))
    .where(eq(partnerApplications.status, status))
    .orderBy(desc(partnerApplications.createdAt))
    .limit(limit)
}

async function lockNewApplication(tx: Db, id: string) {
  assertUuid(id, 'NOT_FOUND')
  const [app] = await tx.select().from(partnerApplications).where(eq(partnerApplications.id, id)).for('update').limit(1)
  if (!app) throw new AppError('NOT_FOUND')
  if (app.status !== 'NEW') throw new AppError('PARTNER_APPLICATION_DECIDED')
  return app
}

export type ApprovedApplication =
  | { kind: 'AFFILIATE'; credentials: AffiliateCredentials }
  | { kind: 'POINT_OF_SALE'; posId: string; credentials: { userId: string; phone: string; password: string; whatsappUrl: string } }
  | { kind: 'TEACHER' }

/**
 * قبول الطلب: المسوّق ⇒ حسابه وكوده، نقطة البيع ⇒ النقطة وحساب صاحبها، الأستاذ ⇒ يُعلَّم مقبولًا للتواصل معه.
 */
export async function approvePartnerApplication(db: Db, actor: Actor, id: string, input: { code?: string | null; commissionDzd?: number | null; note?: string | null } = {}): Promise<ApprovedApplication> {
  assertPartnerStaff(actor)
  assertUuid(id, 'NOT_FOUND')
  const [app] = await db.select().from(partnerApplications).where(eq(partnerApplications.id, id)).limit(1)
  if (!app) throw new AppError('NOT_FOUND')
  if (app.status !== 'NEW') throw new AppError('PARTNER_APPLICATION_DECIDED')
  let result: ApprovedApplication
  let entityId: string | null = null
  if (app.kind === 'AFFILIATE') {
    const credentials = await createAffiliate(db, actor, { fullName: app.fullName, phone: app.phone, wilayaId: app.wilayaId, socialUrl: app.socialUrl, followers: app.followers, code: input.code, commissionDzd: input.commissionDzd, note: input.note ?? app.message, applicationId: app.id })
    entityId = credentials.affiliateId
    result = { kind: 'AFFILIATE', credentials }
  } else if (app.kind === 'POINT_OF_SALE') {
    // لا تظهر للتلاميذ قبل أن تصلها باقات: يفعّل مدير العمليات «تظهر في صفحة نقاط البيع» بعد الإرسال
    const pos = await createPointOfSale(db, actor, { name: app.orgName ?? app.fullName, wilayaId: app.wilayaId, address: app.address, phone: app.phone, listed: false, note: input.note ?? app.message })
    const c = await addPosMember(db, actor, pos.id, { fullName: app.fullName, phone: app.phone })
    entityId = pos.id
    result = { kind: 'POINT_OF_SALE', posId: pos.id, credentials: c }
  } else result = { kind: 'TEACHER' }
  await db.transaction(async (tx) => {
    await lockNewApplication(tx, app.id)
    await tx.update(partnerApplications).set({ status: 'APPROVED', decidedByUserId: actor.userId, decidedAt: new Date(), decisionNote: input.note?.trim().slice(0, 300) || null, resultEntityId: entityId, updatedAt: new Date() }).where(eq(partnerApplications.id, app.id))
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId: null, action: 'partner.decide', entityType: 'partner_application', entityId: app.id, newValue: { status: 'APPROVED', kind: app.kind, entityId } })
  })
  return result
}

export async function rejectPartnerApplication(db: Db, actor: Actor, id: string, note?: string | null): Promise<void> {
  assertPartnerStaff(actor)
  await db.transaction(async (tx) => {
    const app = await lockNewApplication(tx, id)
    await tx.update(partnerApplications).set({ status: 'REJECTED', decidedByUserId: actor.userId, decidedAt: new Date(), decisionNote: note?.trim().slice(0, 300) || null, updatedAt: new Date() }).where(eq(partnerApplications.id, app.id))
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId: null, action: 'partner.decide', entityType: 'partner_application', entityId: app.id, newValue: { status: 'REJECTED', kind: app.kind } })
  })
}

/** ملخّص الإدارة: طلبات جديدة، مسوّقون، ومستحقّات تنتظر الدفع */
export async function partnersOverview(db: Db, actor: Actor, now = new Date()) {
  assertPartnerStaff(actor)
  const [apps] = await db.select({ n: sql<number>`count(*)::int` }).from(partnerApplications).where(eq(partnerApplications.status, 'NEW'))
  const [students] = await db
    .select({ invited: sql<number>`count(*)::int`, bought: sql<number>`count(*) filter (where ${referrals.status} = 'QUALIFIED')::int` })
    .from(referrals)
    .where(eq(referrals.kind, 'STUDENT'))
  const [credit] = await db
    .select({ granted: sql<number>`coalesce(sum(${referralRewards.amountDzd}), 0)::int` })
    .from(referralRewards)
    .where(and(inArray(referralRewards.kind, ['REFERRER_CREDIT', 'WELCOME_CREDIT']), eq(referralRewards.status, 'EARNED'), lte(referralRewards.createdAt, now)))
  return { newApplications: Number(apps?.n ?? 0), studentInvited: Number(students?.invited ?? 0), studentBought: Number(students?.bought ?? 0), creditGrantedDzd: Number(credit?.granted ?? 0) }
}
