/**
 * دعوة الزملاء والمسوّقون والرصيد الرقمي (قرار المالك 2 نوفمبر 2026).
 *
 *  القواعد (ضد التحايل):
 *   1) السعر واحد في كل القنوات: الكود لا يخفّض ثمن الطلب، بل يُكافأ به بعد الشراء.
 *   2) الكود للتلميذ الجديد فقط (لا دورة له ولا طلب دورة مُسلَّم)، ويُثبَّت أول كود ولا يتغيّر.
 *   3) لا يُكافأ أحد على نفسه: لا كود صاحبه، ولا هاتف صاحب الكود في الحساب أو في الطلب،
 *      ولا رقم هاتف سبق أن كوفئ عليه في حساب آخر.
 *   4) المكافأة عند «سُلِّم» لأول طلب دورة (أو فور الدفع للنسخة الرقمية): نقد للمسوّق قابل للدفع بعد مهلة
 *      الإرجاع، ورصيد للتلميذ الداعي، ورصيد ترحيبي للتلميذ الجديد. الإرجاع يُسقطها، ومدير العمليات يُلغيها بسبب.
 *   5) الرصيد لشراء الدورات فقط، لا يُصرف نقدًا، ولكل دفعة تاريخ انتهاء (12 شهرًا افتراضيًّا)،
 *      ويعود إلى صاحبه إن أُلغي الطلب أو أُرجع.
 *   6) الأكواد التي تبيعها المدارس لا تُكافئ أحدًا: للمدرسة عمولتها.
 */
import { randomInt } from 'node:crypto'
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, ne, or, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { affiliates, appSettings, courseEnrollments, creditLots, creditSpends, orderItems, orders, profiles, promoCodes, referralRewards, referrals, students, users } from '@/server/db/schema'
import type { PromoCodeKind, ReferralRewardKind, ReferralSource } from '@/server/db/schema/enums'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { notify } from './notifications.service'

/* ───────────── سياسة البرنامج (يضبطها المشرف) ───────────── */

export interface ReferralPolicy {
  /** يقبل أكوادًا جديدة (الإحالات القائمة تبقى مستحقّة) */
  enabled: boolean
  /** عمولة المسوّق الافتراضية عن كل تلميذ جديد يشتري (دج نقدًا) */
  affiliateDefaultDzd: number
  /** رصيد التلميذ الذي يدعو زميله */
  referrerCreditDzd: number
  /** الرصيد الترحيبي للتلميذ الجديد بعد أول شراء */
  welcomeCreditDzd: number
  /** صلاحية الرصيد بالأشهر */
  creditMonths: number
  /** مهلة الإرجاع قبل أن يصبح نقد المسوّق قابلًا للدفع (أيام) */
  holdDays: number
}

export const DEFAULT_REFERRAL_POLICY: ReferralPolicy = { enabled: true, affiliateDefaultDzd: 300, referrerCreditDzd: 200, welcomeCreditDzd: 200, creditMonths: 12, holdDays: 7 }
const POLICY_KEY = 'referrals.policy'
/** أقل مبلغ يُرسَل إلى بوابة الدفع: الرصيد لا يُنزل الباقي تحته (يُدفع كاملًا بالرصيد أو 50 دج على الأقل) */
export const ONLINE_MIN_DZD = 50

const intIn = (v: unknown, min: number, max: number, fallback: number) => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : fallback)

export async function referralPolicy(db: Db): Promise<ReferralPolicy> {
  const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, POLICY_KEY)).limit(1)
  const v = (row?.value ?? {}) as Partial<ReferralPolicy>
  const d = DEFAULT_REFERRAL_POLICY
  return {
    enabled: typeof v.enabled === 'boolean' ? v.enabled : d.enabled,
    affiliateDefaultDzd: intIn(v.affiliateDefaultDzd, 0, 100_000, d.affiliateDefaultDzd),
    referrerCreditDzd: intIn(v.referrerCreditDzd, 0, 100_000, d.referrerCreditDzd),
    welcomeCreditDzd: intIn(v.welcomeCreditDzd, 0, 100_000, d.welcomeCreditDzd),
    creditMonths: intIn(v.creditMonths, 1, 36, d.creditMonths),
    holdDays: intIn(v.holdDays, 0, 60, d.holdDays)
  }
}

