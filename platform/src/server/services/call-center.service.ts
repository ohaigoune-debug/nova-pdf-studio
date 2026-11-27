/**
 * مركز الاتصال الذكي (قرار المالك 27 نوفمبر 2026).
 *
 * التدفّق:
 *  1. مهمة CALLCENTER_TICK كل 5 دقائق تقرأ حالات 48HR (أحداث EcoTrack المسجّلة أصلًا في delivery_events)
 *     والطلبات الجديدة، وتُنشئ مهامّ في cc_tasks (رسالة أو مكالمة) — كل قاعدة مرة واحدة لكل طلب (dedupe_key).
 *  2. الرسائل تخرج من مزوّد الرسائل المربوط (sendSms) أو من شرائح الصندوق حسب الإعداد.
 *  3. الصندوق المحلي في بوسعادة (Asterisk + Yeastar TG400L) يسحب المكالمات عبر HTTPS (/api/v1/callcenter/agent/*)
 *     برمز سرّي، يتصل، ثم يعيد النتيجة (ردّ/لم يردّ/الزر المضغوط). لا منفذ مفتوح عنده.
 *  4. ما يحتاج إنسانًا يظهر في لوحة الموظف: اختيارات تُنفَّذ عند 48HR، من لم يردّ بعد كل المحاولات، والمكالمات الواردة.
 *
 * الأمان: وضع off افتراضيًا. وضع test يخطّط كل شيء لكنه لا يتصل ولا يراسل إلا أرقام التجربة (الباقي «محاكى»).
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { appSettings, ccAttempts, ccContacts, ccInbound, ccTasks, codPhoneBlocks, deliveryEvents, jobs, orderItems, orders, profiles, students } from '@/server/db/schema'
import { CONFIRMATION_STATUSES } from '@/server/db/schema/enums'
import type { CcOutcome, CcTarget } from '@/server/db/schema/call-center'
import { enqueueJob } from '@/server/jobs/queue'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { getSmsSender } from '@/server/lib/sms'
import { newStorageKey, storage } from '@/server/lib/storage'
import {
  ACTION_AR,
  CALL_CENTER_KEY,
  CC_RULES,
  DEFAULT_CALL_CENTER,
  SCRIPTS,
  actionFor,
  deliveryRuleFor,
  dzStartOfDay,
  localPhone,
  nextCallingTime,
  readCallCenterConfig,
  renderText,
  retryAt,
  withinCallingHours,
  type CallCenterConfig,
  type CcMode,
  type CcRule,
  type CcScript
} from '@/lib/call-center'
import { transitionOrder } from './order-status.service'

export const CALLCENTER_TICK_MS = 5 * 60 * 1000
/** مدة حجز المكالمة عند الصندوق: إن لم تصل النتيجة خلالها تُعدّ محاولة فاشلة */
export const AGENT_LEASE_MS = 10 * 60 * 1000
export const SMS_MAX_ATTEMPTS = 3
export const MAX_RECORDING_BYTES = 8 * 1024 * 1024

/* ───────────────────────── الإعداد ───────────────────────── */

export async function getCallCenterConfig(db: Db): Promise<CallCenterConfig> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, CALL_CENTER_KEY)).limit(1)
  return readCallCenterConfig(row?.value)
}

async function writeConfig(db: Db, cfg: CallCenterConfig): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key: CALL_CENTER_KEY, value: cfg })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: cfg, updatedAt: new Date() } })
}

/** ما يُعرض في صفحة الإعدادات: بلا بصمة الرمز */
export type PublicCallCenterConfig = Omit<CallCenterConfig, 'agent'> & { agent: Omit<CallCenterConfig['agent'], 'tokenHash'> & { paired: boolean } }

export function publicConfig(cfg: CallCenterConfig): PublicCallCenterConfig {
  const { tokenHash, ...agent } = cfg.agent
  return { ...cfg, agent: { ...agent, paired: Boolean(tokenHash) } }
}

export interface CallCenterSettingsInput {
  mode: CcMode
  testPhones: string[]
  outboundSims: number[]
  inboundSim: number
  dailyCapPerSim: number
  quietStart: number
  quietEnd: number
  maxCallAttempts: number
  homeStuckHours: number
  smsChannel: 'provider' | 'gateway'
  rules: Partial<Record<CcRule, boolean>>
  confirmAmountDzd: number
  deskArrivedText: string
  homeArrivedText: string
}

/** يحفظ الإعدادات (المشرف وحده). أول تشغيل من off يسجّل enabledAt: لا رسائل لأحداث سبقته. */
export async function saveCallCenterSettings(db: Db, actor: Actor, input: Partial<CallCenterSettingsInput>): Promise<PublicCallCenterConfig> {
  assertRole(actor, 'SUPER_ADMIN')
  const cur = await getCallCenterConfig(db)
  const rules = { ...cur.rules }
  for (const k of CC_RULES) if (typeof input.rules?.[k] === 'boolean') rules[k] = input.rules[k]!
  const outbound = input.outboundSims ?? cur.outboundSims
  const inbound = input.inboundSim ?? cur.inboundSim
  if (outbound.includes(inbound)) throw new AppError('VALIDATION', { field: 'inboundSim' })
  const testPhones = (input.testPhones ?? cur.testPhones).map((p) => localPhone(p))
  if (testPhones.some((p) => !p)) throw new AppError('VALIDATION', { field: 'testPhones' })
  const mode = input.mode ?? cur.mode
  if (mode === 'test' && !testPhones.length) throw new AppError('VALIDATION', { field: 'testPhones' })
  const next = readCallCenterConfig({
    ...cur,
    mode,
    enabledAt: mode !== 'off' && (cur.mode === 'off' || !cur.enabledAt) ? new Date().toISOString() : cur.enabledAt,
    testPhones,
    outboundSims: outbound,
    inboundSim: inbound,
    dailyCapPerSim: input.dailyCapPerSim ?? cur.dailyCapPerSim,
    quietStart: input.quietStart ?? cur.quietStart,
    quietEnd: input.quietEnd ?? cur.quietEnd,
    maxCallAttempts: input.maxCallAttempts ?? cur.maxCallAttempts,
    homeStuckHours: input.homeStuckHours ?? cur.homeStuckHours,
    smsChannel: input.smsChannel ?? cur.smsChannel,
    rules,
    confirmSpecial: { ...cur.confirmSpecial, amountDzd: input.confirmAmountDzd ?? cur.confirmSpecial.amountDzd },
    texts: { ...cur.texts, deskArrived: input.deskArrivedText ?? cur.texts.deskArrived, homeArrived: input.homeArrivedText ?? cur.texts.homeArrived }
  })
  if (next.quietStart >= next.quietEnd) throw new AppError('VALIDATION', { field: 'quietStart' })
  await writeConfig(db, next)
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'callcenter.settings_saved', entityType: 'settings', entityId: null, oldValue: { mode: cur.mode }, newValue: { mode: next.mode, outboundSims: next.outboundSims, inboundSim: next.inboundSim, cap: next.dailyCapPerSim, smsChannel: next.smsChannel, testPhones: next.testPhones.length } })
  return publicConfig(next)
}

