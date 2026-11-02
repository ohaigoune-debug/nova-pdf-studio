/**
 * المسوّقون بالعمولة ودعوة الزملاء والرصيد الرقمي (قرار المالك 2026-11-02).
 *
 *  - السعر واحد في كل القنوات (الموقع، المسوّق، المدرسة): لا خصم عند الدفع، بل رصيد بعد الشراء.
 *  - كود واحد لكل مسوّق ولكل تلميذ؛ التلميذ الجديد يُنسب لأول كود يدخله ولا يتغيّر.
 *  - المكافأة عند تسليم أول طلب دورة للتلميذ الجديد: نقد للمسوّق (بعد مهلة)، ورصيد للتلميذ الداعي،
 *    ورصيد ترحيبي للتلميذ الجديد. تُلغى إن أُرجع الطلب.
 *  - الرصيد دفعات لكل منها تاريخ انتهاء، ويُستعمل لشراء الدورات فقط ولا يُصرف نقدًا.
 */
import { sql } from 'drizzle-orm'
import { boolean, check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { id, inList, timestamps } from './_common'
import { users } from './auth'
import {
  AFFILIATE_STATUSES,
  CREDIT_LOT_SOURCES,
  PARTNER_APPLICATION_KINDS,
  PARTNER_APPLICATION_STATUSES,
  PROMO_CODE_KINDS,
  REFERRAL_REWARD_KINDS,
  REFERRAL_REWARD_STATUSES,
  REFERRAL_SOURCES,
  REFERRAL_STATUSES
} from './enums'
import { wilayas } from './reference'
import { orders } from './store'

/** طلبات «كن شريكًا» من الصفحة العامة: مسوّق، نقطة بيع، أستاذ */
export const partnerApplications = pgTable(
  'partner_applications',
  {
    id: id(),
    kind: text('kind').notNull(),
    fullName: text('full_name').notNull(),
    phone: text('phone').notNull(),
    wilayaId: uuid('wilaya_id').references(() => wilayas.id, { onDelete: 'set null' }),
    /** اسم المدرسة أو المكتبة (نقطة بيع) */
    orgName: text('org_name'),
    address: text('address'),
    /** رابط الصفحة أو الحساب (مسوّق) */
    socialUrl: text('social_url'),
    followers: integer('followers'),
    /** المادة (أستاذ) */
    subject: text('subject'),
    message: text('message'),
    status: text('status').notNull().default('NEW'),
    decidedByUserId: uuid('decided_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionNote: text('decision_note'),
    /** ما أُنشئ عند القبول (المسوّق أو نقطة البيع) */
    resultEntityId: uuid('result_entity_id'),
    ip: text('ip'),
    ...timestamps
  },
  (t) => [
    check('partner_applications_kind_check', inList(t.kind, PARTNER_APPLICATION_KINDS)),
    check('partner_applications_status_check', inList(t.status, PARTNER_APPLICATION_STATUSES)),
    check('partner_applications_followers_check', sql`${t.followers} IS NULL OR ${t.followers} >= 0`),
    index('partner_applications_status_idx').on(t.status, t.createdAt)
  ]
)

/** المسوّق المقبول: حساب AFFILIATE واحد، وعمولة ثابتة عن كل تلميذ جديد يشتري بكوده */
export const affiliates = pgTable(
  'affiliates',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    wilayaId: uuid('wilaya_id').references(() => wilayas.id, { onDelete: 'set null' }),
    socialUrl: text('social_url'),
    followers: integer('followers'),
    commissionDzd: integer('commission_dzd').notNull().default(300),
    status: text('status').notNull().default('ACTIVE'),
    note: text('note'),
    applicationId: uuid('application_id').references(() => partnerApplications.id, { onDelete: 'set null' }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps
  },
  (t) => [
    check('affiliates_status_check', inList(t.status, AFFILIATE_STATUSES)),
    check('affiliates_commission_check', sql`${t.commissionDzd} >= 0`),
    check('affiliates_followers_check', sql`${t.followers} IS NULL OR ${t.followers} >= 0`),
    uniqueIndex('affiliates_user_unique').on(t.userId)
  ]
)

/** كود الدعوة: للمسوّق أو للتلميذ (مجال واحد، حروف لاتينية كبيرة وأرقام) */
export const promoCodes = pgTable(
  'promo_codes',
  {
    id: id(),
    code: text('code').notNull(),
    kind: text('kind').notNull(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    check('promo_codes_kind_check', inList(t.kind, PROMO_CODE_KINDS)),
    check('promo_codes_code_check', sql`${t.code} ~ '^[A-Z0-9]{4,16}$'`),
    uniqueIndex('promo_codes_code_unique').on(t.code),
    uniqueIndex('promo_codes_owner_unique').on(t.ownerUserId)
  ]
)

/** نسبة التلميذ الجديد إلى من جاء به: واحدة لكل تلميذ، تُثبَّت أول مرة ولا تتغيّر */
export const referrals = pgTable(
  'referrals',
  {
    id: id(),
    referredUserId: uuid('referred_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    codeId: uuid('code_id')
      .notNull()
      .references(() => promoCodes.id, { onDelete: 'cascade' }),
    referrerUserId: uuid('referrer_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    source: text('source').notNull(),
    status: text('status').notNull().default('PENDING'),
    /** الطلب الذي استحقّت به المكافأة */
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    qualifiedAt: timestamp('qualified_at', { withTimezone: true }),
    /** «ذكّره» من المسوّق */
    remindedAt: timestamp('reminded_at', { withTimezone: true }),
    remindCount: integer('remind_count').notNull().default(0),
    note: text('note'),
    ...timestamps
  },
  (t) => [
    check('referrals_kind_check', inList(t.kind, PROMO_CODE_KINDS)),
    check('referrals_source_check', inList(t.source, REFERRAL_SOURCES)),
    check('referrals_status_check', inList(t.status, REFERRAL_STATUSES)),
    check('referrals_not_self_check', sql`${t.referredUserId} <> ${t.referrerUserId}`),
    uniqueIndex('referrals_referred_unique').on(t.referredUserId),
    index('referrals_referrer_idx').on(t.referrerUserId, t.createdAt)
  ]
)

/** المكافآت المستحقّة (قيد لا يُحذف؛ الإلغاء حالة REVERSED بسببها ومن ألغاها) */
export const referralRewards = pgTable(
  'referral_rewards',
  {
    id: id(),
    referralId: uuid('referral_id')
      .notNull()
      .references(() => referrals.id, { onDelete: 'cascade' }),
    beneficiaryUserId: uuid('beneficiary_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    amountDzd: integer('amount_dzd').notNull(),
    status: text('status').notNull().default('EARNED'),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    /** نقد المسوّق يصبح قابلًا للدفع بعد مهلة الإرجاع */
    availableAt: timestamp('available_at', { withTimezone: true }).notNull().defaultNow(),
    reversedAt: timestamp('reversed_at', { withTimezone: true }),
    reverseReason: text('reverse_reason'),
    reversedByUserId: uuid('reversed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    check('referral_rewards_kind_check', inList(t.kind, REFERRAL_REWARD_KINDS)),
    check('referral_rewards_status_check', inList(t.status, REFERRAL_REWARD_STATUSES)),
    check('referral_rewards_amount_check', sql`${t.amountDzd} > 0`),
    uniqueIndex('referral_rewards_referral_kind_unique').on(t.referralId, t.kind),
    index('referral_rewards_beneficiary_idx').on(t.beneficiaryUserId, t.createdAt)
  ]
)

/** دفعة رصيد بتاريخ انتهاء؛ الرصيد المتاح = مجموع المتبقي من الدفعات السارية */
export const creditLots = pgTable(
  'credit_lots',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    amountDzd: integer('amount_dzd').notNull(),
    remainingDzd: integer('remaining_dzd').notNull(),
    source: text('source').notNull(),
    rewardId: uuid('reward_id').references(() => referralRewards.id, { onDelete: 'set null' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    note: text('note'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    check('credit_lots_source_check', inList(t.source, CREDIT_LOT_SOURCES)),
    check('credit_lots_amount_check', sql`${t.amountDzd} > 0`),
    check('credit_lots_remaining_check', sql`${t.remainingDzd} >= 0 AND ${t.remainingDzd} <= ${t.amountDzd}`),
    index('credit_lots_user_idx').on(t.userId, t.expiresAt)
  ]
)

/** ما خُصم من كل دفعة لطلب؛ يُعاد إن أُلغي الطلب */
export const creditSpends = pgTable(
  'credit_spends',
  {
    id: id(),
    lotId: uuid('lot_id')
      .notNull()
      .references(() => creditLots.id, { onDelete: 'cascade' }),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    amountDzd: integer('amount_dzd').notNull(),
    refundedAt: timestamp('refunded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [check('credit_spends_amount_check', sql`${t.amountDzd} > 0`), index('credit_spends_order_idx').on(t.orderId), index('credit_spends_lot_idx').on(t.lotId)]
)

/** ما دُفع للمسوّق نقدًا (قيد لا يُحذف) */
export const affiliatePayouts = pgTable(
  'affiliate_payouts',
  {
    id: id(),
    affiliateId: uuid('affiliate_id')
      .notNull()
      .references(() => affiliates.id, { onDelete: 'cascade' }),
    amountDzd: integer('amount_dzd').notNull(),
    note: text('note'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [check('affiliate_payouts_amount_check', sql`${t.amountDzd} > 0`), index('affiliate_payouts_affiliate_idx').on(t.affiliateId, t.createdAt)]
)