/** المبالغ والمدد للمشرف وحده (لا لمدير العمليات) */
export async function setReferralPolicy(db: Db, actor: Actor, input: Partial<ReferralPolicy>): Promise<ReferralPolicy> {
  assertRole(actor, 'SUPER_ADMIN')
  const prev = await referralPolicy(db)
  const check = (k: keyof ReferralPolicy, min: number, max: number) => {
    const v = input[k]
    if (v === undefined) return prev[k] as number
    if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw new AppError('VALIDATION', { field: k })
    return v
  }
  const next: ReferralPolicy = {
    enabled: typeof input.enabled === 'boolean' ? input.enabled : prev.enabled,
    affiliateDefaultDzd: check('affiliateDefaultDzd', 0, 100_000),
    referrerCreditDzd: check('referrerCreditDzd', 0, 100_000),
    welcomeCreditDzd: check('welcomeCreditDzd', 0, 100_000),
    creditMonths: check('creditMonths', 1, 36),
    holdDays: check('holdDays', 0, 60)
  }
  await db
    .insert(appSettings)
    .values({ key: POLICY_KEY, value: next })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: next, updatedAt: new Date() } })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'settings.referral_policy', entityType: 'settings', entityId: null, oldValue: { ...prev }, newValue: { ...next } })
  return next
}

/* ───────────── الأكواد ───────────── */

/** الكود كما يُكتب: حروف لاتينية وأرقام، 4 إلى 16، بلا مسافات ولا شرطات */
export function normalizePromoCode(raw: string | null | undefined): string | null {
  const c = (raw ?? '').replace(/[\s\-_.]/g, '').toUpperCase()
  return /^[A-Z0-9]{4,16}$/.test(c) ? c : null
}

/** بلا محارف ملتبسة (0/O، 1/I/L) */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
function randomCode(prefix: string, len: number): string {
  let out = prefix
  while (out.length < len) out += ALPHABET[randomInt(0, ALPHABET.length)]
  return out
}

type PromoRow = typeof promoCodes.$inferSelect

export async function promoCodeOf(db: Db, userId: string): Promise<PromoRow | null> {
  const [row] = await db.select().from(promoCodes).where(eq(promoCodes.ownerUserId, userId)).limit(1)
  return row ?? null
}

/** كود جديد لصاحبه: المطلوب إن كان صالحًا وحرًّا، وإلا مولَّد. كود واحد لكل حساب */
export async function createPromoCode(db: Db, input: { ownerUserId: string; kind: PromoCodeKind; wanted?: string | null }): Promise<PromoRow> {
  const existing = await promoCodeOf(db, input.ownerUserId)
  if (existing) return existing
  if (input.wanted) {
    const code = normalizePromoCode(input.wanted)
    if (!code) throw new AppError('VALIDATION', { field: 'code' })
    const [row] = await db.insert(promoCodes).values({ code, kind: input.kind, ownerUserId: input.ownerUserId }).onConflictDoNothing().returning()
    if (!row) throw new AppError('PROMO_CODE_TAKEN')
    return row
  }
  const prefix = input.kind === 'STUDENT' ? 'T' : 'M'
  for (let i = 0; i < 8; i++) {
    const [row] = await db.insert(promoCodes).values({ code: randomCode(prefix, 6 + Math.floor(i / 3)), kind: input.kind, ownerUserId: input.ownerUserId }).onConflictDoNothing().returning()
    if (row) return row
    const again = await promoCodeOf(db, input.ownerUserId)
    if (again) return again
  }
  throw new AppError('INTERNAL')
}

/** تغيير كود المسوّق (يبقى من سُجّل بالقديم منسوبًا إليه) */
export async function changePromoCode(db: Db, ownerUserId: string, wanted: string): Promise<string> {
  const code = normalizePromoCode(wanted)
  if (!code) throw new AppError('VALIDATION', { field: 'code' })
  const cur = await promoCodeOf(db, ownerUserId)
  if (cur?.code === code) return code
  const [clash] = await db.select({ id: promoCodes.id }).from(promoCodes).where(eq(promoCodes.code, code)).limit(1)
  if (clash) throw new AppError('PROMO_CODE_TAKEN')
  if (cur) await db.update(promoCodes).set({ code }).where(eq(promoCodes.id, cur.id))
  return code
}

export interface ResolvedCode {
  id: string
  code: string
  kind: PromoCodeKind
  ownerUserId: string
  ownerName: string
  ownerPhone: string | null
}

/** كود صالح الآن: موجود، مفعّل، ومسوّقه مفعّل، وتلميذه له دورة (لا دعوة قبل الاشتراك) */
export async function resolvePromoCode(db: Db, raw: string | null | undefined): Promise<ResolvedCode | null> {
  const code = normalizePromoCode(raw)
  if (!code) return null
  const [row] = await db
    .select({ id: promoCodes.id, code: promoCodes.code, kind: promoCodes.kind, active: promoCodes.active, ownerUserId: promoCodes.ownerUserId, ownerName: profiles.fullName, ownerPhone: profiles.phone, ownerStatus: users.status })
    .from(promoCodes)
    .innerJoin(users, eq(users.id, promoCodes.ownerUserId))
    .leftJoin(profiles, eq(profiles.userId, promoCodes.ownerUserId))
    .where(and(eq(promoCodes.code, code), isNull(users.deletedAt)))
    .limit(1)
  if (!row || !row.active || row.ownerStatus !== 'ACTIVE') return null
  if (row.kind === 'AFFILIATE') {
    const [a] = await db.select({ status: affiliates.status }).from(affiliates).where(eq(affiliates.userId, row.ownerUserId)).limit(1)
    if (a?.status !== 'ACTIVE') return null
  } else if (!(await hasAnyEnrollment(db, row.ownerUserId))) return null
  return { id: row.id, code: row.code, kind: row.kind as PromoCodeKind, ownerUserId: row.ownerUserId, ownerName: row.ownerName ?? '', ownerPhone: row.ownerPhone }
}

