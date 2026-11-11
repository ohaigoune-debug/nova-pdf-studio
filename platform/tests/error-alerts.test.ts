/**
 * تنبيه المشرف عند تكرار أخطاء الخادم: العتبة، التهدئة وعدّ ما لم يُنبَّه عنه، عدم التكرار بين العمليات،
 * خلوّ النص من البيانات الحساسة، وعدم تأثير فشل الإرسال أو توقف القاعدة على الطلب.
 * المرسل يُحقن (لا شبكة)، كما يُحقن مرسل الرسائل القصيرة في الاختبارات الأخرى.
 */
import { like } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DatabaseHandle, Db } from '@/server/db/connect'
import { rateLimits } from '@/server/db/schema'
import {
  buildAlertText,
  describeRequestError,
  errorAlertConfig,
  installHandledErrorSink,
  isCountableError,
  recordServerError,
  reportRequestError,
  resetErrorAlertStateForTests,
  safePath,
  scrubText,
  setErrorAlertSenderForTests,
  type ErrorAlertConfig,
  type RecordDeps
} from '@/server/lib/error-alerts'
import { AppError, toAppError } from '@/server/lib/errors'
import { saveTelegramConfig } from '@/server/lib/telegram'
import { setupDb } from './helpers'

let h: DatabaseHandle
let db: Db
let sent: { text: string; viaDb: boolean }[]
let logs: string[]

const cfg: ErrorAlertConfig = { threshold: 5, windowSeconds: 120, cooldownSeconds: 15 * 60 }
const T0 = new Date('2026-11-24T08:00:00.000Z').getTime()
const at = (seconds: number) => new Date(T0 + seconds * 1000)

const deps = (seconds: number, over: Partial<RecordDeps> = {}): RecordDeps => ({ getDb: async () => db, now: at(seconds), config: cfg, log: (l) => logs.push(l), ...over })
const boom = (digest = '1234567890') => Object.assign(new Error('boom: connection refused'), { digest })
const event = (seconds: number, route = '/courses/[id]', digest = '1234567890') =>
  describeRequestError(boom(digest), { path: route.replace('[id]', '42') + '?token=SECRET', method: 'GET' }, { routePath: route, routeType: 'render' }, at(seconds))
const hit = (seconds: number, route?: string, over: Partial<RecordDeps> = {}) => recordServerError(event(seconds, route), deps(seconds, over))

beforeAll(async () => {
  h = await setupDb()
  db = h.db
})
afterAll(async () => {
  setErrorAlertSenderForTests(null)
  await h.close()
})
beforeEach(async () => {
  await db.delete(rateLimits).where(like(rateLimits.key, 'error-alert:%'))
  resetErrorAlertStateForTests()
  sent = []
  logs = []
  setErrorAlertSenderForTests(async (text, viaDb) => {
    sent.push({ text, viaDb: viaDb !== null })
    return true
  })
})