const hashToken = (token: string) => createHash('sha256').update(`cc-agent:${token}`).digest('hex')

/** رمز جديد للصندوق المحلي: يُعرض مرة واحدة، ولا يُحفظ إلا بصمته */
export async function rotateAgentToken(db: Db, actor: Actor): Promise<{ token: string; hint: string }> {
  assertRole(actor, 'SUPER_ADMIN')
  const cur = await getCallCenterConfig(db)
  const token = `cc_${randomBytes(24).toString('base64url')}`
  const hint = token.slice(-4)
  await writeConfig(db, { ...cur, agent: { ...cur.agent, tokenHash: hashToken(token), hint } })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'callcenter.agent_token_rotated', entityType: 'settings', entityId: null, newValue: { hint } })
  return { token, hint }
}

/** يتحقق من رمز الصندوق (Bearer) — null حين لا يطابق */
export async function authorizeAgent(db: Db, bearer: string | null | undefined): Promise<CallCenterConfig | null> {
  const token = (bearer ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const cfg = await getCallCenterConfig(db)
  if (!cfg.agent.tokenHash) return null
  const a = Buffer.from(hashToken(token))
  const b = Buffer.from(cfg.agent.tokenHash)
  return a.length === b.length && timingSafeEqual(a, b) ? cfg : null
}

/** نبضة الصندوق: آخر ظهور، النسخة، وحالة الشرائح (كل دقيقة على الأكثر) */
export async function touchAgent(db: Db, info: { version?: string | null; sims?: { slot: number; ok: boolean; signal?: number | null }[] } = {}): Promise<void> {
  const cur = await getCallCenterConfig(db)
  const last = cur.agent.lastSeenAt ? new Date(cur.agent.lastSeenAt).getTime() : 0
  if (Date.now() - last < 60_000 && !info.sims && (!info.version || info.version === cur.agent.version)) return
  await writeConfig(db, {
    ...cur,
    agent: {
      ...cur.agent,
      lastSeenAt: new Date().toISOString(),
      version: (info.version ?? '').trim().slice(0, 20) || cur.agent.version,
      sims: info.sims ? info.sims.slice(0, 32).map((s) => ({ slot: s.slot, ok: s.ok, signal: s.signal ?? null })) : cur.agent.sims
    }
  })
}

/* ───────────────────────── إنشاء المهامّ ───────────────────────── */

interface NewTask {
  orderId: string | null
  userId: string | null
  kind: 'SMS' | 'CALL'
  rule: CcRule
  dedupeKey: string
  target: CcTarget
  phone: string
  script?: CcScript | null
  message?: string | null
  context?: string | null
  maxAttempts?: number
  runAfter?: Date
}

/** يُدرج المهمة مرة واحدة (dedupe_key). وضع test: رقم ليس من أرقام التجربة ⇒ «محاكاة» لا تخرج أبدًا */
async function createTask(db: Db, cfg: CallCenterConfig, t: NewTask): Promise<boolean> {
  const [contact] = await db.select({ optedOutAt: ccContacts.optedOutAt }).from(ccContacts).where(eq(ccContacts.phone, t.phone)).limit(1)
  const simulated = cfg.mode === 'test' && !cfg.testPhones.includes(t.phone)
  const rows = await db
    .insert(ccTasks)
    .values({
      orderId: t.orderId,
      userId: t.userId,
      kind: t.kind,
      rule: t.rule,
      dedupeKey: t.dedupeKey,
      target: t.target,
      phone: t.phone,
      script: t.script ?? null,
      message: t.message ?? null,
      context: t.context ?? null,
      maxAttempts: t.maxAttempts ?? (t.kind === 'CALL' ? cfg.maxCallAttempts : SMS_MAX_ATTEMPTS),
      runAfter: t.runAfter ?? new Date(),
      simulated,
      status: contact?.optedOutAt ? 'CANCELLED' : 'QUEUED',
      error: contact?.optedOutAt ? 'opted out' : null
    })
    .onConflictDoNothing({ target: ccTasks.dedupeKey })
    .returning({ id: ccTasks.id })
  return rows.length > 0
}

/** هاتف الولي المسجَّل للتلميذ صاحب الطلب (null إن لم يوجد أو كان هو هاتف الطلب نفسه) */
async function guardianPhoneOf(db: Db, userId: string, orderPhone: string): Promise<string | null> {
  const [s] = await db.select({ guardian: students.guardianPhone }).from(students).where(eq(students.userId, userId)).limit(1)
  const g = s?.guardian ? localPhone(s.guardian) : null
  const own = localPhone(orderPhone)
  return g && g !== own ? g : null
}

/** مكالمة توصيل: للولي أولًا، وإلا لهاتف الطلب */
async function createDeliveryCall(db: Db, cfg: CallCenterConfig, o: typeof orders.$inferSelect, rule: CcRule, script: CcScript, context: string, now: Date): Promise<boolean> {
  const orderPhone = localPhone(o.phone)
  if (!orderPhone) return false
  const guardian = await guardianPhoneOf(db, o.userId, o.phone)
  return createTask(db, cfg, { orderId: o.id, userId: o.userId, kind: 'CALL', rule, dedupeKey: `${o.id}:${rule}`, target: guardian ? 'GUARDIAN' : 'ORDER', phone: guardian ?? orderPhone, script, context, runAfter: nextCallingTime(cfg, now) })
}

/* ───────────────────────── التخطيط ───────────────────────── */

export interface PlanSummary {
  mode: CcMode
  created: number
  smsSent: number
  smsFailed: number
  simulated: number
  expired: number
  skipped: string | null
}

const DAY_MS = 24 * 60 * 60 * 1000

interface EventRow {
  id: string
  orderId: string | null
  trackingId: string | null
  receivedAt: Date
  payload: unknown
}

const ecoStatusOf = (e: EventRow) => (e.payload as { ecotrackStatus?: string } | null)?.ecotrackStatus ?? null
const officeOf = (e: EventRow): string | null => {
  const evs = (e.payload as { events?: { status?: string; location?: string | null }[] } | null)?.events ?? []
  const last = [...evs].reverse().find((x) => x.location && (x.status === 'at_agency' || x.status === 'out_for_delivery'))
  return last?.location?.trim().slice(0, 60) || null
}

/** قواعد التوصيل: «معلّقة» ⇒ مكالمة؛ «جارية» ⇒ رسالة (مكتب/منزل)، ثم مكالمة إن بقي المنزل 48 ساعة */
async function planDelivery(db: Db, cfg: CallCenterConfig, now: Date): Promise<number> {
  const since = new Date(cfg.enabledAt!)
  const open = await db
    .select()
    .from(orders)
    .where(and(eq(orders.status, 'SHIPPED'), eq(orders.deliveryProvider, 'ecotrack'), isNotNull(orders.deliveryTrackingId), gte(orders.updatedAt, new Date(since.getTime() - 60 * DAY_MS))))
    .orderBy(asc(orders.shippedAt))
    .limit(3000)
  if (!open.length) return 0
  const events = await db
    .select({ id: deliveryEvents.id, orderId: deliveryEvents.orderId, trackingId: deliveryEvents.trackingId, receivedAt: deliveryEvents.receivedAt, payload: deliveryEvents.payload })
    .from(deliveryEvents)
    .where(and(eq(deliveryEvents.provider, 'ecotrack'), inArray(deliveryEvents.orderId, open.map((o) => o.id)), gte(deliveryEvents.receivedAt, since)))
    .orderBy(asc(deliveryEvents.receivedAt))
  const byOrder = new Map<string, EventRow[]>()
  for (const e of events) if (e.orderId) byOrder.set(e.orderId, [...(byOrder.get(e.orderId) ?? []), e])
  let created = 0
  for (const o of open) {
    const evs = byOrder.get(o.id)
    if (!evs?.length) continue
    const latest = evs[evs.length - 1]!
    const rule = deliveryRuleFor(ecoStatusOf(latest))
    if (rule === 'SUSPENDED' && cfg.rules.SUSPENDED_CALL) {
      if (await createDeliveryCall(db, cfg, o, 'SUSPENDED_CALL', 'SUSPENDED', `48HR: معلّقة${latest.payload && (latest.payload as { label?: string }).label ? ` (${(latest.payload as { label?: string }).label})` : ''}`, now)) created++
      continue
    }
    if (rule !== 'ARRIVED') continue
    const phone = localPhone(o.phone)
    if (!phone) continue
    const arrivedSince = evs.find((e) => deliveryRuleFor(ecoStatusOf(e)) === 'ARRIVED')?.receivedAt ?? latest.receivedAt
    if (o.deliveryType === 'DESK') {
      if (cfg.rules.DESK_ARRIVED_SMS) {
        const office = officeOf(latest)
        const message = renderText(cfg.texts.deskArrived, { order: o.number, office: office ? ` (${office})` : '', name: o.customerName })
        if (await createTask(db, cfg, { orderId: o.id, userId: o.userId, kind: 'SMS', rule: 'DESK_ARRIVED_SMS', dedupeKey: `${o.id}:DESK_ARRIVED_SMS`, target: 'ORDER', phone, message })) created++
      }
      continue
    }
    if (cfg.rules.HOME_ARRIVED_SMS) {
      const message = renderText(cfg.texts.homeArrived, { order: o.number, name: o.customerName })
      if (await createTask(db, cfg, { orderId: o.id, userId: o.userId, kind: 'SMS', rule: 'HOME_ARRIVED_SMS', dedupeKey: `${o.id}:HOME_ARRIVED_SMS`, target: 'ORDER', phone, message })) created++
    }
    if (cfg.rules.HOME_STUCK_CALL && now.getTime() - arrivedSince.getTime() >= cfg.homeStuckHours * 3_600_000) {
      const hours = Math.floor((now.getTime() - arrivedSince.getTime()) / 3_600_000)
      if (await createDeliveryCall(db, cfg, o, 'HOME_STUCK_CALL', 'HOME_STUCK', `48HR: جارية إلى المنزل منذ ${hours} ساعة`, now)) created++
    }
  }
  return created
}

/** مكالمة التأكيد للحالات الخاصة فقط: رمز OTP يكفي لغيرها */
async function planConfirm(db: Db, cfg: CallCenterConfig, now: Date): Promise<number> {
  if (!cfg.rules.CONFIRM_SPECIAL_CALL) return 0
  const since = new Date(cfg.enabledAt!)
  const pending = await db
    .select()
    .from(orders)
    .where(and(inArray(orders.status, [...CONFIRMATION_STATUSES]), eq(orders.paymentMethod, 'COD'), gte(orders.createdAt, since)))
    .limit(500)
  if (!pending.length) return 0
  const ids = pending.map((o) => o.id)
  const done = new Set((await db.select({ orderId: ccTasks.orderId }).from(ccTasks).where(and(inArray(ccTasks.orderId, ids), eq(ccTasks.rule, 'CONFIRM_SPECIAL_CALL')))).map((r) => r.orderId))
  const todo = pending.filter((o) => !done.has(o.id))
  if (!todo.length) return 0
  const qty = new Map((await db.select({ orderId: orderItems.orderId, n: sql<number>`coalesce(sum(${orderItems.qty}), 0)::int` }).from(orderItems).where(inArray(orderItems.orderId, todo.map((o) => o.id))).groupBy(orderItems.orderId)).map((r) => [r.orderId, r.n]))
  const phones = [...new Set(todo.map((o) => localPhone(o.phone)).filter((p): p is string => Boolean(p)))]
  const blocked = new Set(phones.length ? (await db.select({ phone: codPhoneBlocks.phone }).from(codPhoneBlocks).where(inArray(codPhoneBlocks.phone, phones))).map((r) => r.phone) : [])
  const returned = new Set(phones.length ? (await db.selectDistinct({ phone: orders.phone }).from(orders).where(and(inArray(orders.phone, phones), eq(orders.status, 'RETURNED')))).map((r) => r.phone) : [])
  const profs = new Map((await db.select({ userId: profiles.userId, phone: profiles.phone, verifiedAt: profiles.phoneVerifiedAt }).from(profiles).where(inArray(profiles.userId, [...new Set(todo.map((o) => o.userId))]))).map((p) => [p.userId, p]))
  let created = 0
  for (const o of todo) {
    const phone = localPhone(o.phone)
    if (!phone) continue
    const reasons: string[] = []
    const prof = profs.get(o.userId)
    const verified = prof?.verifiedAt && prof.phone ? localPhone(prof.phone) : null
    if (cfg.confirmSpecial.phoneMismatch && verified && verified !== phone) reasons.push('هاتف الطلب غير الهاتف الموثَّق')
    if (cfg.confirmSpecial.pastReturn && (blocked.has(phone) || returned.has(phone))) reasons.push('إرجاع سابق')
    if (cfg.confirmSpecial.multiItems && (qty.get(o.id) ?? 0) > 1) reasons.push('عدّة قطع')
    if (cfg.confirmSpecial.amountDzd > 0 && o.totalDzd >= cfg.confirmSpecial.amountDzd) reasons.push(`مبلغ مرتفع (${o.totalDzd} دج)`)
    if (!reasons.length) continue
    if (await createTask(db, cfg, { orderId: o.id, userId: o.userId, kind: 'CALL', rule: 'CONFIRM_SPECIAL_CALL', dedupeKey: `${o.id}:CONFIRM_SPECIAL_CALL`, target: 'ORDER', phone, script: 'CONFIRM_SPECIAL', context: reasons.join(' + '), runAfter: nextCallingTime(cfg, now) })) created++
  }
  return created
}

/** المهمّة لم تعد في محلّها (سُلِّم الطرد، أُكِّد الطلب يدويًا…) ⇒ تُلغى قبل أن يُتّصل */
async function stillRelevant(db: Db, task: typeof ccTasks.$inferSelect): Promise<boolean> {
  if (!task.orderId) return true
  const [o] = await db.select({ status: orders.status }).from(orders).where(eq(orders.id, task.orderId)).limit(1)
  if (!o) return false
  if (task.rule === 'CONFIRM_SPECIAL_CALL') return (CONFIRMATION_STATUSES as readonly string[]).includes(o.status)
  if (task.rule === 'INBOUND_REPLY_SMS') return true
  return o.status === 'SHIPPED'
}

/** حجوزات الصندوق المنتهية (انقطع أثناء المكالمة): تُعدّ محاولة فاشلة */
async function expireLeases(db: Db, cfg: CallCenterConfig, now: Date): Promise<number> {
  const stale = await db.select({ id: ccTasks.id }).from(ccTasks).where(and(eq(ccTasks.status, 'DISPATCHED'), lt(ccTasks.leaseUntil, now))).limit(200)
  for (const t of stale) await applyResult(db, cfg, t.id, { outcome: 'FAILED', error: 'lease expired' }, now)
  return stale.length
}

/**
 * هل يقبل مزوّد الرسائل المربوط نصًا حرًا؟ SuiviSMS الحيّ لا يقبل إلا قالبًا معتمدًا بمتغيّرات قصيرة (رمز التحقق):
 * رسالة التوصيل لا تُرسل منه أبدًا، فتبقى في الطابور حتى تُختار شرائح الجهاز (لا رسالة مشوّهة للزبون).
 */
export async function smsProviderAcceptsFreeText(db: Db): Promise<{ ok: boolean; provider: string }> {
  const s = await getSmsSender(db)
  const ok = s.name !== 'suivisms' || (s as { sandbox?: boolean }).sandbox === true
  return { ok, provider: s.name }
}

/** الرسائل المستحقة: من المزوّد المربوط (أو من شرائح الصندوق إن اختير ذلك)، والمحاكاة تُختم بلا إرسال */
async function dispatchSms(db: Db, cfg: CallCenterConfig, now: Date): Promise<{ sent: number; failed: number; simulated: number }> {
  const out = { sent: 0, failed: 0, simulated: 0 }
  const sender = cfg.smsChannel === 'provider' ? await getSmsSender(db) : null
  const freeText = !sender || sender.name !== 'suivisms' || (sender as { sandbox?: boolean }).sandbox === true
  const due = await db
    .select()
    .from(ccTasks)
    .where(and(eq(ccTasks.kind, 'SMS'), eq(ccTasks.status, 'QUEUED'), lte(ccTasks.runAfter, now)))
    .orderBy(asc(ccTasks.runAfter))
    .limit(100)
  for (const t of due) {
    if (!(await stillRelevant(db, t))) {
      await db.update(ccTasks).set({ status: 'CANCELLED', error: 'no longer relevant' }).where(eq(ccTasks.id, t.id))
      continue
    }
    if (t.simulated) {
      await db.update(ccTasks).set({ status: 'DONE', outcome: 'SIMULATED' }).where(eq(ccTasks.id, t.id))
      out.simulated++
      continue
    }
    if (!withinCallingHours(cfg, now)) continue
    if (cfg.smsChannel === 'gateway' || !sender) continue // يسحبها الصندوق
    if (!freeText) {
      if (t.error !== 'provider_template_only') await db.update(ccTasks).set({ error: 'provider_template_only' }).where(eq(ccTasks.id, t.id))
      continue
    }
    const [attempt] = await db.insert(ccAttempts).values({ taskId: t.id, kind: 'SMS', phone: t.phone }).returning({ id: ccAttempts.id })
    try {
      await sender.send({ to: t.phone, text: t.message ?? '' })
      await db.update(ccTasks).set({ status: 'DONE', outcome: 'SENT', attempts: t.attempts + 1, error: null }).where(eq(ccTasks.id, t.id))
      await db.update(ccAttempts).set({ outcome: 'SENT', finishedAt: new Date() }).where(eq(ccAttempts.id, attempt!.id))
      out.sent++
    } catch (e) {
      const attempts = t.attempts + 1
      const msg = e instanceof Error ? e.message.slice(0, 300) : 'sms failed'
      await db.update(ccAttempts).set({ outcome: 'FAILED', finishedAt: new Date() }).where(eq(ccAttempts.id, attempt!.id))
      await db.update(ccTasks).set(attempts >= t.maxAttempts ? { status: 'FAILED', outcome: 'FAILED', attempts, error: msg } : { attempts, error: msg, runAfter: new Date(now.getTime() + 15 * 60_000) }).where(eq(ccTasks.id, t.id))
      out.failed++
    }
  }
  return out
}

/** مكالمات المحاكاة (وضع test، أرقام ليست للتجربة): تُختم «محاكاة» لتظهر في اللوحة بلا أي اتصال */
async function settleSimulatedCalls(db: Db, now: Date): Promise<number> {
  const rows = await db
    .update(ccTasks)
    .set({ status: 'DONE', outcome: 'SIMULATED' })
    .where(and(eq(ccTasks.kind, 'CALL'), eq(ccTasks.status, 'QUEUED'), eq(ccTasks.simulated, true), lte(ccTasks.runAfter, now)))
    .returning({ id: ccTasks.id })
  return rows.length
}

/** دورة كاملة: انتهاء الحجوزات، التخطيط، الرسائل، المحاكاة */
export async function planCallCenter(db: Db, now: Date = new Date()): Promise<PlanSummary> {
  const cfg = await getCallCenterConfig(db)
  const summary: PlanSummary = { mode: cfg.mode, created: 0, smsSent: 0, smsFailed: 0, simulated: 0, expired: 0, skipped: null }
  if (cfg.mode === 'off' || !cfg.enabledAt) {
    summary.skipped = 'off'
    return summary
  }
  summary.expired = await expireLeases(db, cfg, now)
  summary.created += await planDelivery(db, cfg, now)
  summary.created += await planConfirm(db, cfg, now)
  const sms = await dispatchSms(db, cfg, now)
  summary.smsSent = sms.sent
  summary.smsFailed = sms.failed
  summary.simulated = sms.simulated + (await settleSimulatedCalls(db, now))
  return summary
}

/** يجدول دورة إن لم تكن واحدة مجدولة/حديثة (من العامل ومن مسار Cron) */
export async function ensureCallCenterTickScheduled(db: Db, now: Date = new Date()): Promise<boolean> {
  const cfg = await getCallCenterConfig(db)
  if (cfg.mode === 'off') return false
  const [recent] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.type, 'CALLCENTER_TICK'), sql`(${jobs.status} in ('QUEUED','PROCESSING') or ${jobs.createdAt} > ${new Date(now.getTime() - CALLCENTER_TICK_MS)})`))
    .limit(1)
  if (recent) return false
  await enqueueJob(db, { type: 'CALLCENTER_TICK', payload: {}, maxAttempts: 1, runAfter: now })
  return true
}

