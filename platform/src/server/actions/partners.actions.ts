'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requestMeta, requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { checkRateLimit } from '@/server/lib/rate-limit'
import {
  approvePartnerApplication,
  createAffiliate,
  recordAffiliatePayout,
  rejectPartnerApplication,
  remindCustomer,
  resetAffiliatePassword,
  setAffiliateStatus,
  submitPartnerApplication,
  updateAffiliate,
  type AffiliateCredentials,
  type ApprovedApplication
} from '@/server/services/affiliates.service'
import { attachReferral, setReferralPolicy, voidReward, type AttachedReferral, type ReferralPolicy } from '@/server/services/referrals.service'

const uuid = z.string().uuid()
const STAFF = ['SUPER_ADMIN', 'MANAGER'] as const
const optInt = z.number().int().min(0).nullish()

function revalidatePartners(affiliateId?: string) {
  revalidatePath('/admin/affiliates')
  if (affiliateId) revalidatePath(`/admin/affiliates/${affiliateId}`)
  revalidatePath('/affiliate')
}

/* ───────────── التلميذ ───────────── */

/** «هل دعاك أحد؟» — من صفحة الدعوة أو قبل الشراء */
export async function attachReferralAction(code: string, source: 'CHECKOUT' | 'PAGE'): Promise<ActionResult<AttachedReferral>> {
  const parsed = z.object({ code: z.string().trim().min(4, 'أدخل الكود').max(24), source: z.enum(['CHECKOUT', 'PAGE']) }).safeParse({ code, source })
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    const actor = await requireRole('STUDENT')
    const db = await getDb()
    await checkRateLimit(db, { scope: 'referral-attach', subject: actor.userId, limit: 10, windowSeconds: 3600 })
    return attachReferral(db, actor, parsed.data.code, parsed.data.source)
  })
  if (r.ok) revalidatePath('/student/invite')
  return r
}

/* ───────────── المسوّق ───────────── */

export async function remindCustomerAction(referralId: string): Promise<ActionResult> {
  const parsed = uuid.safeParse(referralId)
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    const actor = await requireRole('AFFILIATE')
    const db = await getDb()
    await checkRateLimit(db, { scope: 'affiliate-remind', subject: actor.userId, limit: 40, windowSeconds: 86_400 })
    await remindCustomer(db, actor, parsed.data)
    return undefined
  })
  if (r.ok) revalidatePath('/affiliate')
  return r
}

/* ───────────── «كن شريكًا» (عام) ───────────── */

const applicationSchema = z.object({
  kind: z.enum(['AFFILIATE', 'POINT_OF_SALE', 'TEACHER'], { message: 'اختر نوع الشراكة' }),
  fullName: z.string().trim().min(3, 'الاسم الكامل').max(120),
  phone: z.string().trim().min(9, 'رقم الهاتف').max(20),
  wilayaId: z.union([uuid, z.literal('')]).optional(),
  orgName: z.string().trim().max(160).optional(),
  address: z.string().trim().max(300).optional(),
  socialUrl: z.string().trim().max(300).optional(),
  followers: z.number().int().min(0).max(1_000_000_000).nullish(),
  subject: z.string().trim().max(120).optional(),
  message: z.string().trim().max(1000).optional(),
  website: z.string().max(0).optional()
})

export async function submitPartnerApplicationAction(_prev: ActionResult<{ duplicate: boolean }> | null, fd: FormData): Promise<ActionResult<{ duplicate: boolean }>> {
  const followersRaw = String(fd.get('followers') ?? '').replace(/[\s,.]/g, '')
  const parsed = applicationSchema.safeParse({
    kind: fd.get('kind') ?? '',
    fullName: fd.get('fullName') ?? '',
    phone: fd.get('phone') ?? '',
    wilayaId: fd.get('wilayaId') ?? '',
    orgName: fd.get('orgName') ?? '',
    address: fd.get('address') ?? '',
    socialUrl: fd.get('socialUrl') ?? '',
    followers: followersRaw === '' ? null : Number(followersRaw),
    subject: fd.get('subject') ?? '',
    message: fd.get('message') ?? '',
    // خانة مخفية: يملؤها الروبوت وحده
    website: fd.get('website') ?? ''
  })
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => {
    const db = await getDb()
    const meta = await requestMeta()
    await checkRateLimit(db, { scope: 'partner-apply', subject: meta.ip ?? 'unknown', limit: 5, windowSeconds: 3600 })
    const { website: _bot, ...input } = parsed.data
    const r = await submitPartnerApplication(db, { ...input, wilayaId: input.wilayaId || null }, { ip: meta.ip })
    return { duplicate: r.duplicate }
  })
}

/* ───────────── الإدارة (المشرف ومدير العمليات) ───────────── */

const affiliateSchema = z.object({
  fullName: z.string().trim().min(2, 'الاسم').max(120),
  phone: z.string().trim().min(9, 'رقم الهاتف').max(20),
  wilayaId: z.union([uuid, z.literal('')]).nullish(),
  socialUrl: z.string().trim().max(300).nullish(),
  followers: optInt,
  code: z.string().trim().max(24).nullish(),
  commissionDzd: optInt,
  note: z.string().trim().max(500).nullish()
})

