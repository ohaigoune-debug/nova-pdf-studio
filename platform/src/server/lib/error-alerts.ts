/**
 * تنبيه المشرف حين يبدأ الموقع بالتعطّل: أخطاء الخادم غير المتوقعة (القاعدة متوقفة، خلل في صفحة…)
 * تُلتقط من `onRequestError` في src/instrumentation.ts وتُعدّ هنا.
 *
 * - التنبيه عند التكرار لا عند كل خطأ: رسالة تيليغرام واحدة حين تبلغ الأخطاء العتبة في نافذة قصيرة
 *   (الافتراضي 5 خلال دقيقتين)، ثم صمت مدة التهدئة (15 دقيقة)، والرسالة التالية تذكر عدد ما لم يُنبَّه عنه.
 * - التطبيق عدة عمليات (WEB_CONCURRENCY): العدّاد والتهدئة في جدول rate_limits (بلا جدول جديد) فلا تتكرر الرسالة.
 * - إن كانت القاعدة نفسها هي المتوقفة فالعدّاد يفشل معها: نعدّ عندئذ في ذاكرة العملية ونرسل ببيانات تيليغرام
 *   المحفوظة في الذاكرة (قد تصل رسالة من كل عملية في هذه الحالة وحدها).
 * - لا شيء هنا يرمي أو يؤخّر الطلب، ولا يُسجَّل أي كوكي أو ترويسة أو جسم طلب أو نص استعلام.
 */