async function studentIdOfUser(db: Db, userId: string): Promise<string | null> {
  const [st] = await db.select({ id: students.id }).from(students).where(eq(students.userId, userId)).limit(1)
  return st?.id ?? null
}

/** للتلميذ دورة (أيًّا كان مصدرها أو حالتها اليوم) */
async function hasAnyEnrollment(db: Db, userId: string): Promise<boolean> {
  const sid = await studentIdOfUser(db, userId)
  if (!sid) return false
  const [e] = await db.select({ id: courseEnrollments.id }).from(courseEnrollments).where(eq(courseEnrollments.studentId, sid)).limit(1)
  return Boolean(e)
}

/** تلميذ جديد = لا دورة له ولا طلب دورة سُلِّم */
async function isNewStudent(db: Db, userId: string): Promise<boolean> {
  if (await hasAnyEnrollment(db, userId)) return false
  const [o] = await db
    .select({ id: orders.id })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(and(eq(orders.userId, userId), isNotNull(orderItems.courseId), inArray(orders.status, ['DELIVERED', 'RETURNED'])))
    .limit(1)
  return !o
}

const samePhone = (a: string | null | undefined, b: string | null | undefined) => Boolean(a && b && a === b)

/* ───────────── النسبة إلى صاحب الكود ───────────── */

export interface ReferralEligibility {
  eligible: boolean
  reason: 'ALREADY_REFERRED' | 'NOT_NEW' | 'PROGRAM_OFF' | null
}

/** هل يستطيع هذا الحساب إدخال كود دعوة الآن؟ */
export async function referralEligibility(db: Db, userId: string): Promise<ReferralEligibility> {
  const [r] = await db.select({ id: referrals.id }).from(referrals).where(eq(referrals.referredUserId, userId)).limit(1)
  if (r) return { eligible: false, reason: 'ALREADY_REFERRED' }
  if (!(await referralPolicy(db)).enabled) return { eligible: false, reason: 'PROGRAM_OFF' }
  if (!(await isNewStudent(db, userId))) return { eligible: false, reason: 'NOT_NEW' }
  return { eligible: true, reason: null }
}

/**
 * قبل إنشاء الحساب: الكود صالح ولا يعود لصاحب الرقم نفسه. يعيد الكود المعتمد أو يرمي سبب الرفض.
 */
export async function checkCodeForSignup(db: Db, rawCode: string, phone: string | null): Promise<ResolvedCode> {
  if (!(await referralPolicy(db)).enabled) throw new AppError('REFERRAL_PROGRAM_OFF')
  const c = await resolvePromoCode(db, rawCode)
  if (!c) throw new AppError('REFERRAL_CODE_INVALID')
  if (samePhone(c.ownerPhone, phone)) throw new AppError('REFERRAL_SELF')
  return c
}

export interface AttachedReferral {
  code: string
  kind: PromoCodeKind
  /** الاسم الأول لصاحب الكود (لرسالة التأكيد) */
  referrerFirstName: string
  welcomeCreditDzd: number
}

/** ينسب التلميذ الجديد إلى صاحب الكود (أول كود فقط) */
export async function attachReferral(db: Db, actor: Actor, rawCode: string, source: ReferralSource): Promise<AttachedReferral> {
  assertRole(actor, 'STUDENT')
  return attachReferralFor(db, actor.userId, rawCode, source)
}

/** بعد إنشاء حساب التلميذ مباشرة (التسجيل بكود أو برابط دعوة) */
export async function attachReferralForNewAccount(db: Db, userId: string, rawCode: string, source: ReferralSource): Promise<AttachedReferral> {
  const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1)
  if (u?.role !== 'STUDENT') throw new AppError('FORBIDDEN')
  return attachReferralFor(db, userId, rawCode, source)
}