export async function createAffiliateAction(input: z.input<typeof affiliateSchema>): Promise<ActionResult<AffiliateCredentials>> {
  const parsed = affiliateSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => createAffiliate(await getDb(), await requireRole(...STAFF), { ...parsed.data, wilayaId: parsed.data.wilayaId || null }))
  if (r.ok) revalidatePartners(r.data.affiliateId)
  return r
}

export async function updateAffiliateAction(id: string, input: { socialUrl?: string | null; followers?: number | null; wilayaId?: string | null; note?: string | null; code?: string | null; commissionDzd?: number | null }): Promise<ActionResult> {
  const parsed = z.object({ id: uuid, socialUrl: z.string().trim().max(300).nullish(), followers: optInt, wilayaId: z.union([uuid, z.literal('')]).nullish(), note: z.string().trim().max(500).nullish(), code: z.string().trim().max(24).nullish(), commissionDzd: optInt }).safeParse({ id, ...input })
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    const { id: affiliateId, ...rest } = parsed.data
    await updateAffiliate(await getDb(), await requireRole(...STAFF), affiliateId, { ...rest, wilayaId: rest.wilayaId || null })
    return undefined
  })
  if (r.ok) revalidatePartners(id)
  return r
}

export async function setAffiliateStatusAction(id: string, status: 'ACTIVE' | 'SUSPENDED'): Promise<ActionResult> {
  const parsed = z.object({ id: uuid, status: z.enum(['ACTIVE', 'SUSPENDED']) }).safeParse({ id, status })
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    await setAffiliateStatus(await getDb(), await requireRole(...STAFF), parsed.data.id, parsed.data.status)
    return undefined
  })
  if (r.ok) revalidatePartners(id)
  return r
}

export async function resetAffiliatePasswordAction(id: string): Promise<ActionResult<AffiliateCredentials>> {
  const parsed = uuid.safeParse(id)
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => resetAffiliatePassword(await getDb(), await requireRole(...STAFF), parsed.data))
}

export async function recordAffiliatePayoutAction(id: string, input: { amountDzd: number; note?: string | null }): Promise<ActionResult> {
  const parsed = z.object({ id: uuid, amountDzd: z.number().int().positive('المبلغ').max(10_000_000), note: z.string().trim().max(300).nullish() }).safeParse({ id, ...input })
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    await recordAffiliatePayout(await getDb(), await requireRole(...STAFF), parsed.data.id, { amountDzd: parsed.data.amountDzd, note: parsed.data.note })
    return undefined
  })
  if (r.ok) revalidatePartners(id)
  return r
}

export async function voidRewardAction(rewardId: string, reason: string, affiliateId?: string | null): Promise<ActionResult> {
  const parsed = z.object({ rewardId: uuid, reason: z.string().trim().min(3, 'اكتب السبب').max(300) }).safeParse({ rewardId, reason })
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    await voidReward(await getDb(), await requireRole(...STAFF), parsed.data.rewardId, parsed.data.reason)
    return undefined
  })
  if (r.ok) revalidatePartners(affiliateId ?? undefined)
  return r
}

export async function approveApplicationAction(id: string, input: { code?: string | null; commissionDzd?: number | null; note?: string | null } = {}): Promise<ActionResult<ApprovedApplication>> {
  const parsed = z.object({ id: uuid, code: z.string().trim().max(24).nullish(), commissionDzd: optInt, note: z.string().trim().max(300).nullish() }).safeParse({ id, ...input })
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => approvePartnerApplication(await getDb(), await requireRole(...STAFF), parsed.data.id, { code: parsed.data.code || null, commissionDzd: parsed.data.commissionDzd ?? null, note: parsed.data.note ?? null }))
  if (r.ok) {
    revalidatePartners()
    revalidatePath('/admin/points-of-sale')
  }
  return r
}

export async function rejectApplicationAction(id: string, note?: string | null): Promise<ActionResult> {
  const parsed = z.object({ id: uuid, note: z.string().trim().max(300).nullish() }).safeParse({ id, note })
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    await rejectPartnerApplication(await getDb(), await requireRole(...STAFF), parsed.data.id, parsed.data.note)
    return undefined
  })
  if (r.ok) revalidatePartners()
  return r
}

/** المبالغ والمدد — للمشرف وحده */
export async function setReferralPolicyAction(input: Partial<ReferralPolicy>): Promise<ActionResult<ReferralPolicy>> {
  const n = (max: number, min = 0) => z.number().int().min(min).max(max).optional()
  const parsed = z.object({ enabled: z.boolean().optional(), affiliateDefaultDzd: n(100_000), referrerCreditDzd: n(100_000), welcomeCreditDzd: n(100_000), creditMonths: n(36, 1), holdDays: n(60) }).strict().safeParse(input)
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => setReferralPolicy(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data))
  if (r.ok) revalidatePartners()
  return r
}
