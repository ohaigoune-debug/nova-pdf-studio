/**
 * التأكيد بالمكالمة الفائتة (نسق NOVA COMMERCE، نفس تطبيق NOVA Call على هاتف المشرف):
 * يُقال للزبون «اتصل بهذا الرقم، لا داعي لانتظار الردّ»؛ التطبيق يبلّغ المنصّة برقم المتصل،
 * ومكالمة من هاتف طلب معلّق تؤكّده. مجاني للزبون، بلا وقت موظف، بلا إنترنت عنده.
 * العنوان: POST /api/v1/calls/<secret> — سرّ عشوائي في المسار (كما في NOVA) يُنشأ عند أول حفظ.
 */
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { and, desc, eq, gte, inArray, isNull, lte } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { appSettings, callEvents, orders, profiles } from '@/server/db/schema'
import { CONFIRMATION_STATUSES, type CallEventResult } from '@/server/db/schema/enums'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError } from '@/server/lib/errors'
import { notifyAdmins, transitionOrder } from './order-status.service'
import { normalizePhone } from './otp.service'

export const CALL_CONFIRM_KEY = 'confirm.call'

export interface CallConfirmConfig {
  enabled: boolean
  /** الرقم الذي يُطلب من الزبون الاتصال به (صيغة محلية 05/06/07) */
  number: string
  /** سرّ مسار التطبيق */
  secret: string | null
  /** تؤكّد المكالمة الطلبات المنشأة خلال هذه المدة فقط */
  windowHours: 24 | 72 | 168
  /** التطبيق يقطع المكالمة المطابقة بعد أول رنّة فلا تكلّف الزبون شيئاً */
  autoReject: boolean
  /** آخر إشارة حياة من تطبيق الهاتف */
  lastSeenAt: string | null
  appVersion: string | null
}

const DEFAULTS: CallConfirmConfig = { enabled: false, number: '', secret: null, windowHours: 72, autoReject: true, lastSeenAt: null, appVersion: null }

function read(v: unknown): CallConfirmConfig {
  const raw = (v ?? {}) as Partial<CallConfirmConfig>
  return {
    enabled: raw.enabled === true,
    number: typeof raw.number === 'string' ? raw.number : '',
    secret: typeof raw.secret === 'string' && raw.secret ? raw.secret : null,
    windowHours: raw.windowHours === 24 || raw.windowHours === 168 ? raw.windowHours : 72,
    autoReject: raw.autoReject !== false,
    lastSeenAt: typeof raw.lastSeenAt === 'string' && raw.lastSeenAt ? raw.lastSeenAt : null,
    appVersion: typeof raw.appVersion === 'string' && raw.appVersion ? raw.appVersion : null
  }
}

export async function getCallConfirm(db: Db): Promise<CallConfirmConfig> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, CALL_CONFIRM_KEY)).limit(1)
  return read(row?.value)
}

async function write(db: Db, cfg: CallConfirmConfig): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key: CALL_CONFIRM_KEY, value: cfg })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: cfg, updatedAt: new Date() } })
}

/** يحفظ الإعداد؛ السرّ يُنشأ عند أول حفظ ويبقى حتى يُدوَّر */
export async function saveCallConfirm(db: Db, actor: Actor, patch: Partial<Pick<CallConfirmConfig, 'enabled' | 'number' | 'windowHours' | 'autoReject'>>, opts: { rotateSecret?: boolean } = {}): Promise<CallConfirmConfig> {
  assertRole(actor, 'SUPER_ADMIN')
  const cur = await getCallConfirm(db)
  const next: CallConfirmConfig = { ...DEFAULTS, ...cur, ...patch, secret: opts.rotateSecret || !cur.secret ? randomBytes(18).toString('base64url') : cur.secret }
  if (next.enabled) next.number = normalizePhone(next.number)
  await write(db, next)
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'call_confirm.saved', entityType: 'settings', entityId: null, newValue: { enabled: next.enabled, number: next.number, windowHours: next.windowHours, autoReject: next.autoReject, rotated: Boolean(opts.rotateSecret) } })
  return next
}