async function attachReferralFor(db: Db, userId: string, rawCode: string, source: ReferralSource): Promise<AttachedReferral> {
  const actor = { userId }
  const policy = await referralPolicy(db)
  if (!policy.enabled) throw new AppError('REFERRAL_PROGRAM_OFF')
  const c = await resolvePromoCode(db, rawCode)
  if (!c) throw new AppError('REFERRAL_CODE_INVALID')
  if (c.ownerUserId === actor.userId) throw new AppError('REFERRAL_SELF')
  const [me] = await db.select({ phone: profiles.phone }).from(profiles).where(eq(profiles.userId, actor.userId)).limit(1)
  if (samePhone(c.ownerPhone, me?.phone)) throw new AppError('REFERRAL_SELF')
  const el = await referralEligibility(db, actor.userId)
  if (el.reason === 'ALREADY_REFERRED') throw new AppError('REFERRAL_ALREADY_SET')
  if (el.reason === 'NOT_NEW') throw new AppError('REFERRAL_NOT_NEW')
  const [row] = await db.insert(referrals).values({ referredUserId: actor.userId, codeId: c.id, referrerUserId: c.ownerUserId, kind: c.kind, source }).onConflictDoNothing().returning({ id: referrals.id })
  if (!row) throw new AppError('REFERRAL_ALREADY_SET')
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'referral.attach', entityType: 'referral', entityId: row.id, newValue: { code: c.code, kind: c.kind, source, referrerUserId: c.ownerUserId } })
  return { code: c.code, kind: c.kind, referrerFirstName: c.ownerName.split(/\s+/)[0] ?? '', welcomeCreditDzd: policy.welcomeCreditDzd }
}

/** الكود الذي سُجّل به هذا الحساب (إن وُجد) */
export async function myReferral(db: Db, userId: string): Promise<{ code: string; kind: PromoCodeKind; status: string } | null> {
  const [r] = await db.select({ code: promoCodes.code, kind: referrals.kind, status: referrals.status }).from(referrals).innerJoin(promoCodes, eq(promoCodes.id, referrals.codeId)).where(eq(referrals.referredUserId, userId)).limit(1)
  return r ? { code: r.code, kind: r.kind as PromoCodeKind, status: r.status } : null
}

/* ───────────── المكافآت ───────────── */

const addMonths = (d: Date, m: number) => {
  const x = new Date(d)
  x.setMonth(x.getMonth() + m)
  return x
}

/**
 * يُستدعى عند «سُلِّم» (من محرّك الحالات): أول طلب دورة للتلميذ المنسوب يمنح المكافآت. آمن عند التكرار.
 * يُعيد ما مُنح (للاختبارات والسجلّ).
 */