export async function runCallCenterTickJob(db: Db): Promise<Record<string, unknown>> {
  return { ...(await planCallCenter(db)) }
}

/* ───────────────────────── واجهة الصندوق المحلي ───────────────────────── */

export interface AgentTask {
  id: string
  kind: 'SMS' | 'CALL'
  /** صيغة دولية للبوابة: +2135xxxxxxxx */
  dial: string
  phone: string
  simSlot: number
  /** مفتاح التسجيل الصوتي الذي يشغّله Asterisk (SUSPENDED.wav…) */
  script: string | null
  /** النص نفسه احتياطًا (تحويل نص إلى كلام) */
  prompt: string | null
  /** الأزرار المقبولة */
  digits: string[]
  message: string | null
  leaseUntil: string
}

const dialOf = (phone: string) => `+213${phone.slice(1)}`

/** محاولات اليوم (بتوقيت الجزائر) لكل شريحة */
async function attemptsToday(db: Db, kind: 'SMS' | 'CALL', now: Date): Promise<Map<number, number>> {
  const rows = await db
    .select({ sim: ccAttempts.simSlot, n: sql<number>`count(*)::int` })
    .from(ccAttempts)
    .where(and(eq(ccAttempts.kind, kind), isNotNull(ccAttempts.simSlot), gte(ccAttempts.createdAt, dzStartOfDay(now))))
    .groupBy(ccAttempts.simSlot)
  return new Map(rows.map((r) => [r.sim!, r.n]))
}

