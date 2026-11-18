import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { setAiRuntimeConfig } from '@/server/ai/provider'
import type { DatabaseHandle } from '@/server/db/connect'
import { appSettings, jobs, notifications, profiles, supportMessages, supportTickets } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { getTicket, openTicket, replyTicket } from '@/server/services/support.service'
import { requestHumanAgent, setTicketAiPaused } from '@/server/services/support.service'
import { runSupportAiJob, startOfAlgiersDay, supportAiToday } from '@/server/support-ai/agent'
import { parsePilotPhones, readSupportAiSettings, saveSupportAiSettings, SUPPORT_AI_NAME } from '@/server/support-ai/settings'
import { makeAdmin, makeStudent, setupDb } from './helpers'

let h: DatabaseHandle
let admin: Actor
let student: Actor
let other: Actor

const KEY = 'sk-ant-test-key-0123456789abcdefghij'

/** واجهة Anthropic مزيّفة: تُرجع الردود بالترتيب وتحفظ الطلبات */
function fakeClaude(replies: unknown[], status = 200) {
  const calls: { url: string; headers: Record<string, string>; body: Record<string, unknown> }[] = []
  let i = 0
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), headers: init?.headers as Record<string, string>, body: JSON.parse(String(init?.body ?? '{}')) })
    const body = replies[Math.min(i++, replies.length - 1)]
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
  return { impl, calls }
}

const text = (t: string) => ({ content: [{ type: 'text', text: t }], stop_reason: 'end_turn', usage: { input_tokens: 3000, output_tokens: 200 } })
const tool = (name: string, input: Record<string, unknown> = {}, id = 'tu_1') => ({ content: [{ type: 'tool_use', id, name, input }], stop_reason: 'tool_use', usage: { input_tokens: 2500, output_tokens: 60 } })

async function setMode(mode: 'OFF' | 'DRAFT' | 'PILOT' | 'ALL', extra: { pilotPhones?: string; dailyLimit?: number; dailyBudgetUsd?: number } = {}) {
  await saveSupportAiSettings(h.db, admin, { mode, model: 'claude-sonnet-5-5', pilotPhones: extra.pilotPhones ?? '', dailyLimit: extra.dailyLimit ?? 100, dailyBudgetUsd: extra.dailyBudgetUsd ?? 5, knowledge: 'الدورة تُفعَّل بعد مسح رمز QR الذي في الكتاب.' })
}

async function lastStudentMessageId(ticketId: string) {
  const v = await getTicket(h.db, admin, ticketId)
  const m = [...v.messages].reverse().find((x) => !x.isAi && x.authorUserId !== admin.userId)
  return m!.id
}

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  student = await makeStudent(h.db, 'أمين بن علي')
  other = await makeStudent(h.db, 'تلميذ آخر')
  await h.db.update(profiles).set({ phone: '0661234567' }).where(eq(profiles.userId, student.userId))
  await h.db.update(profiles).set({ phone: '0770000001' }).where(eq(profiles.userId, other.userId))
})

beforeEach(() => {
  setAiRuntimeConfig({ provider: 'anthropic', apiKey: KEY, model: null })
})

afterAll(async () => {
  setAiRuntimeConfig(null)
  await h.close()
})