export async function onOrderDelivered(db: Db, orderId: string, now = new Date()): Promise<{ status: 'QUALIFIED' | 'VOID' | 'SKIPPED'; rewards: { kind: ReferralRewardKind; amountDzd: number }[] }> {
  const skip = { status: 'SKIPPED' as const, rewards: [] }
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  if (!o || o.status !== 'DELIVERED' || o.subtotalDzd <= 0) return skip
  const [course] = await db.select({ id: orderItems.id }).from(orderItems).where(and(eq(orderItems.orderId, orderId), isNotNull(orderItems.courseId))).limit(1)
  if (!course) return skip
  const [ref] = await db.select().from(referrals).where(and(eq(referrals.referredUserId, o.userId), eq(referrals.status, 'PENDING'))).limit(1)
  if (!ref) return skip

  // لا مكافأة على النفس: هاتف صاحب الكود في الطلب أو في الحساب، أو رقم كوفئ عليه من قبل في حساب آخر
  const [owner] = await db.select({ phone: profiles.phone }).from(profiles).where(eq(profiles.userId, ref.referrerUserId)).limit(1)
  const [me] = await db.select({ phone: profiles.phone }).from(profiles).where(eq(profiles.userId, o.userId)).limit(1)
  let voidReason: string | null = null
  if (samePhone(owner?.phone, o.phone) || samePhone(owner?.phone, me?.phone)) voidReason = 'هاتف الطلب أو الحساب هو هاتف صاحب الكود'
  else {
    const phones = [...new Set([o.phone, me?.phone].filter((p): p is string => Boolean(p)))]
    if (phones.length) {
      const [dup] = await db
        .select({ id: referrals.id })
        .from(referrals)
        .innerJoin(orders, eq(orders.id, referrals.orderId))
        .leftJoin(profiles, eq(profiles.userId, referrals.referredUserId))
        .where(and(eq(referrals.status, 'QUALIFIED'), ne(referrals.referredUserId, o.userId), or(inArray(orders.phone, phones), inArray(profiles.phone, phones))))
        .limit(1)
      if (dup) voidReason = 'رقم الهاتف كوفئ عليه من قبل في حساب آخر'
    }
  }
  if (voidReason) {
    const [v] = await db.update(referrals).set({ status: 'VOID', orderId, note: voidReason, updatedAt: now }).where(and(eq(referrals.id, ref.id), eq(referrals.status, 'PENDING'))).returning({ id: referrals.id })
    if (v) await writeAudit(db, { actorUserId: null, workspaceId: null, action: 'referral.void', entityType: 'referral', entityId: ref.id, newValue: { orderId, reason: voidReason } })
    return { status: 'VOID', rewards: [] }
  }

  const policy = await referralPolicy(db)
  const granted = await db.transaction(async (tx) => {
    // مرة واحدة فقط حتى مع «سُلِّم» مكرّر من مصدرين في اللحظة نفسها
    const [locked] = await tx.update(referrals).set({ status: 'QUALIFIED', orderId, qualifiedAt: now, updatedAt: now }).where(and(eq(referrals.id, ref.id), eq(referrals.status, 'PENDING'))).returning()
    if (!locked) return null
    const out: { kind: ReferralRewardKind; amountDzd: number; userId: string }[] = []
    if (ref.kind === 'AFFILIATE') {
      const [a] = await tx.select({ commission: affiliates.commissionDzd }).from(affiliates).where(eq(affiliates.userId, ref.referrerUserId)).limit(1)
      const amount = a?.commission ?? policy.affiliateDefaultDzd
      if (amount > 0) {
        await tx.insert(referralRewards).values({ referralId: ref.id, beneficiaryUserId: ref.referrerUserId, kind: 'AFFILIATE_CASH', amountDzd: amount, orderId, availableAt: new Date(now.getTime() + policy.holdDays * 86_400_000) })
        out.push({ kind: 'AFFILIATE_CASH', amountDzd: amount, userId: ref.referrerUserId })
      }
    } else if (policy.referrerCreditDzd > 0) {
      await grantCreditReward(tx, { referralId: ref.id, userId: ref.referrerUserId, kind: 'REFERRER_CREDIT', amountDzd: policy.referrerCreditDzd, orderId, expiresAt: addMonths(now, policy.creditMonths) })
      out.push({ kind: 'REFERRER_CREDIT', amountDzd: policy.referrerCreditDzd, userId: ref.referrerUserId })
    }
    if (policy.welcomeCreditDzd > 0) {
      await grantCreditReward(tx, { referralId: ref.id, userId: o.userId, kind: 'WELCOME_CREDIT', amountDzd: policy.welcomeCreditDzd, orderId, expiresAt: addMonths(now, policy.creditMonths) })
      out.push({ kind: 'WELCOME_CREDIT', amountDzd: policy.welcomeCreditDzd, userId: o.userId })
    }
    await writeAudit(tx, { actorUserId: null, workspaceId: null, action: 'referral.qualify', entityType: 'referral', entityId: ref.id, newValue: { orderId, kind: ref.kind, rewards: out.map((r) => ({ kind: r.kind, amountDzd: r.amountDzd })) } })
    return out
  })
  if (!granted) return skip

  const [buyer] = await db.select({ name: profiles.fullName }).from(profiles).where(eq(profiles.userId, o.userId)).limit(1)
  const first = maskName(buyer?.name ?? '')
  for (const g of granted) {
    if (g.kind === 'AFFILIATE_CASH') await notify(db, { userId: g.userId, workspaceId: null, type: 'SYSTEM', title: `+${g.amountDzd} دج عمولة`, body: `اشترى ${first} دورته بكودك. تصبح العمولة قابلة للدفع بعد ${policy.holdDays} أيام.`, link: '/affiliate' })
    else if (g.kind === 'REFERRER_CREDIT') await notify(db, { userId: g.userId, workspaceId: null, type: 'SYSTEM', title: `+${g.amountDzd} دج في رصيدك`, body: `اشترى زميلك ${first} دورته بكودك. استعمل رصيدك في شراء دورة.`, link: '/student/invite' })
    else await notify(db, { userId: g.userId, workspaceId: null, type: 'SYSTEM', title: `هدية ترحيب: ${g.amountDzd} دج في رصيدك`, body: `صالحة ${policy.creditMonths} شهرًا لشراء دورة أخرى في مدرسة.`, link: '/student/invite' })
  }
  return { status: 'QUALIFIED', rewards: granted.map((g) => ({ kind: g.kind, amountDzd: g.amountDzd })) }
}

async function grantCreditReward(tx: Db, input: { referralId: string; userId: string; kind: 'REFERRER_CREDIT' | 'WELCOME_CREDIT'; amountDzd: number; orderId: string; expiresAt: Date }): Promise<void> {
  const [reward] = await tx.insert(referralRewards).values({ referralId: input.referralId, beneficiaryUserId: input.userId, kind: input.kind, amountDzd: input.amountDzd, orderId: input.orderId }).returning({ id: referralRewards.id })
  await tx.insert(creditLots).values({ userId: input.userId, amountDzd: input.amountDzd, remainingDzd: input.amountDzd, source: input.kind === 'WELCOME_CREDIT' ? 'WELCOME' : 'REFERRAL', rewardId: reward!.id, expiresAt: input.expiresAt })
}

