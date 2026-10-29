/**
 * اختبار الضغط — مولّد زيارات بسيط بلا مكتبات (Node 22، fetch المدمج). يستهدف نسخة الاختبار وحدها.
 *
 *   STRESS_BASE=http://stress-app:3000 STRESS_DATA=/out/accounts.json STRESS_LEVELS="50 100 200 400" \
 *   STRESS_SECONDS=120 node scripts/stress/load.mjs
 *
 * كل «تلميذ وهميّ» يكرّر ما يفعله التلميذ في مدرسة PLAY: الصفحة الرئيسية للعب ← قائمة البكالوريا ← بدء موضوع
 * (إجراء الخادم نفسه) ← صفحة الموضوع ← ثلاث إجابات (إجراء الخادم نفسه)، مع انتظار 2–5 ثوانٍ بين كل خطوة وأخرى.
 * فهو أنشط بكثير من تلميذ حقيقيّ (يقرأ السؤال ويفكّر)، فالأرقام هنا هامش أمان.
 *
 * يتوقف التصعيد إن تجاوزت الأخطاء 5% أو زمن الاستجابة p95 أربع ثوانٍ، أو إن بطؤ الموقع الحقيقيّ (STRESS_PROD_URL)
 * أكثر من ثلاث ثوانٍ ثلاث مرات متتالية.
 */
import { readFileSync } from 'node:fs'

const BASE = process.env.STRESS_BASE ?? 'http://stress-app:3000'
const DATA = JSON.parse(readFileSync(process.env.STRESS_DATA ?? '/out/accounts.json', 'utf8'))
const LEVELS = (process.env.STRESS_LEVELS ?? '50 100 200 400').split(/\s+/).filter(Boolean).map(Number)
const SECONDS = Number(process.env.STRESS_SECONDS ?? 120)
const PROD = process.env.STRESS_PROD_URL ?? ''
const MAX_ERR = Number(process.env.STRESS_MAX_ERROR_RATE ?? 0.05)
const MAX_P95 = Number(process.env.STRESS_MAX_P95_MS ?? 4000)

if (!/^http:\/\/stress[\w-]*(:\d+)?$/.test(BASE) && !(process.env.STRESS_LOCAL_TEST === '1' && /^http:\/\/localhost:\d+$/.test(BASE))) throw new Error(`رفض: ${BASE} ليست نسخة الاختبار (http://stress…)`)
if (LEVELS.some((n) => !(n > 0)) || Math.max(...LEVELS) > DATA.accounts.length) throw new Error(`المستويات ${LEVELS.join(' ')} تتجاوز عدد الحسابات (${DATA.accounts.length})`)

const [THINK_MIN, THINK_MAX] = (process.env.STRESS_THINK_MS ?? '2000-5000').split('-').map(Number)
const RAMP_MS = Number(process.env.STRESS_RAMP_SECONDS ?? 10) * 1000
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const think = () => sleep(THINK_MIN + Math.random() * (THINK_MAX - THINK_MIN))
const pick = (a) => a[Math.floor(Math.random() * a.length)]

class Stats {
  constructor() { this.byName = new Map(); this.errors = 0; this.count = 0 }
  add(name, ms, ok) {
    const s = this.byName.get(name) ?? { lat: [], err: 0 }
    s.lat.push(ms)
    if (!ok) { s.err++; this.errors++ }
    this.count++
    this.byName.set(name, s)
  }
  static pct(a, p) {
    if (!a.length) return 0
    const s = [...a].sort((x, y) => x - y)
    return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]
  }
  all() { return [...this.byName.values()].flatMap((s) => s.lat) }
}

async function timed(stats, name, fn) {
  const t = performance.now()
  let ok = false
  try { ok = await fn() } catch { ok = false }
  stats.add(name, performance.now() - t, ok)
  return ok
}

function headers(token, extra = {}) {
  return { cookie: `madrasa_session=${token}`, 'user-agent': 'madrasa-stress', ...extra }
}

async function page(token, path) {
  const r = await fetch(BASE + path, { headers: headers(token), redirect: 'manual' })
  await r.arrayBuffer()
  return r.status === 200
}

/** استدعاء إجراء خادم كما يفعله المتصفح (Next-Action) — النتيجة {ok,…} داخل ردّ text/x-component */
async function action(token, path, id, payload) {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: headers(token, { 'Next-Action': id, 'content-type': 'text/plain;charset=UTF-8', accept: 'text/x-component', origin: BASE }),
    body: JSON.stringify([payload]),
    redirect: 'manual'
  })
  const text = await r.text()
  return { ok: r.status === 200 && text.includes('"ok":true'), text }
}

