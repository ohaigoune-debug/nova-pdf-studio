import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/server/db/client'
import { clientIp } from '@/server/lib/client-ip'
import { isAppError } from '@/server/lib/errors'
import { checkRateLimit } from '@/server/lib/rate-limit'
import { SCRIPTS } from '@/lib/call-center'
import { authorizeAgent, claimAgentTasks, recordInbound, reportAgentResult, touchAgent } from '@/server/services/call-center.service'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * واجهة الصندوق المحلي (Asterisk + Yeastar TG400L في بوسعادة). الصندوق هو من يتصل بنا دائمًا (HTTPS صادر)،
 * فلا منفذ مفتوح عنده. المصادقة: Authorization: Bearer <رمز يُنشأ من لوحة مركز الاتصال>.
 *   GET  /api/v1/callcenter/agent/ping?v=1.0      الإعداد: الشرائح، ساعات الاتصال، النصوص
 *   POST /api/v1/callcenter/agent/pull            { limit?, sims? } ⇒ مكالمات (ورسائل إن كانت القناة gateway)
 *   POST /api/v1/callcenter/agent/report          { taskId, outcome, digit?, durationSec?, error? }
 *   POST /api/v1/callcenter/agent/inbound         JSON أو multipart: phone, sim, choice, durationSec, recording (ملف صوتي)
 */

const simsSchema = z.array(z.object({ slot: z.number().int().min(1).max(32), ok: z.boolean(), signal: z.number().int().min(0).max(100).nullable().optional() })).max(32).optional()
const pullSchema = z.object({ limit: z.number().int().min(1).max(10).optional(), sims: simsSchema, version: z.string().max(20).optional() })
const reportSchema = z.object({
  taskId: z.string().uuid(),
  outcome: z.enum(['ANSWERED', 'NO_ANSWER', 'BUSY', 'REJECTED', 'FAILED', 'SENT']),
  digit: z.string().max(4).nullable().optional(),
  durationSec: z.number().min(0).max(3600).nullable().optional(),
  error: z.string().max(300).nullable().optional()
})
const inboundSchema = z.object({
  phone: z.string().trim().min(6).max(32),
  sim: z.coerce.number().int().min(1).max(32).nullable().optional(),
  choice: z.string().max(2).nullable().optional(),
  durationSec: z.coerce.number().min(0).max(3600).nullable().optional()
})

const deny = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status })

async function guard(req: Request) {
  const db = await getDb()
  try {
    await checkRateLimit(db, { scope: 'callcenter-agent', subject: clientIp(req.headers) ?? 'unknown', limit: 600, windowSeconds: 60 })
  } catch {
    return { db, cfg: null, res: deny(429, 'rate_limited') }
  }
  const cfg = await authorizeAgent(db, req.headers.get('authorization'))
  if (!cfg) return { db, cfg: null, res: deny(401, 'unauthorized') }
  return { db, cfg, res: null }
}

export async function GET(req: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params
  if (action !== 'ping') return deny(404, 'not_found')
  const { db, cfg, res } = await guard(req)
  if (!cfg) return res!
  await touchAgent(db, { version: new URL(req.url).searchParams.get('v') }).catch(() => {})
  return NextResponse.json({
    ok: true,
    mode: cfg.mode,
    outboundSims: cfg.outboundSims,
    inboundSim: cfg.inboundSim,
    callingHours: { start: cfg.quietStart, end: cfg.quietEnd, tz: 'Africa/Algiers' },
    smsChannel: cfg.smsChannel,
    scripts: Object.fromEntries(Object.entries(SCRIPTS).map(([k, v]) => [k, { text: v.text, digits: Object.keys(v.options) }])),
    inboundMenu: cfg.inboundMenu,
    serverTime: new Date().toISOString()
  })
}

export async function POST(req: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params
  if (!['pull', 'report', 'inbound'].includes(action)) return deny(404, 'not_found')
  const { db, cfg, res } = await guard(req)
  if (!cfg) return res!
  try {
    if (action === 'pull') {
      const body = pullSchema.parse(await req.json().catch(() => ({})))
      await touchAgent(db, { version: body.version ?? null, sims: body.sims?.map((s) => ({ slot: s.slot, ok: s.ok, signal: s.signal ?? null })) }).catch(() => {})
      const tasks = await claimAgentTasks(db, cfg, { limit: body.limit })
      return NextResponse.json({ ok: true, tasks })
    }
    if (action === 'report') {
      const body = reportSchema.parse(await req.json())
      const r = await reportAgentResult(db, cfg, body.taskId, { outcome: body.outcome, digit: body.digit ?? null, durationSec: body.durationSec ?? null, error: body.error ?? null })
      return NextResponse.json({ ok: true, ...r })
    }
    // inbound: JSON أو multipart (مع التسجيل الصوتي)
    const type = req.headers.get('content-type') ?? ''
    let fields: Record<string, unknown>
    let recording: { bytes: Buffer; mime: string } | null = null
    if (type.includes('multipart/form-data')) {
      const form = await req.formData()
      fields = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === 'string'))
      const file = form.get('recording')
      if (file && typeof file !== 'string' && file.size > 0) recording = { bytes: Buffer.from(await file.arrayBuffer()), mime: file.type || 'audio/wav' }
    } else fields = (await req.json()) as Record<string, unknown>
    const body = inboundSchema.parse(fields)
    const r = await recordInbound(db, cfg, { phone: body.phone, simSlot: body.sim ?? null, choice: body.choice ?? null, durationSec: body.durationSec ?? null, recording })
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    if (e instanceof z.ZodError) return deny(400, 'bad_request')
    if (isAppError(e)) return deny(e.status ?? 400, e.code)
    console.error('[callcenter agent]', e instanceof Error ? e.message : e)
    return deny(500, 'server_error')
  }
}