/** يُسقط مكافأة: نقد المسوّق يُطرح من رصيده، والرصيد غير المستعمل يُصفَّر */
async function reverseReward(tx: Db, rewardId: string, reason: string, byUserId: string | null, now: Date): Promise<boolean> {
  const [r] = await tx.update(referralRewards).set({ status: 'REVERSED', reversedAt: now, reverseReason: reason.slice(0, 300), reversedByUserId: byUserId }).where(and(eq(referralRewards.id, rewardId), eq(referralRewards.status, 'EARNED'))).returning({ id: referralRewards.id })
  if (!r) return false
  await tx.update(creditLots).set({ remainingDzd: 0 }).where(eq(creditLots.rewardId, rewardId))
  return true
}

/** «مرتجع» بعد التسليم: تسقط مكافآت الإحالة التي استحقّت بهذا الطلب */
export async function onOrderReturned(db: Db, orderId: string, now = new Date()): Promise<number> {
  const [ref] = await db.select().from(referrals).where(and(eq(referrals.orderId, orderId), eq(referrals.status, 'QUALIFIED'))).limit(1)
  if (!ref) return 0
  return db.transaction(async (tx) => {
    const [locked] = await tx.update(referrals).set({ status: 'REVERSED', note: 'أُرجع الطلب', updatedAt: now }).where(and(eq(referrals.id, ref.id), eq(referrals.status, 'QUALIFIED'))).returning({ id: referrals.id })
    if (!locked) return 0
    const rewards = await tx.select({ id: referralRewards.id }).from(referralRewards).where(eq(referralRewards.referralId, ref.id))
    let n = 0
    for (const r of rewards) if (await reverseReward(tx, r.id, 'أُرجع الطلب', null, now)) n++
    await writeAudit(tx, { actorUserId: null, workspaceId: null, action: 'referral.reverse', entityType: 'referral', entityId: ref.id, newValue: { orderId, rewards: n } })
    return n
  })
}

/** مدير العمليات يُلغي مكافأة بسبب (تحايل ثبت) */
export async function voidReward(db: Db, actor: Actor, rewardId: string, reason: string, now = new Date()): Promise<void> {
  assertRole(actor, 'SUPER_ADMIN', 'MANAGER')
  assertUuid(rewardId, 'NOT_FOUND')
  const why = reason.trim()
  if (why.length < 3) throw new AppError('VALIDATION', { field: 'reason' })
  const done = await db.transaction(async (tx) => reverseReward(tx, rewardId, why, actor.userId, now))
  if (!done) throw new AppError('NOT_FOUND')
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'referral.reward_void', entityType: 'referral_reward', entityId: rewardId, newValue: { reason: why } })
}

/* ───────────── الرصيد ───────────── */

export interface CreditLotView {
  id: string
  amountDzd: number
  remainingDzd: number
  source: string
  expiresAt: Date
  createdAt: Date
  expired: boolean
}

export async function creditBalance(db: Db, userId: string, now = new Date()): Promise<{ availableDzd: number; nextExpiry: Date | null; lots: CreditLotView[] }> {
  const rows = await db.select().from(creditLots).where(eq(creditLots.userId, userId)).orderBy(asc(creditLots.expiresAt))
  const lots = rows.map((l) => ({ id: l.id, amountDzd: l.amountDzd, remainingDzd: l.remainingDzd, source: l.source, expiresAt: l.expiresAt, createdAt: l.createdAt, expired: l.expiresAt <= now }))
  const live = lots.filter((l) => !l.expired && l.remainingDzd > 0)
  return { availableDzd: live.reduce((s, l) => s + l.remainingDzd, 0), nextExpiry: live[0]?.expiresAt ?? null, lots }
}

/**
 * كم يُخصم من الرصيد لطلب بهذا السعر: لا يتجاوز ثمن الدورة/الكتاب (التوصيل يُدفع دائمًا)،
 * وفي الدفع الإلكتروني لا يُنزل الباقي تحت 50 دج (إلا إن غطّى الرصيد كل شيء).
 */
export function creditToApply(availableDzd: number, input: { priceDzd: number; totalDzd: number; online: boolean }): number {
  let apply = Math.max(0, Math.min(availableDzd, input.priceDzd))
  const due = input.totalDzd - apply
  if (input.online && due > 0 && due < ONLINE_MIN_DZD) apply = Math.max(0, input.totalDzd - ONLINE_MIN_DZD)
  return apply
}

/** يخصم من دفعات الرصيد الأقرب انتهاءً أولًا؛ يعيد ما خُصم فعلًا */
export async function spendCredit(tx: Db, userId: string, orderId: string, amountDzd: number, now = new Date()): Promise<number> {
  if (amountDzd <= 0) return 0
  const lots = await tx
    .select()
    .from(creditLots)
    .where(and(eq(creditLots.userId, userId), gt(creditLots.remainingDzd, 0), gt(creditLots.expiresAt, now)))
    .orderBy(asc(creditLots.expiresAt), asc(creditLots.createdAt))
    .for('update')
  let left = amountDzd
  for (const lot of lots) {
    if (left <= 0) break
    const take = Math.min(lot.remainingDzd, left)
    await tx.update(creditLots).set({ remainingDzd: sql`${creditLots.remainingDzd} - ${take}` }).where(eq(creditLots.id, lot.id))
    await tx.insert(creditSpends).values({ lotId: lot.id, orderId, userId, amountDzd: take })
    left -= take
  }
  return amountDzd - left
}