/** يسجّل أن تطبيق الهاتف وصل إلينا (كل دقيقتين على الأكثر) */
export async function touchCallApp(db: Db, version?: string | null): Promise<void> {
  const cur = await getCallConfirm(db)
  const last = cur.lastSeenAt ? new Date(cur.lastSeenAt).getTime() : 0
  if (Date.now() - last < 2 * 60_000 && (!version || version === cur.appVersion)) return
  await write(db, { ...cur, lastSeenAt: new Date().toISOString(), appVersion: (version ?? '').trim().slice(0, 20) || cur.appVersion })
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

/** التحقق من سرّ المسار؛ null حين لا يطابق */
export async function authorizeCallSecret(db: Db, secret: string): Promise<CallConfirmConfig | null> {
  const cfg = await getCallConfirm(db)
  if (!cfg.secret || !secret || !safeEqual(secret, cfg.secret)) return null
  return cfg
}

export interface IncomingCallResult {
  result: CallEventResult
  orderNumber?: string
  customerName?: string
  /** ماذا يفعل التطبيق بالمكالمة الرنّانة */
  reject: boolean
}

/** الطلبات المنشأة بعد اللحظة المبلَّغ عنها بقليل تُحسب أيضاً (الساعات والطوابير ليست دقيقة) */
const AT_SLACK_MS = 2 * 60_000

/**
 * بلّغ الهاتف بمكالمة. نطابقها بأحدث طلب معلّق لذلك الرقم داخل النافذة ونؤكّده.
 * غير ذلك يُسجَّل فقط (ويُخبَر المشرف أن زبوناً اتصل).
 */
export async function handleIncomingCall(db: Db, rawPhone: string, opts: { channel?: 'call' | 'sms'; text?: string | null; at?: Date } = {}): Promise<IncomingCallResult> {
  const cfg = await getCallConfirm(db)
  if (!cfg.enabled) return { result: 'disabled', reject: false }
  const channel = opts.channel ?? 'call'
  const at = opts.at && opts.at.getTime() < Date.now() ? opts.at : new Date()
  const text = (opts.text ?? '').trim().slice(0, 500) || null
  let phone: string
  try {
    phone = normalizePhone(rawPhone)
  } catch {
    await db.insert(callEvents).values({ createdAt: at, phone: rawPhone.slice(0, 32), result: 'invalid_phone', channel, text })
    return { result: 'invalid_phone', reject: false }
  }
  // الحساب الجديد يؤكّد هاتفه بمكالمة فائتة مجانية (بوّابة التسجيل): نُعلِّم كل ملف غير مؤكَّد بهذا الرقم
  const verified = await db
    .update(profiles)
    .set({ phoneVerifiedAt: at, updatedAt: new Date() })
    .where(and(eq(profiles.phone, phone), isNull(profiles.phoneVerifiedAt)))
    .returning({ userId: profiles.userId, fullName: profiles.fullName })
  const since = new Date(at.getTime() - cfg.windowHours * 3_600_000)
  const until = new Date(at.getTime() + AT_SLACK_MS)
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.phone, phone), gte(orders.createdAt, since), lte(orders.createdAt, until), inArray(orders.status, [...CONFIRMATION_STATUSES, 'CONFIRMED', 'SHIPPED'])))
    .orderBy(desc(orders.createdAt))
    .limit(1)
  if (!order && verified.length) {
    await db.insert(callEvents).values({ createdAt: at, phone, result: 'phone_verified', channel, text: verified.map((v) => v.fullName).join('، ').slice(0, 500) })
    return { result: 'phone_verified', customerName: verified[0]!.fullName, reject: cfg.autoReject }
  }
  if (!order) {
    await db.insert(callEvents).values({ createdAt: at, phone, result: 'no_order', channel, text })
    await notifyAdmins(db, { title: `📞 اتصال من ${phone} بلا طلب معلّق`, body: text ? `رسالة: ${text}` : 'لا طلب خلال النافذة.', link: '/admin/store/confirm', telegram: false })
    return { result: 'no_order', reject: false }
  }
  if (!(CONFIRMATION_STATUSES as readonly string[]).includes(order.status)) {
    await db.insert(callEvents).values({ createdAt: at, phone, orderId: order.id, orderNumber: order.number, result: 'already_confirmed', channel, text })
    return { result: 'already_confirmed', orderNumber: order.number, customerName: order.customerName, reject: cfg.autoReject }
  }
  await transitionOrder(db, order.id, 'CONFIRMED', { actorUserId: null, source: channel === 'sms' ? 'sms' : 'call' })
  await db.insert(callEvents).values({ createdAt: at, phone, orderId: order.id, orderNumber: order.number, result: 'confirmed', channel, text })
  return { result: 'confirmed', orderNumber: order.number, customerName: order.customerName, reject: cfg.autoReject }
}

export async function listCallEvents(db: Db, actor: Actor, limit = 30) {
  assertRole(actor, 'SUPER_ADMIN')
  return db.select().from(callEvents).orderBy(desc(callEvents.createdAt)).limit(Math.max(1, Math.min(200, limit)))
}

/** عنوان الاقتران للتطبيق (يُعرض للمشرف فقط) */
export function callPairingUrl(secret: string | null, base: string | null | undefined): string | null {
  if (!secret || !base) return null
  return `${base.replace(/\/$/, '')}/api/v1/calls/${secret}`
}

export function assertCallConfirmEnabled(cfg: CallConfirmConfig): void {
  if (!cfg.enabled) throw new AppError('CALL_CONFIRM_DISABLED')
}
