/**
 * الإعدادات التجارية التي كانت في `.env` أو في الكود، صارت من لوحة الإدارة (البند ب5، 12 نوفمبر 2026).
 * قاعدة المالك: «كل إعداد تجاري (أسعار، عروض، عمولات) يُتحكَّم فيه من لوحة الإدارة دون برمجة».
 *
 * الجرد (ما بقي خارج اللوحة قبل هذا البند):
 *  - رسم التوصيل الاحتياطي حين لا جدول EcoTrack للولاية: كان `STORE_SHIPPING_DZD` في البيئة.
 *  - نصيب الأستاذ في سوق الأساتذة: كان `MARKETPLACE_TEACHER_SHARE_PCT` في البيئة (70 إن لم يُضبط).
 *  - مدة تجربة PLAY المجانية: كانت 72 ساعة في الكود.
 * ما كان في اللوحة أصلًا: أسعار الدورات والكتب والنسخة الرقمية، سياسة الإحالة، عمولة نقطة البيع والمسوّق، رمز تأكيد الطلب.
 * ما يبقى في الكود عمدًا: أدنى مبلغ للبطاقة 50 دج (حدّ بوابة eFawtara)، وحدود التحقق من المدخلات، وسقف رسائل SMS اليومي
 * (حماية تشغيلية من الكلفة لا عرض تجاري).
 *
 * لا تغيير بعد النشر: ما لم يحفظ المشرف قيمة، تبقى القيمة كما كانت (من البيئة أو 72 ساعة).
 * كل قرار مالي يقرأ من القاعدة مباشرة؛ العرض وحده يُحفظ 30 ثانية في كل عملية.
 */
import { desc, eq } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { appSettings, auditLogs, profiles } from '@/server/db/schema'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError } from '@/server/lib/errors'
import { ttlDelete, ttlMemo } from '@/server/lib/ttl-cache'
import { PLAY_TRIAL_HOURS } from '@/server/play/constants'

export interface CommercialSettings {
  /** رسم التوصيل (دج) حين لا جدول EcoTrack محفوظ للولاية */
  shippingFallbackDzd: number
  /** نصيب الأستاذ من كل بيع في سوق الأساتذة (%) */
  marketplaceTeacherSharePct: number
  /** مدة تجربة PLAY المجانية لغير المشتركين (ساعات). تمسّ التجارب التي تبدأ بعد الحفظ فقط */
  playTrialHours: number
}

export type CommercialKey = keyof CommercialSettings

/** الحدود الدنيا والعليا: خطأ في اللوحة لا يصنع سعرًا خياليًا */
export const COMMERCIAL_BOUNDS: Record<CommercialKey, readonly [number, number]> = {
  shippingFallbackDzd: [0, 5000],
  marketplaceTeacherSharePct: [0, 100],
  playTrialHours: [1, 720]
}

export const COMMERCIAL_LABELS: Record<CommercialKey, string> = {
  shippingFallbackDzd: 'رسم التوصيل الاحتياطي (دج)',
  marketplaceTeacherSharePct: 'نصيب الأستاذ في سوق الأساتذة (%)',
  playTrialHours: 'مدة تجربة PLAY المجانية (ساعات)'
}

const KEY = 'commercial.settings'
const DISPLAY_KEY = 'public:commercial-settings'
const AUDIT_ACTION = 'settings.commercial'