import { and, desc, eq, gt, like, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { rateLimits } from '@/server/db/schema'
import { isAppError } from './errors'
import { loadTelegramCredentials, sendTelegramWith, type TelegramCredentials } from './telegram'

const WINDOW_KEY = 'error-alert:window'
const COOLDOWN_KEY = 'error-alert:cooldown'
const SUPPRESSED_KEY = 'error-alert:suppressed'
const ROUTE_PREFIX = 'error-alert:route:'

/** مهلة عمليات القاعدة والإرسال: مسار التنبيه لا ينتظر طويلاً */
const DB_TIMEOUT_MS = 3_000
const SEND_TIMEOUT_MS = 5_000
/** بعد فشل القاعدة لا نعيد المحاولة معها مدة قصيرة (لا نزيد الضغط على قاعدة متعثرة) */
const DB_RETRY_AFTER_MS = 30_000
/** إن فشل الإرسال نعيد المحاولة بعد دقيقة بدل انتظار التهدئة كاملة */
const SEND_RETRY_AFTER_MS = 60_000
const CREDENTIALS_REFRESH_MS = 10 * 60_000
const MAX_IN_FLIGHT = 20

export interface ErrorAlertConfig {
  /** 0 يعطّل التنبيه */
  threshold: number
  windowSeconds: number
  cooldownSeconds: number
}

function intEnv(name: string, fallback: number, min: number): number {
  const raw = process.env[name]
  if (raw == null || raw.trim() === '') return fallback
  const n = Number(raw)
  return Number.isInteger(n) && n >= min ? n : fallback
}

export function errorAlertConfig(): ErrorAlertConfig {
  return {
    threshold: intEnv('ERROR_ALERT_THRESHOLD', 5, 0),
    windowSeconds: intEnv('ERROR_ALERT_WINDOW_SECONDS', 120, 10),
    cooldownSeconds: intEnv('ERROR_ALERT_COOLDOWN_MINUTES', 15, 1) * 60
  }
}

/** ما يُسجَّل عن الخطأ — لا شيء غير هذه الحقول */
export interface ServerErrorEvent {
  at: string
  /** نمط المسار (مثل ‎/courses/[id]‎) */
  route: string
  /** المسار الفعلي بلا نص الاستعلام */
  path: string
  method: string
  kind: string
  digest: string | null
  name: string
  message: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** أقصى ما يُفحص من الرسالة (الناتج 160 حرفاً على الأكثر) */
const SCRUB_INPUT_MAX = 1000

/** يحذف ما قد يكون بياناً شخصياً أو سرّاً من نص حرّ، ثم يقصّه */
export function scrubText(input: unknown, max = 160): string {
  let s = typeof input === 'string' ? input : ''
  // Drizzle يُلحق قيم الاستعلام بالرسالة («params: …») وقد تحوي هواتف وعناوين بريد
  const p = s.search(/\bparams\s*:/i)
  if (p >= 0) s = s.slice(0, p)
  // سقف قبل التعابير النمطية: كلفتها تربيعية على نص طويل بلا فراغات، وهذه الدالة تُستدعى داخل الطلب (toAppError)
  if (s.length > SCRUB_INPUT_MAX) s = s.slice(0, SCRUB_INPUT_MAX)
  s = s
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, '[url]')
    .replace(/[^\s@/:]+@[^\s@/]+\.[^\s@/]+/g, '[email]')
    .replace(/\+?\d[\d\s().-]{6,}\d/g, '[number]')
    .replace(/[A-Za-z0-9_\-+/=.]{24,}/g, (m) => (UUID_RE.test(m) ? m : '[redacted]'))
    .replace(/\s{2,}/g, ' ')
    .trim()
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

/** المسار بلا استعلام ولا مقاطع طويلة (رموز استرجاع، توقيعات) */
export function safePath(raw: unknown): string {
  let s = typeof raw === 'string' ? raw : ''
  // قد يصل عنواناً كاملاً: نأخذ المسار فقط
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, '')
  s = s.split(/[?#]/, 1)[0] ?? ''
  const cleaned = s
    .split('/')
    .map((seg) => {
      let d = seg
      try {
        d = decodeURIComponent(seg)
      } catch {
        /* يبقى كما هو */
      }
      if (UUID_RE.test(d)) return d
      if (d.length >= 20 || d.includes('@') || /\d{7,}/.test(d)) return '…'
      return seg
    })
    .join('/')
  return (cleaned || '/').slice(0, 200)
}

function errorField(error: unknown, key: string): unknown {
  return typeof error === 'object' && error !== null ? (error as Record<string, unknown>)[key] : undefined
}

/**
 * هل هذا عطل حقيقي؟ لا تُعدّ: 404 وإعادة التوجيه (إشارات Next الداخلية)، أخطاء التطبيق المتوقعة (AppError:
 * تحقق، حدّ محاولات، غير مصرّح… — إلا INTERNAL)، الطلبات التي قطعها الزائر، وطلبات نسخة قديمة بعد النشر.
 */
export function isCountableError(error: unknown): boolean {
  const digest = errorField(error, 'digest')
  if (typeof digest === 'string' && /^(NEXT_|DYNAMIC_SERVER_USAGE|BAILOUT_TO_CLIENT_SIDE_RENDERING)/.test(digest)) return false
  if (isAppError(error)) return errorField(error, 'code') === 'INTERNAL'
  const name = errorField(error, 'name')
  if (name === 'AbortError' || name === 'ResponseAborted' || name === 'ZodError') return false
  const message = errorField(error, 'message')
  // متصفح ما زال يحمل نسخة ما قبل النشر: يحدث بعد كل نشر وليس عطلاً
  if (typeof message === 'string' && message.startsWith('Failed to find Server Action')) return false
  return true
}

export function describeRequestError(
  error: unknown,
  request: { path?: unknown; method?: unknown } | null | undefined,
  context: { routePath?: unknown; routeType?: unknown } | null | undefined,
  now: Date = new Date()
): ServerErrorEvent {
  const path = safePath(request?.path)
  const routeRaw = typeof context?.routePath === 'string' && context.routePath ? context.routePath : path
  const digest = errorField(error, 'digest')
  const name = errorField(error, 'name')
  return {
    at: now.toISOString(),
    route: safePath(routeRaw),
    path,
    method: (typeof request?.method === 'string' ? request.method : '').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 10) || '?',
    kind: typeof context?.routeType === 'string' ? context.routeType.slice(0, 20) : '?',
    digest: typeof digest === 'string' || typeof digest === 'number' ? String(digest).replace(/[^\w.:-]/g, '').slice(0, 64) || null : null,
    name: scrubText(typeof name === 'string' ? name : 'Error', 60) || 'Error',
    message: scrubText(typeof error === 'string' ? error : errorField(error, 'message'))
  }
}

// ── نص الرسالة ────────────────────────────────────────────────────────────

const minutesOf = (seconds: number) => Math.max(1, Math.round(seconds / 60))

export interface AlertSummary {
  count: number
  windowSeconds: number
  topRoute: string | null
  topRouteCount: number | null
  suppressed: number
  last: ServerErrorEvent
  /** true: العدّ من ذاكرة العملية لأن القاعدة لا تستجيب */
  databaseDown: boolean
}

export function buildAlertText(s: AlertSummary): string {
  const lines = [
    s.databaseDown ? '🔴 مدرسة: قاعدة البيانات لا تستجيب (متوقفة أو مشغولة جداً)' : '🔴 مدرسة: أخطاء متكررة في الخادم',
    `عدد الأخطاء: ${s.count} خلال ${minutesOf(s.windowSeconds)} د${s.databaseDown ? ' (في عملية واحدة من الخادم)' : ''}`,
    s.topRoute ? `الأكثر تعطلاً: ${s.topRoute}${s.topRouteCount ? ` (${s.topRouteCount})` : ''}` : null,
    `آخر خطأ: ${s.last.method === '?' ? '' : `${s.last.method} `}${s.last.route} — ${s.last.name}${s.last.message ? `: ${s.last.message}` : ''}`,
    s.last.digest ? `رمز الخطأ (digest): ${s.last.digest}` : null,
    s.suppressed > 0 ? `منذ التنبيه السابق: ${s.suppressed} خطأ آخر لم يُنبَّه عنه.` : null,
    s.databaseDown ? 'أين تنظر: docker compose ps ثم docker compose logs --tail 100 app' : 'أين تنظر: docker compose logs --tail 100 app'
  ]
  return lines.filter(Boolean).join('\n')
}

// ── الإرسال ───────────────────────────────────────────────────────────────

/** يُرجع true إن أُرسلت الرسالة. `db` يكون null حين القاعدة لا تستجيب. */
export type ErrorAlertSender = (text: string, db: Db | null) => Promise<boolean>

let senderOverride: ErrorAlertSender | null = null
let credentials: TelegramCredentials | null = null
let credentialsAt = 0

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label}: timeout`)), ms)
    t.unref?.()
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e instanceof Error ? e : new Error(String(e)))
      }
    )
  })
}

async function refreshCredentials(db: Db, timeoutMs: number): Promise<void> {
  credentials = await withTimeout(loadTelegramCredentials(db), timeoutMs, 'telegram-config')
  credentialsAt = Date.now()
}

/** يستعمل بوت تيليغرام المضبوط من لوحة الإدارة؛ يحدّث البيانات من القاعدة إن أمكن وإلا فالمحفوظ في الذاكرة */
const telegramSender: ErrorAlertSender = async (text, db) => {
  if (db) {
    try {
      await refreshCredentials(db, DB_TIMEOUT_MS)
    } catch {
      /* نرسل بالمحفوظ */
    }
  }
  if (!credentials) return false
  return sendTelegramWith(credentials, text, { timeoutMs: SEND_TIMEOUT_MS })
}

/** للاختبارات فقط */
export function setErrorAlertSenderForTests(s: ErrorAlertSender | null) {
  senderOverride = s
}

// ── العدّ في ذاكرة العملية (حين القاعدة لا تستجيب) ──────────────────────────

interface MemoryState {
  windowStart: number
  count: number
  routes: Map<string, number>
  lastAlertAt: number
  suppressed: number
  dbDownUntil: number
  inFlight: number
}

const fresh = (): MemoryState => ({ windowStart: 0, count: 0, routes: new Map(), lastAlertAt: 0, suppressed: 0, dbDownUntil: 0, inFlight: 0 })
let mem = fresh()

/** للاختبارات فقط: يمحو حالة العملية (يحاكي عملية جديدة) */
export function resetErrorAlertStateForTests() {
  mem = fresh()
  credentials = null
  credentialsAt = 0
}

export type RecordOutcome = 'disabled' | 'counted' | 'sent' | 'suppressed' | 'send-failed' | 'dropped'

export interface RecordDeps {
  getDb: () => Promise<Db>
  now?: Date
  config?: ErrorAlertConfig
  dbTimeoutMs?: number
  log?: (line: string) => void
}

const defaultLog = (line: string) => {
  if (process.env.NODE_ENV !== 'test') console.error(line)
}

async function send(text: string, db: Db | null): Promise<boolean> {
  const s = senderOverride ?? telegramSender
  return (await withTimeout(s(text, db), SEND_TIMEOUT_MS + DB_TIMEOUT_MS + 1_000, 'error-alert-send')) === true
}

async function recordInMemory(event: ServerErrorEvent, cfg: ErrorAlertConfig, now: number, log: (l: string) => void): Promise<RecordOutcome> {
  const windowMs = cfg.windowSeconds * 1000
  if (now - mem.windowStart >= windowMs) {
    mem.windowStart = now
    mem.count = 0
    mem.routes.clear()
  }
  mem.count += 1
  if (mem.routes.size < 200 || mem.routes.has(event.route)) mem.routes.set(event.route, (mem.routes.get(event.route) ?? 0) + 1)
  if (mem.count < cfg.threshold) return 'counted'
  if (mem.lastAlertAt && now - mem.lastAlertAt < cfg.cooldownSeconds * 1000) {
    mem.suppressed += mem.count === cfg.threshold ? cfg.threshold : 1
    return 'suppressed'
  }
  // الحجز قبل الإرسال: خطأ آخر في العملية نفسها لا يرسل ثانية أثناء الانتظار
  const suppressed = mem.suppressed
  mem.lastAlertAt = now
  mem.suppressed = 0
  let top: [string, number] | null = null
  for (const e of mem.routes) if (!top || e[1] > top[1]) top = e
  const text = buildAlertText({ count: mem.count, windowSeconds: cfg.windowSeconds, topRoute: top?.[0] ?? null, topRouteCount: top?.[1] ?? null, suppressed, last: event, databaseDown: true })
  let ok = false
  try {
    ok = await send(text, null)
  } catch (e) {
    log(`[error-alert] تعذّر إرسال التنبيه: ${scrubText(e instanceof Error ? e.message : String(e))}`)
  }
  if (ok) return 'sent'
  // لم تصل: نعيد المحاولة بعد دقيقة
  mem.lastAlertAt = now - cfg.cooldownSeconds * 1000 + SEND_RETRY_AFTER_MS
  mem.suppressed += suppressed
  return 'send-failed'
}

async function recordInDatabase(db: Db, event: ServerErrorEvent, cfg: ErrorAlertConfig, now: Date, log: (l: string) => void): Promise<RecordOutcome> {
  const windowCutoff = new Date(now.getTime() - cfg.windowSeconds * 1000)
  const routeKey = (ROUTE_PREFIX + event.route).slice(0, 200)
  // عبارة واحدة تزيد عدّاد النافذة وعدّاد المسار: النافذة تبدأ عند أول خطأ وتُعاد بعد انقضائها
  const rows = await db
    .insert(rateLimits)
    .values([
      { key: WINDOW_KEY, windowStart: now, count: 1, updatedAt: now },
      { key: routeKey, windowStart: now, count: 1, updatedAt: now }
    ])
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.windowStart} > ${windowCutoff} then ${rateLimits.count} + 1 else 1 end`,
        windowStart: sql`case when ${rateLimits.windowStart} > ${windowCutoff} then ${rateLimits.windowStart} else excluded.window_start end`,
        updatedAt: now
      }
    })
    .returning({ key: rateLimits.key, count: rateLimits.count, windowStart: rateLimits.windowStart })
  const win = rows.find((r) => r.key === WINDOW_KEY)
  const count = win?.count ?? 1
  if (count < cfg.threshold) return 'counted'

  // حجز التهدئة ذرّياً: عملية واحدة فقط تنجح في تحديث الصف، والبقية تعدّ ما لم يُنبَّه عنه
  const cooldownCutoff = new Date(now.getTime() - cfg.cooldownSeconds * 1000)
  const claimed = await db
    .insert(rateLimits)
    .values({ key: COOLDOWN_KEY, windowStart: now, count: 1, updatedAt: now })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: { windowStart: now, count: sql`${rateLimits.count} + 1`, updatedAt: now },
      setWhere: sql`${rateLimits.windowStart} <= ${cooldownCutoff}`
    })
    .returning({ key: rateLimits.key })
  if (claimed.length === 0) {
    // الخطأ الذي أتمّ العتبة في نافذة لم يُنبَّه عنها يحسب أخطاء النافذة كلها؛ أما إن سبقته عملية أخرى
    // إلى التنبيه عن هذه النافذة نفسها (تزامن) فأخطاؤها الأولى مذكورة في الرسالة ولا تُحسب ثانية
    let add = 1
    if (count === cfg.threshold) {
      const [cd] = await db.select({ at: rateLimits.windowStart }).from(rateLimits).where(eq(rateLimits.key, COOLDOWN_KEY)).limit(1)
      if (!cd || !win || cd.at.getTime() < win.windowStart.getTime()) add = cfg.threshold
    }
    await db
      .insert(rateLimits)
      .values({ key: SUPPRESSED_KEY, windowStart: now, count: add, updatedAt: now })
      .onConflictDoUpdate({ target: rateLimits.key, set: { count: sql`${rateLimits.count} + ${add}`, windowStart: now, updatedAt: now } })
    return 'suppressed'
  }

  const [sup] = await db.delete(rateLimits).where(eq(rateLimits.key, SUPPRESSED_KEY)).returning({ count: rateLimits.count })
  const suppressed = sup?.count ?? 0
  const [top] = await db
    .select({ key: rateLimits.key, count: rateLimits.count })
    .from(rateLimits)
    .where(and(like(rateLimits.key, `${ROUTE_PREFIX}%`), gt(rateLimits.windowStart, windowCutoff)))
    .orderBy(desc(rateLimits.count))
    .limit(1)
  const text = buildAlertText({
    count,
    windowSeconds: cfg.windowSeconds,
    topRoute: top ? top.key.slice(ROUTE_PREFIX.length) : null,
    topRouteCount: top?.count ?? null,
    suppressed,
    last: event,
    databaseDown: false
  })
  let ok = false
  try {
    ok = await send(text, db)
  } catch (e) {
    log(`[error-alert] تعذّر إرسال التنبيه: ${scrubText(e instanceof Error ? e.message : String(e))}`)
  }
  if (ok) return 'sent'
  log('[error-alert] لم يُرسل التنبيه (تيليغرام غير مفعّل من لوحة الإدارة أو لا يستجيب) — إعادة المحاولة بعد دقيقة إن استمرت الأخطاء')
  // نُرجع الحجز ليُعاد الإرسال بعد دقيقة، ونعيد عدّاد ما لم يُنبَّه عنه
  const retryAt = new Date(cooldownCutoff.getTime() + SEND_RETRY_AFTER_MS)
  await db.update(rateLimits).set({ windowStart: retryAt, updatedAt: now }).where(and(eq(rateLimits.key, COOLDOWN_KEY), eq(rateLimits.windowStart, now)))
  if (suppressed > 0) {
    await db
      .insert(rateLimits)
      .values({ key: SUPPRESSED_KEY, windowStart: now, count: suppressed, updatedAt: now })
      .onConflictDoUpdate({ target: rateLimits.key, set: { count: sql`${rateLimits.count} + ${suppressed}`, updatedAt: now } })
  }
  return 'send-failed'
}