describe('error alerts: threshold and cool-down', () => {
  it('stays silent below the threshold', async () => {
    for (let i = 0; i < 4; i++) expect(await hit(i)).toBe('counted')
    expect(sent).toHaveLength(0)
  })

  it('sends exactly one Arabic message when the threshold is reached', async () => {
    const outcomes: string[] = []
    for (let i = 0; i < 4; i++) outcomes.push(await hit(i, '/courses/[id]'))
    outcomes.push(await hit(5, '/api/v1/health'))
    expect(outcomes).toEqual(['counted', 'counted', 'counted', 'counted', 'sent'])
    expect(sent).toHaveLength(1)
    const text = sent[0]!.text
    expect(text).toContain('أخطاء متكررة في الخادم')
    expect(text).toContain('عدد الأخطاء: 5 خلال 2 د')
    // الأكثر تعطلاً هو المسار الذي تكرر 4 مرات، لا مسار آخر خطأ
    expect(text).toContain('الأكثر تعطلاً: /courses/[id] (4)')
    expect(text).toContain('رمز الخطأ (digest): 1234567890')
    expect(text).toContain('docker compose logs --tail 100 app')
    expect(text).not.toContain('منذ التنبيه السابق')
    // لا تتبّع مكدّس في تيليغرام
    expect(text).not.toMatch(/\n\s+at /)
    expect(text.length).toBeLessThan(600)
  })

  it('does not alert when the errors are spread beyond the window', async () => {
    for (let i = 0; i < 12; i++) expect(await hit(i * 100)).toBe('counted')
    expect(sent).toHaveLength(0)
  })

  it('cool-down suppresses, and the next message reports how many were suppressed', async () => {
    for (let i = 0; i < 5; i++) await hit(i)
    expect(sent).toHaveLength(1)
    // 7 أخطاء أخرى في النافذة نفسها + دفعة من 5 بعد خمس دقائق = 12 خطأ بلا تنبيه
    for (let i = 0; i < 7; i++) expect(await hit(10 + i)).toBe('suppressed')
    for (let i = 0; i < 5; i++) await hit(300 + i)
    expect(sent).toHaveLength(1)
    // بعد انقضاء التهدئة: دفعة جديدة تُنبّه مرة واحدة وتذكر ما فات
    const outcomes: string[] = []
    for (let i = 0; i < 6; i++) outcomes.push(await hit(16 * 60 + i))
    expect(outcomes).toEqual(['counted', 'counted', 'counted', 'counted', 'sent', 'suppressed'])
    expect(sent).toHaveLength(2)
    expect(sent[1]!.text).toContain('منذ التنبيه السابق: 12 خطأ آخر لم يُنبَّه عنه.')
  })

  it('two processes sharing the database do not double-send', async () => {
    // «عمليتان»: نداءان متزامنان ثم متتاليان على القاعدة نفسها، وحالة الذاكرة تُمحى بينهما كعملية أخرى
    const first = await Promise.all(Array.from({ length: 10 }, (_, i) => hit(i % 3)))
    resetErrorAlertStateForTests()
    const second = await Promise.all(Array.from({ length: 10 }, (_, i) => hit(3 + (i % 3))))
    expect([...first, ...second].filter((o) => o === 'sent')).toHaveLength(1)
    expect(sent).toHaveLength(1)
    expect(sent[0]!.viaDb).toBe(true)
  })

  it('threshold 0 disables counting, and env overrides are read', async () => {
    expect(await recordServerError(event(0), deps(0, { config: { ...cfg, threshold: 0 } }))).toBe('disabled')
    const keep = { ...process.env }
    try {
      process.env.ERROR_ALERT_THRESHOLD = '3'
      process.env.ERROR_ALERT_WINDOW_SECONDS = '60'
      process.env.ERROR_ALERT_COOLDOWN_MINUTES = '30'
      expect(errorAlertConfig()).toEqual({ threshold: 3, windowSeconds: 60, cooldownSeconds: 1800 })
      process.env.ERROR_ALERT_THRESHOLD = 'abc'
      process.env.ERROR_ALERT_WINDOW_SECONDS = '-5'
      process.env.ERROR_ALERT_COOLDOWN_MINUTES = ''
      expect(errorAlertConfig()).toEqual({ threshold: 5, windowSeconds: 120, cooldownSeconds: 900 })
    } finally {
      process.env = keep
    }
  })
})