/** الشريحة الثابتة للرقم إن كانت صالحة ولها رصيد اليوم، وإلا أقلّ الشرائح استعمالًا (null = كل الشرائح بلغت السقف) */
async function pickSim(db: Db, cfg: CallCenterConfig, phone: string, used: Map<number, number>, cap: number): Promise<number | null> {
  const [c] = await db.select({ sim: ccContacts.simSlot }).from(ccContacts).where(eq(ccContacts.phone, phone)).limit(1)
  const healthy = cfg.outboundSims.filter((s) => cfg.agent.sims.find((x) => x.slot === s)?.ok !== false)
  const pool = healthy.length ? healthy : cfg.outboundSims
  if (c?.sim && pool.includes(c.sim)) return (used.get(c.sim) ?? 0) < cap ? c.sim : null
  const free = pool.filter((s) => (used.get(s) ?? 0) < cap).sort((a, b) => (used.get(a) ?? 0) - (used.get(b) ?? 0))
  return free[0] ?? null
}

/** الصندوق يطلب مكالمات (ورسائل إن كانت القناة gateway). خارج ساعات الاتصال: لا شيء. */
export async function claimAgentTasks(db: Db, cfg: CallCenterConfig, opts: { limit?: number; now?: Date } = {}): Promise<AgentTask[]> {
  const now = opts.now ?? new Date()
  const limit = Math.max(1, Math.min(10, opts.limit ?? 4))
  if (cfg.mode === 'off' || !withinCallingHours(cfg, now)) return []
  const kinds: ('SMS' | 'CALL')[] = cfg.smsChannel === 'gateway' ? ['CALL', 'SMS'] : ['CALL']
  const out: AgentTask[] = []
  const usedCalls = await attemptsToday(db, 'CALL', now)
  const usedSms = await attemptsToday(db, 'SMS', now)
  const candidates = await db
    .select()
    .from(ccTasks)
    .where(and(eq(ccTasks.status, 'QUEUED'), eq(ccTasks.simulated, false), inArray(ccTasks.kind, kinds), lte(ccTasks.runAfter, now)))
    .orderBy(asc(ccTasks.runAfter))
    .limit(50)
  for (const t of candidates) {
    if (out.length >= limit) break
    if (out.some((x) => x.phone === t.phone)) continue // رقم واحد مرة واحدة في الدفعة
    if (!(await stillRelevant(db, t))) {
      await db.update(ccTasks).set({ status: 'CANCELLED', error: 'no longer relevant' }).where(and(eq(ccTasks.id, t.id), eq(ccTasks.status, 'QUEUED')))
      continue
    }
    if (cfg.mode === 'test' && !cfg.testPhones.includes(t.phone)) {
      await db.update(ccTasks).set({ status: 'DONE', outcome: 'SIMULATED', simulated: true }).where(and(eq(ccTasks.id, t.id), eq(ccTasks.status, 'QUEUED')))
      continue
    }
    const used = t.kind === 'CALL' ? usedCalls : usedSms
    const sim = await pickSim(db, cfg, t.phone, used, t.kind === 'CALL' ? cfg.dailyCapPerSim : cfg.dailyCapPerSim * 4)
    if (sim === null) continue // السقف: ينتظر الغد
    const leaseUntil = new Date(now.getTime() + AGENT_LEASE_MS)
    // الحجز الذرّي: لا يأخذ صندوقان المهمة نفسها
    const [claimed] = await db
      .update(ccTasks)
      .set({ status: 'DISPATCHED', simSlot: sim, dispatchedAt: now, leaseUntil, attempts: sql`${ccTasks.attempts} + 1` })
      .where(and(eq(ccTasks.id, t.id), eq(ccTasks.status, 'QUEUED')))
      .returning()
    if (!claimed) continue
    used.set(sim, (used.get(sim) ?? 0) + 1)
    await db.insert(ccAttempts).values({ taskId: t.id, kind: t.kind as 'SMS' | 'CALL', simSlot: sim, phone: t.phone, createdAt: now })
    await db
      .insert(ccContacts)
      .values({ phone: t.phone, simSlot: sim, lastContactAt: now })
      .onConflictDoUpdate({ target: ccContacts.phone, set: { simSlot: sim, lastContactAt: now, updatedAt: now } })
    const def = t.script ? (SCRIPTS as Record<string, { text: string; options: Record<string, string> }>)[t.script] : undefined
    out.push({ id: t.id, kind: t.kind as 'SMS' | 'CALL', dial: dialOf(t.phone), phone: t.phone, simSlot: sim, script: t.script, prompt: def?.text ?? null, digits: def ? Object.keys(def.options) : [], message: t.message, leaseUntil: leaseUntil.toISOString() })
  }
  return out
}