/** إلغاء الطلب أو إرجاعه: يعود الرصيد المخصوم إلى دفعاته (إلا دفعة مكافأة أُسقطت) */
export async function refundCreditForOrder(tx: Db, orderId: string, now = new Date()): Promise<number> {
  const spends = await tx.select().from(creditSpends).where(and(eq(creditSpends.orderId, orderId), isNull(creditSpends.refundedAt))).for('update')
  let total = 0
  for (const s of spends) {
    const [lot] = await tx.select({ rewardId: creditLots.rewardId }).from(creditLots).where(eq(creditLots.id, s.lotId)).limit(1)
    let dead = false
    if (lot?.rewardId) {
      const [r] = await tx.select({ status: referralRewards.status }).from(referralRewards).where(eq(referralRewards.id, lot.rewardId)).limit(1)
      dead = r?.status === 'REVERSED'
    }
    if (!dead) await tx.update(creditLots).set({ remainingDzd: sql`least(${creditLots.amountDzd}, ${creditLots.remainingDzd} + ${s.amountDzd})` }).where(eq(creditLots.id, s.lotId))
    await tx.update(creditSpends).set({ refundedAt: now }).where(eq(creditSpends.id, s.id))
    total += s.amountDzd
  }
  return total
}

/**
 * إعادة فتح طلب ملغى: يُخصم الرصيد من جديد. إن لم يبقَ ما يكفي: طلب عند الاستلام يُحصَّل فيه الفرق،
 * وطلب دُفع إلكترونيًّا يبقى كما هو (المال اقتُطع) ويُسجَّل النقص للمشرف.
 */
export async function respendCreditForOrder(tx: Db, order: typeof orders.$inferSelect, now = new Date()): Promise<void> {
  if (order.creditDzd <= 0) return
  const [active] = await tx.select({ id: creditSpends.id }).from(creditSpends).where(and(eq(creditSpends.orderId, order.id), isNull(creditSpends.refundedAt))).limit(1)
  if (active) return
  const spent = await spendCredit(tx, order.userId, order.id, order.creditDzd, now)
  if (spent === order.creditDzd) return
  if (order.paymentMethod === 'COD') {
    await tx.update(orders).set({ creditDzd: spent, totalDzd: Math.max(0, order.subtotalDzd + order.shippingDzd - spent), updatedAt: now }).where(eq(orders.id, order.id))
  }
  await writeAudit(tx, { actorUserId: null, workspaceId: null, action: 'credit.shortfall', entityType: 'order', entityId: order.id, newValue: { wanted: order.creditDzd, spent, paymentMethod: order.paymentMethod } })
}

/* ───────────── صفحة «ادعُ زميلك» ───────────── */

/** «أمين بن علي» ⇒ «أمين ب.» */
export function maskName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'تلميذ'
  return parts.length > 1 ? `${parts[0]} ${parts[1]![0]}.` : parts[0]!
}

/** «0661234512» ⇒ «06•• ••• •12» */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone || phone.length < 6) return null
  return `${phone.slice(0, 2)}•• ••• •${phone.slice(-2)}`
}

export type InviteeStatus = 'REGISTERED' | 'ORDERED' | 'CANCELLED' | 'BOUGHT' | 'RETURNED' | 'VOID'

export const INVITEE_STATUS_AR: Record<InviteeStatus, string> = {
  REGISTERED: 'سجّل ولم يطلب بعد',
  ORDERED: 'طلب دورته — بانتظار الاستلام',
  CANCELLED: 'أُلغي طلبه',
  BOUGHT: 'اشترى ✓',
  RETURNED: 'أرجع طلبه',
  VOID: 'لا يُحتسب'
}

const OPEN_STATUSES = ['PENDING', 'NO_ANSWER', 'CALL_LATER', 'CONFIRMED', 'SHIPPED']

export interface InviteeView {
  referralId: string
  name: string
  phoneMasked: string | null
  status: InviteeStatus
  createdAt: Date
  remindedAt: Date | null
}