describe('error alerts: what counts as a failure', () => {
  it('ignores 404, redirects and expected application errors', () => {
    expect(isCountableError(Object.assign(new Error('NEXT_HTTP_ERROR_FALLBACK;404'), { digest: 'NEXT_HTTP_ERROR_FALLBACK;404' }))).toBe(false)
    expect(isCountableError(Object.assign(new Error('NEXT_NOT_FOUND'), { digest: 'NEXT_NOT_FOUND' }))).toBe(false)
    expect(isCountableError(Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/login;307;' }))).toBe(false)
    for (const code of ['NOT_FOUND', 'VALIDATION', 'RATE_LIMITED', 'AUTH_REQUIRED', 'FORBIDDEN'] as const) expect(isCountableError(new AppError(code)), code).toBe(false)
    expect(isCountableError(Object.assign(new Error('aborted'), { name: 'AbortError' }))).toBe(false)
    expect(isCountableError(new Error('Failed to find Server Action "abc". This request might be from an older or newer deployment.'))).toBe(false)
  })

  it('counts real failures', () => {
    expect(isCountableError(boom())).toBe(true)
    expect(isCountableError(new TypeError("Cannot read properties of undefined (reading 'id')"))).toBe(true)
    expect(isCountableError(new AppError('INTERNAL'))).toBe(true)
    expect(isCountableError('a thrown string')).toBe(true)
  })

  it('the hook entry skips expected errors and never touches the database for them', async () => {
    let dbCalls = 0
    const d = deps(0, { getDb: async () => (dbCalls++, db) })
    for (let i = 0; i < 10; i++) reportRequestError(new AppError('RATE_LIMITED'), { path: '/login', method: 'POST' }, { routePath: '/login', routeType: 'action' }, d)
    await new Promise((r) => setTimeout(r, 50))
    expect(dbCalls).toBe(0)
    expect(sent).toHaveLength(0)
  })
})

describe('error alerts: errors swallowed by toAppError (server actions, API routes)', () => {
  afterAll(() => installHandledErrorSink(null))

  it('are counted too, while expected AppErrors are not', async () => {
    installHandledErrorSink(deps(0, { config: { ...cfg, threshold: 3 } }))
    for (let i = 0; i < 6; i++) expect(toAppError(new AppError('VALIDATION')).code).toBe('VALIDATION')
    await new Promise((r) => setTimeout(r, 50))
    expect(sent).toHaveLength(0)
    for (let i = 0; i < 3; i++) {
      expect(toAppError(new Error('relation "orders" does not exist')).code).toBe('INTERNAL')
      await new Promise((r) => setTimeout(r, 30))
    }
    await new Promise((r) => setTimeout(r, 100))
    expect(sent).toHaveLength(1)
    expect(sent[0]!.text).toContain('الأكثر تعطلاً: إجراء خادم أو API (3)')
    expect(sent[0]!.text).toContain('آخر خطأ: إجراء خادم أو API — Error: relation "orders" does not exist')
  })

  it('a broken sink never changes what toAppError returns', () => {
    ;(globalThis as { __madrasaErrorSink?: (e: unknown) => void }).__madrasaErrorSink = () => {
      throw new Error('sink is broken')
    }
    expect(toAppError(new Error('x')).code).toBe('INTERNAL')
    installHandledErrorSink(null)
    expect(toAppError(new Error('x')).code).toBe('INTERNAL')
  })
})

describe('error alerts: no sensitive data', () => {
  const nasty = Object.assign(
    new Error(
      'Failed query: insert into "users" ("email","phone") values ($1,$2)\nparams: student@example.dz,0555123456,eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2VjcmV0LXNpZ25hdHVyZQ'
    ),
    { digest: '998877', name: 'DrizzleQueryError' }
  )
  const request = {
    path: '/reset/3f9a1c7e5b2d4a6f8e0c1b3d5f7a9c2e4b6d8f0a?token=TOKEN-IN-QUERY&email=student@example.dz#frag',
    method: 'post',
    headers: { cookie: 'madrasa_session=SESSION-COOKIE-VALUE', authorization: 'Bearer BEARER-SECRET', 'x-forwarded-for': '41.100.1.2' }
  }
  const secrets = ['student@example.dz', '0555123456', 'eyJhbGci', 'TOKEN-IN-QUERY', 'SESSION-COOKIE-VALUE', 'BEARER-SECRET', '3f9a1c7e5b2d4a6f8e0c1b3d5f7a9c2e4b6d8f0a', '41.100.1.2', 'params']

  it('the recorded event keeps only route, method, digest, name and a scrubbed message', () => {
    const ev = describeRequestError(nasty, request, { routePath: '/reset/[token]', routeType: 'render' }, at(0))
    expect(Object.keys(ev).sort()).toEqual(['at', 'digest', 'kind', 'message', 'method', 'name', 'path', 'route'])
    expect(ev).toMatchObject({ route: '/reset/[token]', path: '/reset/…', method: 'POST', digest: '998877', name: 'DrizzleQueryError', at: '2026-11-24T08:00:00.000Z' })
    const json = JSON.stringify(ev)
    for (const s of secrets) expect(json, s).not.toContain(s)
  })

  it('nothing sensitive reaches Telegram, the log line or the stored keys', async () => {
    const ev = describeRequestError(nasty, request, { routePath: '/reset/[token]', routeType: 'render' }, at(0))
    for (let i = 0; i < 5; i++) await recordServerError(ev, deps(i))
    expect(sent).toHaveLength(1)
    const rows = await db.select({ key: rateLimits.key }).from(rateLimits).where(like(rateLimits.key, 'error-alert:%'))
    expect(rows.map((r) => r.key).sort()).toEqual(['error-alert:cooldown', 'error-alert:route:/reset/[token]', 'error-alert:window'])
    const everything = [sent[0]!.text, ...logs, ...rows.map((r) => r.key)].join('\n')
    for (const s of secrets) expect(everything, s).not.toContain(s)
    expect(sent[0]!.text).toContain('998877')
  })

  it('falls back to a cleaned path when the route pattern is missing', () => {
    const ev = describeRequestError(boom(), { path: 'https://madrasadz.com/orders/0555123456/a@b.dz?x=1', method: 'GET' }, {}, at(0))
    expect(ev.route).toBe('/orders/…/…')
    expect(safePath('/courses/0b9d6f0e-1c2d-4e3f-8a9b-0c1d2e3f4a5b/lessons?page=2')).toBe('/courses/0b9d6f0e-1c2d-4e3f-8a9b-0c1d2e3f4a5b/lessons')
    expect(scrubText('call +213 555 12 34 56 or mail a.b@c.dz at https://x.dz/p?k=1')).toBe('call [number] or mail [email] at [url]')
    expect(scrubText('x'.repeat(10) + ' ' + 'word '.repeat(100)).length).toBeLessThanOrEqual(160)
  })

  it('message builder shows the database-down variant without leaking anything extra', () => {
    const text = buildAlertText({ count: 5, windowSeconds: 120, topRoute: '/', topRouteCount: 5, suppressed: 0, last: event(0, '/'), databaseDown: true })
    expect(text).toContain('قاعدة البيانات لا تستجيب')
    expect(text).toContain('docker compose ps')
    expect(text).not.toContain('SECRET')
  })
})

describe('error alerts: the alert path never breaks a request', () => {
  it('a throwing sender does not propagate, and the alert is retried after a minute instead of a full cool-down', async () => {
    let calls = 0
    setErrorAlertSenderForTests(async () => {
      calls++
      throw new Error('telegram is down')
    })
    for (let i = 0; i < 4; i++) await hit(i)
    await expect(hit(4)).resolves.toBe('send-failed')
    expect(calls).toBe(1)
    // خلال الدقيقة: لا محاولة جديدة مع كل خطأ
    expect(await hit(10)).toBe('suppressed')
    expect(calls).toBe(1)
    // بعد دقيقة والأخطاء مستمرة: يُعاد الإرسال وينجح
    setErrorAlertSenderForTests(async (text) => {
      sent.push({ text, viaDb: true })
      return true
    })
    expect(await hit(70)).toBe('sent')
    expect(sent).toHaveLength(1)
    expect(sent[0]!.text).toContain('منذ التنبيه السابق: 1 خطأ آخر')
  })

  it('a sender reporting "not configured" is not counted as sent', async () => {
    setErrorAlertSenderForTests(async () => false)
    for (let i = 0; i < 4; i++) await hit(i)
    expect(await hit(4)).toBe('send-failed')
    expect(logs.join('\n')).toContain('لم يُرسل التنبيه')
  })

  it('the hook entry returns immediately and never throws, whatever it is given', async () => {
    setErrorAlertSenderForTests(async () => {
      throw new Error('telegram is down')
    })
    const broken: RecordDeps = {
      getDb: async () => {
        throw new Error('db is down')
      },
      config: { ...cfg, threshold: 1 },
      log: () => {
        throw new Error('log is broken')
      }
    }
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    const weird: unknown[] = [undefined, null, 42, 'text', cyclic, Object.create(null), new Proxy({}, { get: () => { throw new Error('hostile getter') } })]
    for (const w of weird) {
      expect(() => reportRequestError(w, w as never, w as never, broken)).not.toThrow()
      expect(reportRequestError(boom(), { path: '/', method: 'GET' }, null, broken)).toBeUndefined()
    }
    await new Promise((r) => setTimeout(r, 50))
  })
})

describe('error alerts: database down', () => {
  const downDb = async (): Promise<Db> => {
    throw new Error('connect ECONNREFUSED 172.18.0.2:5432')
  }

  it('falls back to the in-memory limiter and still sends one alert saying the database is unreachable', async () => {
    const outcomes: string[] = []
    for (let i = 0; i < 9; i++) outcomes.push(await hit(i, '/', { getDb: downDb }))
    expect(outcomes).toEqual(['counted', 'counted', 'counted', 'counted', 'sent', 'suppressed', 'suppressed', 'suppressed', 'suppressed'])
    expect(sent).toHaveLength(1)
    expect(sent[0]!.viaDb).toBe(false)
    expect(sent[0]!.text).toContain('قاعدة البيانات لا تستجيب')
    expect(sent[0]!.text).toContain('عدد الأخطاء: 5 خلال 2 د')
    expect(sent[0]!.text).toContain('رمز الخطأ (digest): 1234567890')
    // عنوان الخادم الداخلي في رسالة الاتصال لا يُسجَّل
    expect(logs.join('\n')).not.toContain('172.18.0.2')
    // بعد التهدئة والقاعدة ما زالت متوقفة: تنبيه ثانٍ يذكر ما فات
    for (let i = 0; i < 5; i++) await hit(16 * 60 + i, '/', { getDb: downDb })
    expect(sent).toHaveLength(2)
    expect(sent[1]!.text).toContain('منذ التنبيه السابق: 4 خطأ آخر')
  })

  it('does not hammer a failing database: one attempt, then memory only for a while', async () => {
    let attempts = 0
    const counting = async (): Promise<Db> => {
      attempts++
      throw new Error('db is down')
    }
    for (let i = 0; i < 8; i++) await hit(i, '/', { getDb: counting })
    expect(attempts).toBe(1)
    await hit(40, '/', { getDb: counting })
    expect(attempts).toBe(2)
  })

  it('a hanging database is abandoned after the timeout', async () => {
    const hanging = () => new Promise<Db>(() => {})
    const started = Date.now()
    const outcomes: string[] = []
    for (let i = 0; i < 5; i++) outcomes.push(await hit(i, '/', { getDb: hanging, dbTimeoutMs: 40 }))
    expect(outcomes[4]).toBe('sent')
    expect(Date.now() - started).toBeLessThan(2000)
    expect(sent[0]!.viaDb).toBe(false)
  })

  it('a database whose queries fail (not only the connection) also falls back', async () => {
    const failing = new Proxy(db, {
      get(target, prop, receiver) {
        if (prop === 'insert') {
          return () => {
            throw new Error('relation "rate_limits" does not exist')
          }
        }
        return Reflect.get(target, prop, receiver) as unknown
      }
    })
    for (let i = 0; i < 5; i++) await hit(i, '/', { getDb: async () => failing })
    expect(sent).toHaveLength(1)
    expect(sent[0]!.viaDb).toBe(false)
  })

  it('a throwing sender in the fallback path does not propagate either', async () => {
    setErrorAlertSenderForTests(async () => {
      throw new Error('telegram is down')
    })
    for (let i = 0; i < 4; i++) await hit(i, '/', { getDb: downDb })
    await expect(hit(4, '/', { getDb: downDb })).resolves.toBe('send-failed')
  })
})

describe('error alerts: the real Telegram sender (fetch stubbed, no network)', () => {
  const TOKEN = '123456789:' + 'A'.repeat(35)
  const calls: { url: string; body: { chat_id?: string; text?: string } }[] = []
  const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? '{}')) as { chat_id?: string; text?: string } })
    return new Response(JSON.stringify({ ok: true, result: { username: 'madrasa_test_bot' } }), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
  const downDb = async (): Promise<Db> => {
    throw new Error('db is down')
  }

  beforeEach(async () => {
    calls.length = 0
    await saveTelegramConfig(db, { enabled: true, chatId: '-100200300', token: TOKEN }, fakeFetch)
    calls.length = 0
    setErrorAlertSenderForTests(null)
    vi.stubGlobal('fetch', fakeFetch)
  })
  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('uses the bot saved from the admin panel, and its cached credentials once the database goes down', async () => {
    for (let i = 0; i < 5; i++) await hit(i)
    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`)
    expect(calls[0]!.body.chat_id).toBe('-100200300')
    expect(calls[0]!.body.text).toContain('أخطاء متكررة في الخادم')
    // العملية نفسها بعد ساعة والقاعدة متوقفة: البيانات المحفوظة في الذاكرة تكفي للإرسال
    for (let i = 0; i < 5; i++) await hit(3600 + i, '/', { getDb: downDb })
    expect(calls).toHaveLength(2)
    expect(calls[1]!.body.text).toContain('قاعدة البيانات لا تستجيب')
    // رمز البوت لا يظهر في السجل
    expect(logs.join('\n')).not.toContain(TOKEN)
  })

  it('a process that never reached the database has no credentials: it reports send-failed and does not throw', async () => {
    for (let i = 0; i < 4; i++) await hit(i, '/', { getDb: downDb })
    await expect(hit(4, '/', { getDb: downDb })).resolves.toBe('send-failed')
    expect(calls).toHaveLength(0)
  })

  it('Telegram not enabled in the admin panel: nothing is sent and the log says so', async () => {
    await saveTelegramConfig(db, { enabled: false, chatId: '-100200300' }, fakeFetch)
    for (let i = 0; i < 4; i++) await hit(i)
    expect(await hit(4)).toBe('send-failed')
    expect(calls).toHaveLength(0)
    expect(logs.join('\n')).toContain('تيليغرام غير مفعّل')
  })
})