describe('إعدادات مساعد الدعم', () => {
  it('الافتراضي متوقف وSonnet 5.5، والحفظ للمشرف العام وحده', async () => {
    const s = await readSupportAiSettings(h.db)
    expect(s).toMatchObject({ mode: 'OFF', model: 'claude-sonnet-5-5', dailyLimit: 100, dailyBudgetUsd: 5 })
    await expect(saveSupportAiSettings(h.db, student, { mode: 'ALL' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(saveSupportAiSettings(h.db, admin, { mode: 'ALL', model: 'gpt-4o' })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(saveSupportAiSettings(h.db, admin, { mode: 'MAX' })).rejects.toMatchObject({ code: 'VALIDATION' })
    const saved = await saveSupportAiSettings(h.db, admin, { mode: 'DRAFT', model: 'claude-haiku-5-5' })
    expect(saved).toMatchObject({ mode: 'DRAFT', model: 'claude-haiku-5-5', botUserId: admin.userId })
  })

  it('أرقام التجربة: +213 والأرقام العربية والفواصل، دون تكرار؛ والرقم الخاطئ مرفوض', () => {
    expect(parsePilotPhones('+213 661 23 45 67\n٠٥٥٠٨٠٨١٢٢، 0661234567')).toEqual(['0661234567', '0550808122'])
    expect(() => parsePilotPhones('12345')).toThrow()
    expect(parsePilotPhones('')).toEqual([])
    expect(parsePilotPhones('0661234567 0550808122')).toEqual(['0661234567', '0550808122'])
  })

  it('بداية اليوم بتوقيت الجزائر', () => {
    expect(startOfAlgiersDay(new Date('2026-11-18T23:30:00Z')).toISOString()).toBe('2026-11-18T23:00:00.000Z')
    expect(startOfAlgiersDay(new Date('2026-11-18T22:30:00Z')).toISOString()).toBe('2026-11-17T23:00:00.000Z')
  })
})

describe('الجدولة', () => {
  it('متوقف: لا مهمة. مفعّل: مهمة بعد رسالة التلميذ. الشكوى عن أستاذ: لا مهمة أبدًا', async () => {
    await setMode('OFF')
    const a = await openTicket(h.db, student, { kind: 'ACCESS', subject: 'الدورة لا تظهر', body: 'اشتريت الكتاب ولا أرى الدورة.' })
    let q = await h.db.select().from(jobs).where(eq(jobs.type, 'SUPPORT_AI_REPLY'))
    expect(q).toHaveLength(0)

    await setMode('DRAFT')
    const b = await openTicket(h.db, student, { kind: 'ACCESS', subject: 'الدورة لا تظهر 2', body: 'ما زالت لا تظهر.' })
    q = await h.db.select().from(jobs).where(eq(jobs.type, 'SUPPORT_AI_REPLY'))
    expect(q).toHaveLength(1)
    expect(q[0]!.payload).toMatchObject({ ticketId: b.id })
    expect(q[0]!.runAfter.getTime()).toBeGreaterThan(Date.now())

    await openTicket(h.db, student, { kind: 'TEACHER', subject: 'شكوى عن أستاذ', body: 'الأستاذ لا يجيب.' })
    q = await h.db.select().from(jobs).where(eq(jobs.type, 'SUPPORT_AI_REPLY'))
    expect(q).toHaveLength(1)

    // ردّ الموظف لا يُطلق المساعد
    await replyTicket(h.db, admin, a.id, 'نتحقق.')
    q = await h.db.select().from(jobs).where(eq(jobs.type, 'SUPPORT_AI_REPLY'))
    expect(q).toHaveLength(1)
  })
})

describe('تشغيل المساعد', () => {
  it('مسودّة: يستعمل أداة ثم يكتب ملاحظة داخلية لا يراها التلميذ، ولا تتغير الحالة', async () => {
    await setMode('DRAFT')
    const t = await openTicket(h.db, student, { kind: 'ACCESS', subject: 'لا أجد دورتي', body: 'أين أجد دورتي؟' })
    const fake = fakeClaude([tool('get_my_account'), text('مرحبًا أمين، الدورة تُفعَّل بعد مسح رمز QR الذي في الكتاب.')])
    const out = await runSupportAiJob(h.db, { ticketId: t.id, messageId: await lastStudentMessageId(t.id) }, { fetchImpl: fake.impl })
    expect(out).toMatchObject({ posted: 'draft', handoff: null, rounds: 2 })

    // الطلب: المفتاح والنموذج والأدوات، وكلام التلميذ داخل <ticket>
    expect(fake.calls).toHaveLength(2)
    expect(fake.calls[0]!.url).toBe('https://api.anthropic.com/v1/messages')
    expect(fake.calls[0]!.headers['x-api-key']).toBe(KEY)
    expect(fake.calls[0]!.headers['anthropic-version']).toBe('2023-06-01')
    expect(fake.calls[0]!.body.model).toBe('claude-sonnet-5-5')
    expect((fake.calls[0]!.body.tools as { name: string }[]).map((x) => x.name)).toContain('handoff_to_staff')
    expect(String(fake.calls[0]!.body.system)).toContain('مسح رمز QR')
    const firstUser = (fake.calls[0]!.body.messages as { content: string }[])[0]!.content
    expect(firstUser).toContain('<ticket>')
    expect(firstUser).toContain('أين أجد دورتي؟')
    // الجولة الثانية: نتيجة الأداة مقيّدة بصاحب التذكرة، بلا رقمه الكامل
    const second = fake.calls[1]!.body.messages as { role: string; content: { type: string; content?: string }[] }[]
    const result = second.at(-1)!.content[0]!
    expect(result.type).toBe('tool_result')
    expect(result.content).toContain('أمين بن علي')
    expect(result.content).not.toContain('0661234567')
    expect(result.content).toContain('"phoneEnding":"67"')

    const staffView = await getTicket(h.db, admin, t.id)
    const draft = staffView.messages.at(-1)!
    expect(draft).toMatchObject({ isAi: true, isInternal: true, authorName: SUPPORT_AI_NAME })
    expect(draft.body).toContain('مسودّة')
    const studentView = await getTicket(h.db, student, t.id)
    expect(studentView.messages.some((m) => m.isAi)).toBe(false)
    expect(studentView.ticket.status).toBe('OPEN')
  })

  it('يردّ على الجميع: يصل التلميذ باسم المساعد، «بانتظار ردّك»، مع إشعار', async () => {
    await setMode('ALL')
    const t = await openTicket(h.db, student, { kind: 'OTHER', subject: 'سؤال', body: 'متى الحصة المباشرة؟' })
    const fake = fakeClaude([text('الحصة القادمة تظهر في «دوراتي».')])
    const out = await runSupportAiJob(h.db, { ticketId: t.id, messageId: await lastStudentMessageId(t.id) }, { fetchImpl: fake.impl })
    expect(out).toMatchObject({ posted: 'reply' })
    const v = await getTicket(h.db, student, t.id)
    expect(v.ticket.status).toBe('WAITING_USER')
    expect(v.messages.at(-1)).toMatchObject({ isAi: true, isInternal: false, isStaff: true, authorName: SUPPORT_AI_NAME, body: 'الحصة القادمة تظهر في «دوراتي».' })
    const notes = await h.db.select().from(notifications).where(eq(notifications.userId, student.userId))
    expect(notes.some((n) => n.title.includes(`#${t.number}`))).toBe(true)
  })

  it('رسالة أحدث من التلميذ: المهمة القديمة تُترك دون نداء', async () => {
    await setMode('ALL')
    const t = await openTicket(h.db, student, { kind: 'OTHER', subject: 'رسالتان', body: 'الأولى' })
    const first = await lastStudentMessageId(t.id)
    await replyTicket(h.db, student, t.id, 'الثانية')
    const fake = fakeClaude([text('لا يجب أن يُرسل')])
    expect(await runSupportAiJob(h.db, { ticketId: t.id, messageId: first }, { fetchImpl: fake.impl })).toEqual({ skipped: 'superseded' })
    expect(fake.calls).toHaveLength(0)
  })

  it('التحويل إلى موظف: ردّ + ملاحظة داخلية + إيقاف المساعد + إشعار المشرفين؛ وبعدها لا مهام', async () => {
    await setMode('ALL')
    const t = await openTicket(h.db, student, { kind: 'ACCESS', subject: 'فعّلوا دورتي', body: 'أريد تفعيل الدورة الآن' })
    const fake = fakeClaude([tool('handoff_to_staff', { reason: 'NEEDS_ACTION', summary: 'يطلب تفعيل دورة غير مفعّلة', suggested_action: 'التحقق من الطلبية' }), text('حوّلتُ طلبك إلى موظف الدعم.')])
    const out = await runSupportAiJob(h.db, { ticketId: t.id, messageId: await lastStudentMessageId(t.id) }, { fetchImpl: fake.impl })
    expect(out).toMatchObject({ posted: 'reply', handoff: 'يحتاج إجراءً من الموظف' })
    const [row] = await h.db.select().from(supportTickets).where(eq(supportTickets.id, t.id))
    expect(row).toMatchObject({ aiPaused: true, status: 'OPEN' })
    const internal = await h.db.select().from(supportMessages).where(and(eq(supportMessages.ticketId, t.id), eq(supportMessages.isInternal, true)))
    expect(internal[0]!.body).toContain('يطلب تفعيل دورة')
    const adminNotes = await h.db.select().from(notifications).where(eq(notifications.userId, admin.userId))
    expect(adminNotes.some((n) => n.title.includes('تحتاج موظفًا'))).toBe(true)

    const before = (await h.db.select().from(jobs).where(eq(jobs.type, 'SUPPORT_AI_REPLY'))).length
    await replyTicket(h.db, student, t.id, 'متى؟')
    expect((await h.db.select().from(jobs).where(eq(jobs.type, 'SUPPORT_AI_REPLY'))).length).toBe(before)
  })

  it('«أريد موظفًا»: لصاحب التذكرة وحده، ويوقف المساعد؛ والمشرف يعيده', async () => {
    await setMode('ALL')
    const t = await openTicket(h.db, student, { kind: 'OTHER', subject: 'أريد إنسانًا', body: 'سؤال' })
    await expect(requestHumanAgent(h.db, other, t.id)).rejects.toMatchObject({ code: 'TICKET_NOT_FOUND' })
    await requestHumanAgent(h.db, student, t.id)
    expect(await runSupportAiJob(h.db, { ticketId: t.id, messageId: await lastStudentMessageId(t.id) }, { fetchImpl: fakeClaude([text('x')]).impl })).toEqual({ skipped: 'paused' })
    await expect(setTicketAiPaused(h.db, student, t.id, false)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await setTicketAiPaused(h.db, admin, t.id, false)
    const [row] = await h.db.select({ aiPaused: supportTickets.aiPaused }).from(supportTickets).where(eq(supportTickets.id, t.id))
    expect(row!.aiPaused).toBe(false)
  })

  it('التجربة على أرقام: ردّ لصاحب الرقم، ومسودّة لغيره', async () => {
    await setMode('PILOT', { pilotPhones: '0661234567' })
    const a = await openTicket(h.db, student, { kind: 'OTHER', subject: 'تجربة', body: 'سؤال' })
    const b = await openTicket(h.db, other, { kind: 'OTHER', subject: 'تجربة', body: 'سؤال' })
    expect(await runSupportAiJob(h.db, { ticketId: a.id, messageId: await lastStudentMessageId(a.id) }, { fetchImpl: fakeClaude([text('جواب')]).impl })).toMatchObject({ posted: 'reply' })
    expect(await runSupportAiJob(h.db, { ticketId: b.id, messageId: await lastStudentMessageId(b.id) }, { fetchImpl: fakeClaude([text('جواب')]).impl })).toMatchObject({ posted: 'draft' })
  })

  it('موظف ردّ بنفسه في التذكرة: المساعد يقترح فقط', async () => {
    await setMode('ALL')
    const t = await openTicket(h.db, student, { kind: 'OTHER', subject: 'موظف هنا', body: 'سؤال' })
    await replyTicket(h.db, admin, t.id, 'أنا معك.')
    await replyTicket(h.db, student, t.id, 'شكرًا، وسؤال آخر')
    expect(await runSupportAiJob(h.db, { ticketId: t.id, messageId: await lastStudentMessageId(t.id) }, { fetchImpl: fakeClaude([text('جواب')]).impl })).toMatchObject({ posted: 'draft' })
  })

  it('الحدود: الحدّ اليومي، وبلا مفتاح Anthropic، والتذكرة الحساسة', async () => {
    await setMode('ALL', { dailyLimit: 0 })
    const t = await openTicket(h.db, student, { kind: 'OTHER', subject: 'حدّ', body: 'سؤال' })
    const mid = await lastStudentMessageId(t.id)
    expect(await runSupportAiJob(h.db, { ticketId: t.id, messageId: mid }, { fetchImpl: fakeClaude([text('x')]).impl })).toEqual({ skipped: 'daily_limit' })

    await setMode('ALL')
    setAiRuntimeConfig({ provider: 'openai', apiKey: 'sk-openai-0123456789abcdefghij', model: null })
    expect(await runSupportAiJob(h.db, { ticketId: t.id, messageId: mid }, { fetchImpl: fakeClaude([text('x')]).impl })).toEqual({ skipped: 'no_key' })
    setAiRuntimeConfig({ provider: 'anthropic', apiKey: KEY, model: null })

    const s = await openTicket(h.db, student, { kind: 'TEACHER', subject: 'حساسة', body: 'شكوى' })
    expect(await runSupportAiJob(h.db, { ticketId: s.id, messageId: await lastStudentMessageId(s.id) }, { fetchImpl: fakeClaude([text('x')]).impl })).toEqual({ skipped: 'sensitive' })

    const today = await supportAiToday(h.db)
    expect(today.replies).toBeGreaterThanOrEqual(5)
  })

  it('مفتاح مرفوض (401): خطأ نهائي بلا إعادة، ولا رسالة', async () => {
    await setMode('ALL')
    const t = await openTicket(h.db, student, { kind: 'OTHER', subject: 'مفتاح', body: 'سؤال' })
    const fake = fakeClaude([{ type: 'error', error: { type: 'authentication_error' } }], 401)
    await expect(runSupportAiJob(h.db, { ticketId: t.id, messageId: await lastStudentMessageId(t.id) }, { fetchImpl: fake.impl })).rejects.toMatchObject({ permanent: true })
    const v = await getTicket(h.db, admin, t.id)
    expect(v.messages.some((m) => m.isAi)).toBe(false)
  })

  it('المشرف الذي فعّله لم يعد مشرفًا: يتوقف المساعد', async () => {
    await setMode('ALL')
    const [row] = await h.db.select().from(appSettings).where(eq(appSettings.key, 'support_ai'))
    await h.db.update(appSettings).set({ value: { ...(row!.value as object), botUserId: student.userId } }).where(eq(appSettings.key, 'support_ai'))
    const t = await openTicket(h.db, student, { kind: 'OTHER', subject: 'بوت', body: 'سؤال' })
    expect(await runSupportAiJob(h.db, { ticketId: t.id, messageId: await lastStudentMessageId(t.id) }, { fetchImpl: fakeClaude([text('x')]).impl })).toEqual({ skipped: 'no_bot' })
  })
})