export interface AgentResult {
  outcome: Exclude<CcOutcome, 'SIMULATED'>
  digit?: string | null
  durationSec?: number | null
  error?: string | null
}

/** نتيجة مكالمة أو رسالة من الصندوق (أو من المحاكي) */
export async function reportAgentResult(db: Db, cfg: CallCenterConfig, taskId: string, result: AgentResult, now: Date = new Date()): Promise<{ status: string; action: string | null }> {
  assertUuid(taskId, 'NOT_FOUND')
  return applyResult(db, cfg, taskId, result, now)
}

async function applyResult(db: Db, cfg: CallCenterConfig, taskId: string, result: AgentResult, now: Date): Promise<{ status: string; action: string | null }> {
  const [t] = await db.select().from(ccTasks).where(eq(ccTasks.id, taskId)).limit(1)
  if (!t) throw new AppError('NOT_FOUND')
  // نتيجة مكرّرة أو متأخرة: لا تُطبَّق مرتين
  if (t.status !== 'DISPATCHED') return { status: t.status, action: t.resultAction }
  const digit = result.digit ? String(result.digit).trim().slice(0, 4) : null
  const duration = result.durationSec != null && Number.isFinite(result.durationSec) ? Math.max(0, Math.min(3600, Math.round(result.durationSec))) : null
  const [att] = await db.select({ id: ccAttempts.id }).from(ccAttempts).where(and(eq(ccAttempts.taskId, t.id), isNull(ccAttempts.finishedAt))).orderBy(desc(ccAttempts.createdAt)).limit(1)
  if (att) await db.update(ccAttempts).set({ outcome: result.outcome, digit, durationSec: duration, finishedAt: now }).where(eq(ccAttempts.id, att.id))
  const base = { outcome: result.outcome, digit, durationSec: duration, leaseUntil: null, error: result.error?.slice(0, 300) ?? null }

  if (t.kind === 'SMS') {
    if (result.outcome === 'SENT') {
      await db.update(ccTasks).set({ ...base, status: 'DONE' }).where(eq(ccTasks.id, t.id))
      return { status: 'DONE', action: null }
    }
    const done = t.attempts >= t.maxAttempts
    await db.update(ccTasks).set({ ...base, status: done ? 'FAILED' : 'QUEUED', runAfter: new Date(now.getTime() + 15 * 60_000) }).where(eq(ccTasks.id, t.id))
    return { status: done ? 'FAILED' : 'QUEUED', action: null }
  }

  if (result.outcome === 'ANSWERED') {
    const action = actionFor(t.script, digit)
    if (action === 'CONFIRM') {
      let confirmed = false
      if (t.orderId) {
        const [o] = await db.select({ status: orders.status }).from(orders).where(eq(orders.id, t.orderId)).limit(1)
        if (o && (CONFIRMATION_STATUSES as readonly string[]).includes(o.status)) {
          await transitionOrder(db, t.orderId, 'CONFIRMED', { actorUserId: null, source: 'call' })
          confirmed = true
        }
      }
      await db.update(ccTasks).set({ ...base, status: 'DONE', resultAction: 'CONFIRM', needsHuman: false, humanReason: confirmed ? null : 'ضغط «تأكيد» لكن حالة الطلب تغيّرت قبلها' }).where(eq(ccTasks.id, t.id))
      return { status: 'DONE', action: 'CONFIRM' }
    }
    const reason = action ? ACTION_AR[action] : digit ? `ضغط زرًا غير معروف (${digit}) — اتصل به` : 'ردّ ولم يختر شيئًا — اتصل به'
    await db.update(ccTasks).set({ ...base, status: 'DONE', resultAction: action ?? 'NO_CHOICE', needsHuman: true, humanReason: reason }).where(eq(ccTasks.id, t.id))
    return { status: 'DONE', action: action ?? 'NO_CHOICE' }
  }

  // لم يردّ / مشغول / رفض / فشل
  if (t.attempts < t.maxAttempts) {
    await db.update(ccTasks).set({ ...base, status: 'QUEUED', runAfter: retryAt(cfg, t.attempts, now) }).where(eq(ccTasks.id, t.id))
    return { status: 'QUEUED', action: null }
  }
  // استُنفدت محاولات الولي ⇒ التلميذ (هاتف الطلب) مرة أخيرة؛ وإلا الموظف
  if (t.target === 'GUARDIAN' && t.orderId) {
    const [o] = await db.select({ phone: orders.phone, userId: orders.userId }).from(orders).where(eq(orders.id, t.orderId)).limit(1)
    const studentPhone = o ? localPhone(o.phone) : null
    if (studentPhone && studentPhone !== t.phone) {
      await db.update(ccTasks).set({ ...base, status: 'FAILED' }).where(eq(ccTasks.id, t.id))
      await createTask(db, cfg, { orderId: t.orderId, userId: o!.userId, kind: 'CALL', rule: t.rule as CcRule, dedupeKey: `${t.dedupeKey}:STUDENT`, target: 'STUDENT', phone: studentPhone, script: t.script as CcScript | null, context: `${t.context ?? ''}${t.context ? ' · ' : ''}الولي لم يردّ`, runAfter: retryAt(cfg, 1, now) })
      return { status: 'FAILED', action: 'FALLBACK_STUDENT' }
    }
  }
  await db.update(ccTasks).set({ ...base, status: 'FAILED', needsHuman: true, humanReason: `لم يردّ بعد ${t.attempts} محاولات — اتصل به أو راسله` }).where(eq(ccTasks.id, t.id))
  return { status: 'FAILED', action: 'HUMAN' }
}