const inBounds = (k: CommercialKey, v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= COMMERCIAL_BOUNDS[k][0] && v <= COMMERCIAL_BOUNDS[k][1]

/** القيم قبل أي حفظ في اللوحة: ما كان يعمل به الخادم حتى الآن */
export function commercialDefaults(env: NodeJS.ProcessEnv = process.env): CommercialSettings {
  const num = (raw: string | undefined, k: CommercialKey, fallback: number) => {
    const v = Math.round(Number(raw))
    return raw !== undefined && raw !== '' && inBounds(k, v) ? v : fallback
  }
  return {
    shippingFallbackDzd: num(env.STORE_SHIPPING_DZD, 'shippingFallbackDzd', 0),
    marketplaceTeacherSharePct: num(env.MARKETPLACE_TEACHER_SHARE_PCT, 'marketplaceTeacherSharePct', 70),
    playTrialHours: PLAY_TRIAL_HOURS
  }
}

/** القيم النافذة الآن (من القاعدة؛ ما لم يُحفظ يبقى على قيمته القديمة) */
export async function commercialSettings(db: Db): Promise<CommercialSettings> {
  const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, KEY)).limit(1)
  const saved = (row?.value ?? {}) as Partial<Record<CommercialKey, unknown>>
  const d = commercialDefaults()
  const pick = (k: CommercialKey) => (inBounds(k, saved[k]) ? (saved[k] as number) : d[k])
  return { shippingFallbackDzd: pick('shippingFallbackDzd'), marketplaceTeacherSharePct: pick('marketplaceTeacherSharePct'), playTrialHours: pick('playTrialHours') }
}

/** للعرض في الصفحات (السلة، صفحة المنتج): يُحفظ 30 ثانية ويُبطَل فور الحفظ في العملية نفسها */
export function commercialSettingsForDisplay(db: Db): Promise<CommercialSettings> {
  return ttlMemo(DISPLAY_KEY, 30_000, () => commercialSettings(db))
}

export async function setCommercialSettings(db: Db, actor: Actor, input: Partial<Record<CommercialKey, unknown>>): Promise<CommercialSettings> {
  assertRole(actor, 'SUPER_ADMIN')
  const prev = await commercialSettings(db)
  const next: CommercialSettings = { ...prev }
  for (const k of Object.keys(COMMERCIAL_BOUNDS) as CommercialKey[]) {
    if (input[k] === undefined) continue
    if (!inBounds(k, input[k])) throw new AppError('VALIDATION', { field: k })
    next[k] = input[k] as number
  }
  const changed = (Object.keys(next) as CommercialKey[]).filter((k) => next[k] !== prev[k])
  await db.insert(appSettings).values({ key: KEY, value: next }).onConflictDoUpdate({ target: appSettings.key, set: { value: next, updatedAt: new Date() } })
  ttlDelete(DISPLAY_KEY)
  if (changed.length) {
    await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: AUDIT_ACTION, entityType: 'settings', entityId: null, oldValue: Object.fromEntries(changed.map((k) => [k, prev[k]])), newValue: Object.fromEntries(changed.map((k) => [k, next[k]])) })
  }
  return next
}

export interface CommercialChange {
  at: Date
  by: string | null
  changes: { key: CommercialKey; label: string; from: number | null; to: number | null }[]
}

/** آخر التغييرات (من غيّر، ومتى، ومن أي قيمة إلى أي قيمة) */
export async function commercialSettingsHistory(db: Db, actor: Actor, limit = 10): Promise<CommercialChange[]> {
  assertRole(actor, 'SUPER_ADMIN')
  const rows = await db
    .select({ at: auditLogs.createdAt, by: profiles.fullName, oldValue: auditLogs.oldValue, newValue: auditLogs.newValue })
    .from(auditLogs)
    .leftJoin(profiles, eq(profiles.userId, auditLogs.actorUserId))
    .where(eq(auditLogs.action, AUDIT_ACTION))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
  return rows.map((r) => {
    const from = (r.oldValue ?? {}) as Record<string, unknown>
    const to = (r.newValue ?? {}) as Record<string, unknown>
    const keys = (Object.keys(COMMERCIAL_BOUNDS) as CommercialKey[]).filter((k) => k in to)
    return { at: r.at, by: r.by ?? null, changes: keys.map((k) => ({ key: k, label: COMMERCIAL_LABELS[k], from: typeof from[k] === 'number' ? (from[k] as number) : null, to: typeof to[k] === 'number' ? (to[k] as number) : null })) }
  })
}