/** يعدّ الخطأ وينبّه عند بلوغ العتبة. لا يرمي أبداً. */
export async function recordServerError(event: ServerErrorEvent, deps: RecordDeps): Promise<RecordOutcome> {
  const log = deps.log ?? defaultLog
  try {
    const cfg = deps.config ?? errorAlertConfig()
    if (cfg.threshold <= 0) return 'disabled'
    // سطر واحد في السجل يطابق ما يراه التلميذ (digest) — الحقول المنقّاة فقط
    log(`[error-alert] ${JSON.stringify(event)}`)
    if (mem.inFlight >= MAX_IN_FLIGHT) return 'dropped'
    mem.inFlight += 1
    try {
      const now = deps.now ?? new Date()
      const nowMs = now.getTime()
      if (nowMs >= mem.dbDownUntil) {
        const timeout = deps.dbTimeoutMs ?? DB_TIMEOUT_MS
        try {
          const db = await withTimeout(deps.getDb(), timeout, 'error-alert-db')
          const outcome = await withTimeout(recordInDatabase(db, event, cfg, now, log), timeout + SEND_TIMEOUT_MS + DB_TIMEOUT_MS + 2_000, 'error-alert-db')
          // نبقي بيانات تيليغرام حديثة في الذاكرة ليوم تتوقف فيه القاعدة
          if (!senderOverride && Date.now() - credentialsAt > CREDENTIALS_REFRESH_MS) await refreshCredentials(db, timeout).catch(() => {})
          return outcome
        } catch (e) {
          mem.dbDownUntil = nowMs + DB_RETRY_AFTER_MS
          // Drizzle يغلّف الخطأ: السبب الأصلي (ECONNREFUSED…) أوضح من نص الاستعلام
          const cause = errorField(errorField(e, 'cause'), 'message') ?? errorField(e, 'message') ?? String(e)
          log(`[error-alert] عدّاد القاعدة لا يستجيب، العدّ في ذاكرة العملية: ${scrubText(cause)}`)
        }
      }
      return await recordInMemory(event, cfg, nowMs, log)
    } finally {
      mem.inFlight -= 1
    }
  } catch (e) {
    try {
      log(`[error-alert] ${scrubText(e instanceof Error ? e.message : String(e))}`)
    } catch {
      /* لا شيء */
    }
    return 'dropped'
  }
}