export interface InboundInput {
  phone: string
  simSlot?: number | null
  choice?: string | null
  durationSec?: number | null
  recording?: { bytes: Buffer; mime: string } | null
}

const AUDIO_EXT: Record<string, string> = { 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/ogg': 'ogg', 'audio/gsm': 'gsm', 'audio/webm': 'webm' }

/** مكالمة واردة من القائمة الصوتية: اختيار المتصل ورسالته بعد الصفارة. تُطابَق بآخر طلب وبحساب الرقم. */
export async function recordInbound(db: Db, cfg: CallCenterConfig, input: InboundInput, now: Date = new Date()): Promise<{ id: string; replySms: boolean }> {
  const phone = localPhone(input.phone)
  if (!phone) throw new AppError('VALIDATION', { field: 'phone' })
  const choice = input.choice && /^[0-9]$/.test(String(input.choice).trim()) ? String(input.choice).trim() : null
  let recordingKey: string | null = null
  let recordingMime: string | null = null
  if (input.recording?.bytes.length) {
    const mime = input.recording.mime.toLowerCase().split(';')[0]!.trim()
    if (!AUDIO_EXT[mime]) throw new AppError('FILE_TYPE_NOT_ALLOWED')
    if (input.recording.bytes.length > MAX_RECORDING_BYTES) throw new AppError('FILE_TOO_LARGE')
    recordingKey = `callcenter/${newStorageKey(null, AUDIO_EXT[mime]!)}`
    recordingMime = mime
    await storage().put(recordingKey, input.recording.bytes)
  }
  const [order] = await db.select({ id: orders.id, userId: orders.userId }).from(orders).where(eq(orders.phone, phone)).orderBy(desc(orders.createdAt)).limit(1)
  const [prof] = order ? [] : await db.select({ userId: profiles.userId }).from(profiles).where(eq(profiles.phone, phone)).limit(1)
  const [row] = await db
    .insert(ccInbound)
    .values({ phone, simSlot: input.simSlot ?? null, choice, durationSec: input.durationSec != null ? Math.max(0, Math.min(3600, Math.round(input.durationSec))) : null, recordingKey, recordingMime, recordingBytes: input.recording?.bytes.length ?? null, orderId: order?.id ?? null, userId: order?.userId ?? prof?.userId ?? null, createdAt: now })
    .returning({ id: ccInbound.id })
  let replySms = false
  const reply = choice ? cfg.texts.inboundReply[choice] : undefined
  if (reply && cfg.rules.INBOUND_REPLY_SMS && cfg.mode !== 'off') {
    replySms = await createTask(db, cfg, { orderId: order?.id ?? null, userId: order?.userId ?? prof?.userId ?? null, kind: 'SMS', rule: 'INBOUND_REPLY_SMS', dedupeKey: `${row!.id}:INBOUND_REPLY_SMS`, target: 'CALLER', phone, message: reply })
  }
  return { id: row!.id, replySms }
}

/* ───────────────────────── المحاكي (المرحلة 0: بلا جهاز) ───────────────────────── */

export interface SimulateOptions {
  /** نسبة من يردّ (0..1) */
  answerRate?: number
  /** الزر الذي يضغطه من يردّ (افتراضيًا الخيار الأول) */
  digit?: string | null
  now?: Date
  random?: () => number
}

/** يلعب دور الصندوق: يسحب المهامّ ويعيد نتائج مزيّفة. لا اتصال ولا رسالة حقيقية أبدًا. */
export async function simulateAgentRound(db: Db, opts: SimulateOptions = {}): Promise<{ claimed: number; answered: number; noAnswer: number }> {
  const cfg = await getCallCenterConfig(db)
  const now = opts.now ?? new Date()
  const rnd = opts.random ?? Math.random
  const tasks = await claimAgentTasks(db, cfg, { limit: 10, now })
  let answered = 0
  let noAnswer = 0
  for (const t of tasks) {
    if (t.kind === 'SMS') {
      await reportAgentResult(db, cfg, t.id, { outcome: 'SENT' }, now)
      continue
    }
    if (rnd() < (opts.answerRate ?? 0.7)) {
      await reportAgentResult(db, cfg, t.id, { outcome: 'ANSWERED', digit: opts.digit === undefined ? (t.digits[0] ?? null) : opts.digit, durationSec: 25 }, now)
      answered++
    } else {
      await reportAgentResult(db, cfg, t.id, { outcome: 'NO_ANSWER', durationSec: 0 }, now)
      noAnswer++
    }
  }
  return { claimed: tasks.length, answered, noAnswer }
}

/** زر «محاكاة دورة» في اللوحة: تخطيط ثم صندوق مزيّف (المشرف وحده) */
export async function simulateFromDashboard(db: Db, actor: Actor): Promise<{ plan: PlanSummary; agent: { claimed: number; answered: number; noAnswer: number } }> {
  assertRole(actor, 'SUPER_ADMIN')
  const cfg = await getCallCenterConfig(db)
  if (cfg.mode !== 'test') throw new AppError('VALIDATION', { field: 'mode' })
  if (cfg.agent.lastSeenAt && Date.now() - new Date(cfg.agent.lastSeenAt).getTime() < 10 * 60_000) throw new AppError('VALIDATION', { field: 'agent' }) // صندوق حقيقي متصل: لا محاكاة فوقه
  const plan = await planCallCenter(db)
  const agent = await simulateAgentRound(db, { now: nextCallingTime(cfg, new Date()) })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'callcenter.simulated', entityType: 'settings', entityId: null, newValue: { ...agent, created: plan.created } })
  return { plan, agent }
}