async function student(account, stats, until, flag) {
  const sets = DATA.sets[account.stream]
  const progress = new Map()
  const live = () => Date.now() < until && !flag.done
  while (live()) {
    await timed(stats, 'صفحة PLAY', () => page(account.token, '/student/play'))
    await think()
    if (!live()) break
    await timed(stats, 'قائمة البكالوريا', () => page(account.token, '/student/play/bac?subject=AR'))
    await think()
    if (!live()) break
    const set = pick(sets)
    let attemptId = null
    await timed(stats, 'بدء موضوع (إجراء)', async () => {
      const r = await action(account.token, '/student/play/bac', DATA.actions.start, { setId: set.uuid, mode: 'PRACTICE' })
      attemptId = r.text.match(/"attemptId":"([0-9a-f-]{36})"/)?.[1] ?? null
      return r.ok && Boolean(attemptId)
    })
    if (!attemptId) { await think(); continue }
    await timed(stats, 'صفحة الموضوع', () => page(account.token, `/student/play/exam/${attemptId}`))
    for (let k = 0; k < 3 && live(); k++) {
      await think()
      const i = progress.get(attemptId) ?? 0
      const step = set.steps[i % set.steps.length]
      progress.set(attemptId, i + 1)
      const answer = step.type === 'multi' ? { type: 'multi', choices: [0] } : { type: 'mcq', choice: Math.floor(Math.random() * Math.max(1, step.n)) }
      // خطوة سبق إرسالها تُرفض بلطف (ok:false) — تُحسب طلبًا ناجحًا ما دام الخادم أجاب بلا خطأ
      await timed(stats, 'إرسال إجابة (إجراء)', async () => {
        const r = await action(account.token, `/student/play/exam/${attemptId}`, DATA.actions.submit, { attemptId, stepId: step.id, answer })
        return r.ok || /"ok":false/.test(r.text)
      })
    }
    await think()
  }
}

async function prodProbe(stopFlag, log) {
  if (!PROD) return
  let slow = 0
  while (!stopFlag.done) {
    const t = performance.now()
    let ms = Infinity
    try {
      const r = await fetch(PROD, { redirect: 'manual', signal: AbortSignal.timeout(10_000) })
      await r.arrayBuffer()
      ms = performance.now() - t
    } catch {}
    log.push(ms)
    slow = ms > 3000 ? slow + 1 : 0
    if (slow >= 3) { stopFlag.prodSlow = true; stopFlag.done = true }
    await sleep(10_000)
  }
}

const fmt = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)} ث` : `${Math.round(ms)} م.ث`)
const summary = []
console.log(`اختبار الضغط على ${BASE} — المستويات: ${LEVELS.join('، ')} تلميذًا وهميًّا، ${SECONDS} ثانية لكل مستوى، انتظار ${THINK_MIN / 1000}–${THINK_MAX / 1000} ث بين الخطوات\n`)
for (const n of LEVELS) {
  const stats = new Stats()
  const flag = { done: false, prodSlow: false }
  const prodLog = []
  const until = Date.now() + SECONDS * 1000
  const probe = prodProbe(flag, prodLog)
  // يدخل التلاميذ تدريجيًّا (10 ثوانٍ افتراضيًّا، دقيقة في الوضع الواقعيّ)، لا دفعة واحدة
  const users = DATA.accounts.slice(0, n).map((a, i) => sleep(Math.floor((i / n) * RAMP_MS)).then(() => student(a, stats, until, flag)))
  await Promise.all(users)
  flag.done = true
  await probe
  const all = stats.all()
  const errRate = stats.count ? stats.errors / stats.count : 1
  const row = { n, req: stats.count, rps: stats.count / SECONDS, p50: Stats.pct(all, 50), p95: Stats.pct(all, 95), p99: Stats.pct(all, 99), errRate, prodMax: prodLog.length ? Math.max(...prodLog) : null }
  summary.push(row)
  console.log(`■ ${n} تلميذًا: ${row.req} طلبًا (${row.rps.toFixed(1)}/ث) — الوسيط ${fmt(row.p50)}، 95% ≤ ${fmt(row.p95)}، 99% ≤ ${fmt(row.p99)}، أخطاء ${(errRate * 100).toFixed(1)}%${row.prodMax != null ? `، أبطأ ردّ للموقع الحقيقي ${fmt(row.prodMax)}` : ''}`)
  for (const [name, s] of stats.byName) console.log(`    ${name}: ${s.lat.length} — 95% ≤ ${fmt(Stats.pct(s.lat, 95))}، أخطاء ${s.err}`)
  if (flag.prodSlow) { console.log('\n⛔ توقّف: الموقع الحقيقي بطؤ أكثر من 3 ثوانٍ ثلاث مرات متتالية.'); break }
  if (errRate > MAX_ERR || row.p95 > MAX_P95) { console.log(`\n⛔ توقّف التصعيد: ${errRate > MAX_ERR ? 'نسبة الأخطاء' : 'زمن الاستجابة'} تجاوز الحدّ عند ${n} تلميذًا.`); break }
  await sleep(15_000)
}
const okRows = summary.filter((r) => r.errRate <= MAX_ERR && r.p95 <= 1500)
console.log('\n══ الخلاصة ══')
console.log(okRows.length ? `الخادم يخدم ${okRows.at(-1).n} تلميذًا (انتظار ${THINK_MIN / 1000}–${THINK_MAX / 1000} ث بين الخطوات) في اللحظة نفسها و95% من الطلبات أقل من ثانية ونصف.` : 'لم يبلغ أي مستوى معيار «95% أقل من ثانية ونصف».')
console.log(JSON.stringify({ summary }))