/**
 * مدخل `onRequestError`: يعود فوراً (لا ينتظره الطلب) ولا يرمي مهما حدث.
 * `request.headers` لا تُقرأ إطلاقاً.
 */
export function reportRequestError(
  error: unknown,
  request: { path?: unknown; method?: unknown } | null | undefined,
  context: { routePath?: unknown; routeType?: unknown } | null | undefined,
  deps: RecordDeps
): void {
  try {
    if (!isCountableError(error)) return
    const event = describeRequestError(error, request, context, deps.now)
    void recordServerError(event, deps).catch(() => {})
  } catch {
    /* مسار التنبيه لا يُفشل الطلب */
  }
}

/** نمط المسار للأخطاء التي يبتلعها `toAppError` (لا يصلنا معها مسار الطلب) */
export const HANDLED_ROUTE = 'إجراء خادم أو API'

/**
 * الأخطاء غير المتوقعة داخل الإجراءات ومسارات API تُحوَّل إلى INTERNAL في `toAppError` ولا تبلغ
 * `onRequestError`: نركّب مصبّاً يعدّها هي أيضاً. null يزيله (للاختبارات).
 */
export function installHandledErrorSink(deps: RecordDeps | null): void {
  const g = globalThis as { __madrasaErrorSink?: (e: unknown) => void }
  if (!deps) {
    delete g.__madrasaErrorSink
    return
  }
  g.__madrasaErrorSink = (error) => reportRequestError(error, null, { routePath: HANDLED_ROUTE, routeType: 'handled' }, deps)
}

/**
 * عند إقلاع العملية: يركّب مصبّ الأخطاء المبتلَعة، ويحمّل بيانات تيليغرام إلى الذاكرة ويجدّدها دورياً، ليصل تنبيه «القاعدة لا تستجيب»
 * حتى إن توقفت القاعدة قبل أي خطأ آخر. فشله صامت.
 */
export function warmErrorAlerts(getDb: () => Promise<Db>): void {
  installHandledErrorSink({ getDb })
  const tick = () => {
    void (async () => {
      try {
        if (errorAlertConfig().threshold <= 0) return
        const db = await withTimeout(getDb(), DB_TIMEOUT_MS, 'error-alert-warm')
        await refreshCredentials(db, DB_TIMEOUT_MS)
      } catch {
        /* تُعاد المحاولة في الدورة التالية */
      }
    })()
  }
  setTimeout(tick, 5_000).unref?.()
  setInterval(tick, CREDENTIALS_REFRESH_MS).unref?.()
}