/* ───────────────────────── لوحة الموظف ───────────────────────── */

const STAFF = ['SUPER_ADMIN', 'CONFIRMER'] as const

export interface CallCenterOverview {
  mode: CcMode
  agentLastSeenAt: string | null
  agentOnline: boolean
  queuedCalls: number
  queuedSms: number
  needsHuman: number
  inboundNew: number
  today: { calls: number; answered: number; sms: number; perSim: { slot: number; calls: number; cap: number }[] }
}

export async function callCenterOverview(db: Db, actor: Actor, now: Date = new Date()): Promise<CallCenterOverview> {
  assertRole(actor, ...STAFF)
  const cfg = await getCallCenterConfig(db)
  const count = async (where: ReturnType<typeof and>) => (await db.select({ n: sql<number>`count(*)::int` }).from(ccTasks).where(where))[0]?.n ?? 0
  const [queuedCalls, queuedSms, needsHuman] = await Promise.all([
    count(and(eq(ccTasks.kind, 'CALL'), inArray(ccTasks.status, ['QUEUED', 'DISPATCHED']), eq(ccTasks.simulated, false))),
    count(and(eq(ccTasks.kind, 'SMS'), eq(ccTasks.status, 'QUEUED'), eq(ccTasks.simulated, false))),
    count(and(eq(ccTasks.needsHuman, true), isNull(ccTasks.handledAt)))
  ])
  const [inb] = await db.select({ n: sql<number>`count(*)::int` }).from(ccInbound).where(eq(ccInbound.status, 'NEW'))
  const start = dzStartOfDay(now)
  const att = await db
    .select({ kind: ccAttempts.kind, sim: ccAttempts.simSlot, outcome: ccAttempts.outcome })
    .from(ccAttempts)
    .where(gte(ccAttempts.createdAt, start))
  const calls = att.filter((a) => a.kind === 'CALL')
  const perSim = cfg.outboundSims.map((slot) => ({ slot, calls: calls.filter((a) => a.sim === slot).length, cap: cfg.dailyCapPerSim }))
  const seen = cfg.agent.lastSeenAt ? new Date(cfg.agent.lastSeenAt).getTime() : 0
  return {
    mode: cfg.mode,
    agentLastSeenAt: cfg.agent.lastSeenAt,
    agentOnline: now.getTime() - seen < 5 * 60_000,
    queuedCalls,
    queuedSms,
    needsHuman,
    inboundNew: inb?.n ?? 0,
    today: { calls: calls.length, answered: calls.filter((a) => a.outcome === 'ANSWERED').length, sms: att.filter((a) => a.kind === 'SMS').length, perSim }
  }
}

export interface HumanTaskRow {
  id: string
  rule: string
  kind: string
  phone: string
  target: string
  humanReason: string | null
  context: string | null
  resultAction: string | null
  digit: string | null
  attempts: number
  updatedAt: Date
  orderId: string | null
  orderNumber: string | null
  customerName: string | null
  orderStatus: string | null
  deliveryType: string | null
  trackingId: string | null
}