/** من سُجّلوا بكود هذا الحساب وحالة كل واحد */
export async function inviteesOf(db: Db, referrerUserId: string, limit = 200): Promise<(InviteeView & { fullName: string; phone: string | null; userId: string; note: string | null })[]> {
  const rows = await db
    .select({ id: referrals.id, userId: referrals.referredUserId, status: referrals.status, createdAt: referrals.createdAt, remindedAt: referrals.remindedAt, note: referrals.note, fullName: profiles.fullName, phone: profiles.phone })
    .from(referrals)
    .leftJoin(profiles, eq(profiles.userId, referrals.referredUserId))
    .where(eq(referrals.referrerUserId, referrerUserId))
    .orderBy(desc(referrals.createdAt))
    .limit(limit)
  const pendingIds = rows.filter((r) => r.status === 'PENDING').map((r) => r.userId)
  const lastOrder = new Map<string, string>()
  if (pendingIds.length) {
    const os = await db
      .select({ userId: orders.userId, status: orders.status, createdAt: orders.createdAt })
      .from(orders)
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .where(and(inArray(orders.userId, pendingIds), isNotNull(orderItems.courseId)))
      .orderBy(desc(orders.createdAt))
    for (const o of os) if (!lastOrder.has(o.userId)) lastOrder.set(o.userId, o.status)
  }
  return rows.map((r) => {
    let status: InviteeStatus
    if (r.status === 'QUALIFIED') status = 'BOUGHT'
    else if (r.status === 'REVERSED') status = 'RETURNED'
    else if (r.status === 'VOID') status = 'VOID'
    else {
      const last = lastOrder.get(r.userId)
      status = last && OPEN_STATUSES.includes(last) ? 'ORDERED' : last === 'CANCELLED' ? 'CANCELLED' : 'REGISTERED'
    }
    const fullName = r.fullName ?? ''
    return { referralId: r.id, userId: r.userId, name: maskName(fullName), fullName, phone: r.phone, phoneMasked: maskPhone(r.phone), status, createdAt: r.createdAt, remindedAt: r.remindedAt, note: r.note }
  })
}

export function appBaseUrl(): string {
  return (process.env.APP_URL && /^https:\/\//.test(process.env.APP_URL) ? process.env.APP_URL : 'https://madrasadz.com').replace(/\/+$/, '')
}
export const inviteLink = (code: string, to?: string | null) => `${appBaseUrl()}/r/${code}${to ? `?to=${encodeURIComponent(to)}` : ''}`

/** صفحة التلميذ «ادعُ زميلك ورصيدي» */
export async function studentInviteHome(db: Db, actor: Actor, now = new Date()) {
  assertRole(actor, 'STUDENT')
  const policy = await referralPolicy(db)
  const canInvite = policy.enabled && (await hasAnyEnrollment(db, actor.userId))
  const code = canInvite ? (await createPromoCode(db, { ownerUserId: actor.userId, kind: 'STUDENT' })).code : ((await promoCodeOf(db, actor.userId))?.code ?? null)
  const [balance, invitees, mine, eligibility] = await Promise.all([creditBalance(db, actor.userId, now), code ? inviteesOf(db, actor.userId) : Promise.resolve([]), myReferral(db, actor.userId), referralEligibility(db, actor.userId)])
  const rewards = await db
    .select({ id: referralRewards.id, kind: referralRewards.kind, amountDzd: referralRewards.amountDzd, status: referralRewards.status, createdAt: referralRewards.createdAt })
    .from(referralRewards)
    .where(eq(referralRewards.beneficiaryUserId, actor.userId))
    .orderBy(desc(referralRewards.createdAt))
    .limit(50)
  return {
    policy,
    canInvite,
    code: canInvite ? code : null,
    link: canInvite && code ? inviteLink(code) : null,
    balance,
    invitees: invitees.map(({ referralId, name, status, createdAt }) => ({ referralId, name, status, createdAt })),
    rewards,
    mine,
    canEnterCode: eligibility.eligible
  }
}

/** للعرض قبل الشراء: الرصيد المتاح وما سيُخصم منه لهذا الطلب */
export async function creditPreview(db: Db, userId: string, input: { priceDzd: number; totalDzd: number; online: boolean }, now = new Date()): Promise<{ balanceDzd: number; applyDzd: number }> {
  const { availableDzd } = await creditBalance(db, userId, now)
  return { balanceDzd: availableDzd, applyDzd: creditToApply(availableDzd, input) }
}

/** داخل معاملة الطلب: يخصم الرصيد ويحدّث مبلغ الطلب. يعيد ما خُصم فعلًا */
export async function applyCreditToOrder(tx: Db, order: { id: string; userId: string; subtotalDzd: number; shippingDzd: number }, input: { online: boolean }, now = new Date()): Promise<number> {
  const { availableDzd } = await creditBalance(tx, order.userId, now)
  const total = order.subtotalDzd + order.shippingDzd
  const want = creditToApply(availableDzd, { priceDzd: order.subtotalDzd, totalDzd: total, online: input.online })
  const spent = await spendCredit(tx, order.userId, order.id, want, now)
  if (spent > 0) await tx.update(orders).set({ creditDzd: spent, totalDzd: Math.max(0, total - spent), updatedAt: now }).where(eq(orders.id, order.id))
  return spent
}