const taskCols = {
  id: ccTasks.id,
  rule: ccTasks.rule,
  kind: ccTasks.kind,
  phone: ccTasks.phone,
  target: ccTasks.target,
  humanReason: ccTasks.humanReason,
  context: ccTasks.context,
  resultAction: ccTasks.resultAction,
  digit: ccTasks.digit,
  attempts: ccTasks.attempts,
  updatedAt: ccTasks.updatedAt,
  orderId: ccTasks.orderId,
  orderNumber: orders.number,
  customerName: orders.customerName,
  orderStatus: orders.status,
  deliveryType: orders.deliveryType,
  trackingId: orders.deliveryTrackingId
}

/** ما ينتظر الموظف: الأقدم أولًا */
export async function listHumanQueue(db: Db, actor: Actor, limit = 100): Promise<HumanTaskRow[]> {
  assertRole(actor, ...STAFF)
  return db
    .select(taskCols)
    .from(ccTasks)
    .leftJoin(orders, eq(orders.id, ccTasks.orderId))
    .where(and(eq(ccTasks.needsHuman, true), isNull(ccTasks.handledAt)))
    .orderBy(asc(ccTasks.updatedAt))
    .limit(Math.max(1, Math.min(300, limit)))
}

export interface TaskRow extends HumanTaskRow {
  status: string
  outcome: string | null
  simulated: boolean
  simSlot: number | null
  runAfter: Date
  createdAt: Date
}

export async function listRecentTasks(db: Db, actor: Actor, limit = 60): Promise<TaskRow[]> {
  assertRole(actor, ...STAFF)
  return db
    .select({ ...taskCols, status: ccTasks.status, outcome: ccTasks.outcome, simulated: ccTasks.simulated, simSlot: ccTasks.simSlot, runAfter: ccTasks.runAfter, createdAt: ccTasks.createdAt })
    .from(ccTasks)
    .leftJoin(orders, eq(orders.id, ccTasks.orderId))
    .orderBy(desc(ccTasks.updatedAt))
    .limit(Math.max(1, Math.min(300, limit)))
}

export interface InboundRow {
  id: string
  phone: string
  simSlot: number | null
  choice: string | null
  durationSec: number | null
  hasRecording: boolean
  createdAt: Date
  status: string
  orderId: string | null
  orderNumber: string | null
  orderStatus: string | null
  customerName: string | null
  handledNote: string | null
}

export async function listInbound(db: Db, actor: Actor, status: 'NEW' | 'DONE' = 'NEW', limit = 100): Promise<InboundRow[]> {
  assertRole(actor, ...STAFF)
  const rows = await db
    .select({ id: ccInbound.id, phone: ccInbound.phone, simSlot: ccInbound.simSlot, choice: ccInbound.choice, durationSec: ccInbound.durationSec, recordingKey: ccInbound.recordingKey, createdAt: ccInbound.createdAt, status: ccInbound.status, orderId: ccInbound.orderId, orderNumber: orders.number, orderStatus: orders.status, customerName: orders.customerName, handledNote: ccInbound.handledNote })
    .from(ccInbound)
    .leftJoin(orders, eq(orders.id, ccInbound.orderId))
    .where(eq(ccInbound.status, status))
    .orderBy(status === 'NEW' ? asc(ccInbound.createdAt) : desc(ccInbound.handledAt))
    .limit(Math.max(1, Math.min(300, limit)))
  return rows.map(({ recordingKey, ...r }) => ({ ...r, hasRecording: Boolean(recordingKey) }))
}

export async function resolveHumanTask(db: Db, actor: Actor, taskId: string, note: string | null): Promise<void> {
  assertRole(actor, ...STAFF)
  assertUuid(taskId, 'NOT_FOUND')
  const [t] = await db
    .update(ccTasks)
    .set({ handledAt: new Date(), handledByUserId: actor.userId, handledNote: note?.trim().slice(0, 500) || null })
    .where(and(eq(ccTasks.id, taskId), eq(ccTasks.needsHuman, true), isNull(ccTasks.handledAt)))
    .returning({ id: ccTasks.id, orderId: ccTasks.orderId })
  if (!t) throw new AppError('NOT_FOUND')
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'callcenter.task_handled', entityType: 'order', entityId: t.orderId, newValue: { taskId, note: note?.slice(0, 200) ?? null } })
}

/** «اتصل الآن» من اللوحة: مهمة مكالمة فاشلة أو منتظرة تعود إلى الطابور فورًا (محاولة إضافية واحدة) */
export async function retryTaskNow(db: Db, actor: Actor, taskId: string): Promise<void> {
  assertRole(actor, ...STAFF)
  assertUuid(taskId, 'NOT_FOUND')
  const [t] = await db.select().from(ccTasks).where(eq(ccTasks.id, taskId)).limit(1)
  if (!t || t.kind !== 'CALL' || t.simulated || !['QUEUED', 'FAILED'].includes(t.status)) throw new AppError('NOT_FOUND')
  await db
    .update(ccTasks)
    .set({ status: 'QUEUED', runAfter: new Date(), maxAttempts: Math.max(t.maxAttempts, t.attempts + 1), needsHuman: false, humanReason: null })
    .where(eq(ccTasks.id, taskId))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'callcenter.task_retry', entityType: 'order', entityId: t.orderId, newValue: { taskId } })
}

export async function resolveInbound(db: Db, actor: Actor, id: string, note: string | null): Promise<void> {
  assertRole(actor, ...STAFF)
  assertUuid(id, 'NOT_FOUND')
  const [r] = await db
    .update(ccInbound)
    .set({ status: 'DONE', handledAt: new Date(), handledByUserId: actor.userId, handledNote: note?.trim().slice(0, 500) || null })
    .where(and(eq(ccInbound.id, id), eq(ccInbound.status, 'NEW')))
    .returning({ id: ccInbound.id })
  if (!r) throw new AppError('NOT_FOUND')
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'callcenter.inbound_handled', entityType: 'callcenter', entityId: id, newValue: { note: note?.slice(0, 200) ?? null } })
}

/** تسجيل صوتي لمكالمة واردة (للموظف وحده) */
export async function readRecording(db: Db, actor: Actor, id: string): Promise<{ bytes: Buffer; mime: string }> {
  assertRole(actor, ...STAFF)
  assertUuid(id, 'NOT_FOUND')
  const [r] = await db.select({ key: ccInbound.recordingKey, mime: ccInbound.recordingMime }).from(ccInbound).where(eq(ccInbound.id, id)).limit(1)
  if (!r?.key) throw new AppError('NOT_FOUND')
  return { bytes: await storage().get(r.key), mime: r.mime ?? 'audio/wav' }
}

/** للاختبارات والإعداد الأول */
export async function _setCallCenterConfigForTests(db: Db, patch: Partial<CallCenterConfig>): Promise<CallCenterConfig> {
  const cfg = readCallCenterConfig({ ...DEFAULT_CALL_CENTER, ...(await getCallCenterConfig(db)), ...patch })
  await writeConfig(db, cfg)
  return cfg
}

