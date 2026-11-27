/** مركز الاتصال الذكي (27 نوفمبر 2026): القواعد، الطابور، الصندوق المحلي (محاكًى)، والموظف. PGlite فقط، بلا شبكة ولا مكالمات. */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  DEFAULT_CALL_CENTER,
  actionFor,
  dzMinuteOfDay,
  nextCallingTime,
  readCallCenterConfig,
  renderText,
  retryAt,
  withinCallingHours
} from '@/lib/call-center'
import type { DatabaseHandle } from '@/server/db/connect'
import { ccAttempts, ccInbound, ccTasks, deliveryEvents, orders, students } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { setSmsSenderForTests, type SmsMessage } from '@/server/lib/sms'
import {
  _setCallCenterConfigForTests,
  authorizeAgent,
  callCenterOverview,
  claimAgentTasks,
  getCallCenterConfig,
  listHumanQueue,
  listInbound,
  planCallCenter,
  readRecording,
  recordInbound,
  reportAgentResult,
  resolveHumanTask,
  resolveInbound,
  rotateAgentToken,
  saveCallCenterSettings,
  simulateAgentRound
} from '@/server/services/call-center.service'
import { createConfirmer } from '@/server/services/confirmer.service'
import { actorOf, makeAdmin, makeStudent, setupDb, uniq } from './helpers'

/** 10:00 بتوقيت الجزائر (UTC+1) — في المستقبل حتى تكون كل المهامّ المنشأة «الآن» مستحقة */
const BASE = new Date('2031-03-03T09:00:00Z')
const H = 3_600_000
const at = (ms: number) => new Date(BASE.getTime() + ms)

const GUARDIAN = '0770000001'
const STUDENT_PHONE = '0660000001'
const OWNER = '0550000009'
const STRANGER = '0660000003'

let h: DatabaseHandle
let admin: Actor
let confirmer: Actor
let student: Actor
const sent: SmsMessage[] = []

beforeAll(async () => {
  process.env.UPLOADS_DIR = mkdtempSync(join(tmpdir(), 'cc-uploads-'))
  h = await setupDb()
  admin = await makeAdmin(h.db)
  student = await makeStudent(h.db, 'تلميذ مركز الاتصال')
  await h.db.update(students).set({ guardianPhone: '+213 770 000 001' }).where(eq(students.userId, student.userId))
  const employee = await createConfirmer(h.db, admin, { email: uniq('cc-employee') + '@test.dz', password: 'Worker@12345', fullName: 'موظف مركز الاتصال', phone: '+213661234599' })
  confirmer = await actorOf(h.db, employee.userId)
  setSmsSenderForTests({ name: 'test', send: async (m) => void sent.push(m) })
})
afterAll(async () => {
  setSmsSenderForTests(null)
  await h?.close()
})

async function makeOrder(o: { phone: string; status?: string; deliveryType?: 'HOME' | 'DESK'; totalDzd?: number; createdAt?: Date; shipped?: boolean }) {
  const [row] = await h.db
    .insert(orders)
    .values({
      number: uniq('MD'),
      userId: student.userId,
      status: o.status ?? 'SHIPPED',
      paymentMethod: 'COD',
      needsShipping: true,
      customerName: 'تلميذ مركز الاتصال',
      phone: o.phone,
      deliveryType: o.deliveryType ?? 'HOME',
      deliveryProvider: o.shipped === false ? null : 'ecotrack',
      deliveryTrackingId: o.shipped === false ? null : uniq('TRK'),
      totalDzd: o.totalDzd ?? 3000,
      createdAt: o.createdAt ?? at(-24 * H),
      updatedAt: BASE
    })
    .returning()
  return row!
}

async function event(o: typeof orders.$inferSelect, eco: string, when: Date, location: string | null = null) {
  const status = eco === 'failed_attempt' ? 'FAILED_ATTEMPT' : 'IN_TRANSIT'
  await h.db.insert(deliveryEvents).values({
    provider: 'ecotrack',
    externalId: `${o.deliveryTrackingId}:${status}:${eco}`,
    trackingId: o.deliveryTrackingId,
    orderId: o.id,
    status,
    payload: { ecotrackStatus: eco, label: eco === 'failed_attempt' ? 'Suspendu' : 'En livraison', events: [{ status: eco, description: eco, location, occurredAt: when.toISOString() }] },
    receivedAt: when
  })
}

const tasksOf = (orderId: string) => h.db.select().from(ccTasks).where(eq(ccTasks.orderId, orderId))

describe('القواعد النقية', () => {
  it('الإعداد الافتراضي: متوقف، 3 شرائح صادرة وواحدة واردة، 50 مكالمة، 9:00–20:00', () => {
    const c = readCallCenterConfig(undefined)
    expect(c).toMatchObject({ mode: 'off', outboundSims: [1, 2, 3], inboundSim: 4, dailyCapPerSim: 50, quietStart: 540, quietEnd: 1200, maxCallAttempts: 3, homeStuckHours: 48, smsChannel: 'provider' })
    expect(c.rules).toEqual(DEFAULT_CALL_CENTER.rules)
  })
  it('القيم الفاسدة تعود إلى الافتراضي، والأرقام تُوحَّد', () => {
    const c = readCallCenterConfig({ mode: 'boom', outboundSims: ['x', 0, 99], quietStart: 1300, quietEnd: 600, testPhones: ['+213 550 000 009', 'abc', '0550000009'], dailyCapPerSim: -3 })
    expect(c.mode).toBe('off')
    expect(c.outboundSims).toEqual([1, 2, 3])
    expect([c.quietStart, c.quietEnd]).toEqual([540, 1200])
    expect(c.testPhones).toEqual(['0550000009'])
    expect(c.dailyCapPerSim).toBe(50)
  })
  it('ساعات الاتصال بتوقيت الجزائر', () => {
    const cfg = { quietStart: 540, quietEnd: 1200 }
    expect(dzMinuteOfDay(BASE)).toBe(600)
    expect(withinCallingHours(cfg, new Date('2031-03-03T07:30:00Z'))).toBe(false) // 08:30
    expect(withinCallingHours(cfg, new Date('2031-03-03T08:00:00Z'))).toBe(true) // 09:00
    expect(withinCallingHours(cfg, new Date('2031-03-03T19:00:00Z'))).toBe(false) // 20:00
    expect(nextCallingTime(cfg, new Date('2031-03-03T20:00:00Z')).toISOString()).toBe('2031-03-04T08:00:00.000Z') // 21:00 ⇒ الغد 09:00
    expect(nextCallingTime(cfg, new Date('2031-03-03T05:00:00Z')).toISOString()).toBe('2031-03-03T08:00:00.000Z') // 06:00 ⇒ 09:00
  })
  it('إعادة المحاولة: بعد ساعتين، ثم بداية الغد؛ والمتأخرة ليلًا تنتظر الصباح', () => {
    const cfg = { quietStart: 540, quietEnd: 1200, retryDelaysMinutes: [120, 1440] }
    expect(retryAt(cfg, 1, BASE).toISOString()).toBe('2031-03-03T11:00:00.000Z') // 12:00
    expect(retryAt(cfg, 2, BASE).toISOString()).toBe('2031-03-04T08:00:00.000Z') // الغد 09:00
    expect(retryAt(cfg, 1, new Date('2031-03-03T18:30:00Z')).toISOString()).toBe('2031-03-04T08:00:00.000Z') // 19:30 + ساعتان = 21:30 ⇒ الغد
  })
  it('الأزرار والنصوص', () => {
    expect(actionFor('SUSPENDED', '1')).toBe('REDELIVER')
    expect(actionFor('SUSPENDED', '2')).toBe('SWITCH_DESK')
    expect(actionFor('CONFIRM_SPECIAL', '1')).toBe('CONFIRM')
    expect(actionFor('CONFIRM_SPECIAL', '3')).toBeNull()
    expect(actionFor('SUSPENDED', null)).toBeNull()
    expect(renderText('طردكم {order} في المكتب{office}.', { order: 'MD-1', office: '' })).toBe('طردكم MD-1 في المكتب.')
  })
})

describe('مركز الاتصال مع القاعدة', () => {
  it('متوقف افتراضيًا: لا مهامّ ولا رسائل', async () => {
    const o = await makeOrder({ phone: STUDENT_PHONE })
    await event(o, 'failed_attempt', at(-H))
    expect((await planCallCenter(h.db, BASE)).skipped).toBe('off')
    expect(await tasksOf(o.id)).toHaveLength(0)
    expect(await claimAgentTasks(h.db, await getCallCenterConfig(h.db), { now: BASE })).toEqual([])
    await h.db.update(orders).set({ status: 'DELIVERED' }).where(eq(orders.id, o.id)) // لا يتدخّل في بقية الاختبارات
  })

  it('الحفظ: شريحة الوارد ليست صادرة، ووضع التجربة يحتاج رقمًا، والتشغيل يسجّل وقته', async () => {
    await expect(saveCallCenterSettings(h.db, admin, { mode: 'test', testPhones: [OWNER], outboundSims: [1, 2, 3], inboundSim: 2 })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(saveCallCenterSettings(h.db, admin, { mode: 'test', testPhones: [] })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(saveCallCenterSettings(h.db, student, { mode: 'live' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const c = await saveCallCenterSettings(h.db, admin, { mode: 'test', testPhones: [GUARDIAN, STUDENT_PHONE, OWNER] })
    expect(c.mode).toBe('test')
    expect(c.enabledAt).toBeTruthy()
    expect(c.agent).not.toHaveProperty('tokenHash')
    // نثبّت وقت التشغيل قبل BASE بعشرة أيام لنتحكّم في الزمن
    await _setCallCenterConfigForTests(h.db, { enabledAt: at(-10 * 24 * H).toISOString() })
  })

  it('«معلّقة» ⇒ مكالمة للولي، تُعاد بعد ساعتين ثم في الغد، ثم التلميذ، ثم الموظف', async () => {
    const o = await makeOrder({ phone: STUDENT_PHONE })
    await event(o, 'failed_attempt', at(-H))
    const plan = await planCallCenter(h.db, BASE)
    expect(plan.created).toBeGreaterThanOrEqual(1)
    let [task] = await tasksOf(o.id)
    expect(task).toMatchObject({ kind: 'CALL', rule: 'SUSPENDED_CALL', target: 'GUARDIAN', phone: GUARDIAN, status: 'QUEUED', simulated: false, script: 'SUSPENDED' })
    // لا تكرار في الدورة التالية
    await planCallCenter(h.db, BASE)
    expect(await tasksOf(o.id)).toHaveLength(1)

    const cfg = await getCallCenterConfig(h.db)
    const [first] = await claimAgentTasks(h.db, cfg, { now: BASE })
    expect(first).toMatchObject({ id: task!.id, kind: 'CALL', dial: '+213770000001', script: 'SUSPENDED', digits: ['1', '2', '3'] })
    expect([1, 2, 3]).toContain(first!.simSlot)
    expect(await reportAgentResult(h.db, cfg, first!.id, { outcome: 'NO_ANSWER' }, BASE)).toEqual({ status: 'QUEUED', action: null })
    ;[task] = await tasksOf(o.id)
    expect(task!.runAfter.toISOString()).toBe(at(2 * H).toISOString())
    // قبل الموعد: لا شيء
    expect(await claimAgentTasks(h.db, cfg, { now: at(H) })).toEqual([])

    const [second] = await claimAgentTasks(h.db, cfg, { now: at(2 * H) })
    expect(second!.simSlot).toBe(first!.simSlot) // الشريحة نفسها دائمًا
    await reportAgentResult(h.db, cfg, second!.id, { outcome: 'BUSY' }, at(2 * H))
    ;[task] = await tasksOf(o.id)
    expect(task!.runAfter.toISOString()).toBe('2031-03-04T08:00:00.000Z')

    const [third] = await claimAgentTasks(h.db, cfg, { now: new Date('2031-03-04T08:00:00Z') })
    expect(await reportAgentResult(h.db, cfg, third!.id, { outcome: 'NO_ANSWER' }, new Date('2031-03-04T08:00:00Z'))).toEqual({ status: 'FAILED', action: 'FALLBACK_STUDENT' })
    const all = await tasksOf(o.id)
    expect(all).toHaveLength(2)
    const fallback = all.find((t) => t.target === 'STUDENT')!
    expect(fallback).toMatchObject({ phone: STUDENT_PHONE, status: 'QUEUED', rule: 'SUSPENDED_CALL' })
    expect(fallback.context).toContain('الولي لم يردّ')

    const [toStudent] = await claimAgentTasks(h.db, cfg, { now: new Date('2031-03-04T10:00:00Z') })
    expect(toStudent!.phone).toBe(STUDENT_PHONE)
    expect(await reportAgentResult(h.db, cfg, toStudent!.id, { outcome: 'ANSWERED', digit: '2', durationSec: 31 }, new Date('2031-03-04T10:00:00Z'))).toEqual({ status: 'DONE', action: 'SWITCH_DESK' })
    // نتيجة مكرّرة لا تُطبَّق مرتين
    expect(await reportAgentResult(h.db, cfg, toStudent!.id, { outcome: 'NO_ANSWER' })).toEqual({ status: 'DONE', action: 'SWITCH_DESK' })

    const queue = await listHumanQueue(h.db, confirmer)
    const item = queue.find((q) => q.id === toStudent!.id)!
    expect(item.humanReason).toContain('المكتب')
    expect(item.orderNumber).toBe(o.number)
    await resolveHumanTask(h.db, confirmer, item.id, 'حوّلته إلى المكتب عند 48HR')
    expect((await listHumanQueue(h.db, confirmer)).map((q) => q.id)).not.toContain(item.id)
    await expect(resolveHumanTask(h.db, confirmer, item.id, '')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    // كل محاولة مسجّلة
    expect(await h.db.select().from(ccAttempts).where(eq(ccAttempts.taskId, task!.id))).toHaveLength(3)
  })

  it('«جارية» إلى المكتب ⇒ رسالة فيها رقم الطلب والمكتب، مرة واحدة', async () => {
    const o = await makeOrder({ phone: OWNER, deliveryType: 'DESK' })
    await event(o, 'at_agency', at(-2 * H), 'Bou Saada')
    const before = sent.length
    const plan = await planCallCenter(h.db, BASE)
    expect(plan.smsSent).toBeGreaterThanOrEqual(1)
    const msg = sent.slice(before).find((m) => m.to === OWNER)!
    expect(msg.text).toContain(o.number)
    expect(msg.text).toContain('Bou Saada')
    const [t] = await tasksOf(o.id)
    expect(t).toMatchObject({ kind: 'SMS', rule: 'DESK_ARRIVED_SMS', status: 'DONE', outcome: 'SENT' })
    await planCallCenter(h.db, at(H))
    expect(sent.filter((m) => m.to === OWNER && m.text.includes(o.number))).toHaveLength(1)
  })

  it('وضع التجربة: رقم ليس من أرقامي ⇒ «محاكاة» بلا رسالة ولا مكالمة؛ والمنزل بعد 48 ساعة ⇒ مكالمة', async () => {
    const o = await makeOrder({ phone: STRANGER, deliveryType: 'HOME' })
    await h.db.update(students).set({ guardianPhone: null }).where(eq(students.userId, student.userId))
    await event(o, 'out_for_delivery', at(-50 * H))
    const before = sent.length
    await planCallCenter(h.db, BASE)
    expect(sent.length).toBe(before)
    const tasks = await tasksOf(o.id)
    expect(tasks.map((t) => t.rule).sort()).toEqual(['HOME_ARRIVED_SMS', 'HOME_STUCK_CALL'])
    for (const t of tasks) expect(t).toMatchObject({ simulated: true, status: 'DONE', outcome: 'SIMULATED' })
    expect(tasks.find((t) => t.rule === 'HOME_STUCK_CALL')!.target).toBe('ORDER') // لا ولي ⇒ هاتف الطلب
    await h.db.update(students).set({ guardianPhone: GUARDIAN }).where(eq(students.userId, student.userId))
  })

  it('أحداث 48HR التي سبقت التشغيل لا تُنتج شيئًا، وتوصيل المنزل قبل 48 ساعة لا مكالمة له', async () => {
    const old = await makeOrder({ phone: OWNER })
    await event(old, 'failed_attempt', at(-11 * 24 * H))
    const fresh = await makeOrder({ phone: OWNER, deliveryType: 'HOME' })
    await event(fresh, 'out_for_delivery', at(-5 * H))
    await planCallCenter(h.db, BASE)
    expect(await tasksOf(old.id)).toHaveLength(0)
    expect((await tasksOf(fresh.id)).map((t) => t.rule)).toEqual(['HOME_ARRIVED_SMS'])
  })

  it('تأكيد الحالات الخاصة: مبلغ مرتفع ⇒ مكالمة؛ الزر 1 يؤكّد الطلب', async () => {
    const o = await makeOrder({ phone: OWNER, status: 'PENDING', totalDzd: 9000, createdAt: at(-H), shipped: false })
    const normal = await makeOrder({ phone: OWNER, status: 'PENDING', totalDzd: 2000, createdAt: at(-H), shipped: false })
    await planCallCenter(h.db, BASE)
    const [t] = await tasksOf(o.id)
    expect(t).toMatchObject({ rule: 'CONFIRM_SPECIAL_CALL', target: 'ORDER', phone: OWNER, script: 'CONFIRM_SPECIAL' })
    expect(t!.context).toContain('مبلغ مرتفع')
    expect(await tasksOf(normal.id)).toHaveLength(0) // رمز OTP يكفيه
    const cfg = await getCallCenterConfig(h.db)
    const claimed = await claimAgentTasks(h.db, cfg, { now: at(3 * H), limit: 10 })
    const mine = claimed.find((c) => c.id === t!.id)!
    expect(mine.digits).toEqual(['1', '2'])
    expect(await reportAgentResult(h.db, cfg, mine.id, { outcome: 'ANSWERED', digit: '1' }, at(3 * H))).toEqual({ status: 'DONE', action: 'CONFIRM' })
    expect((await h.db.select().from(orders).where(eq(orders.id, o.id)))[0]!.status).toBe('CONFIRMED')
    for (const c of claimed.filter((c) => c.id !== t!.id)) await reportAgentResult(h.db, cfg, c.id, { outcome: 'ANSWERED', digit: '3' }, at(3 * H))
  })

  it('المكالمة التي لم تعد في محلّها (أُكِّد الطلب يدويًا) تُلغى قبل الاتصال', async () => {
    const o = await makeOrder({ phone: GUARDIAN, status: 'PENDING', totalDzd: 9500, createdAt: at(-H), shipped: false })
    await planCallCenter(h.db, BASE)
    await h.db.update(orders).set({ status: 'CONFIRMED' }).where(eq(orders.id, o.id))
    const claimed = await claimAgentTasks(h.db, await getCallCenterConfig(h.db), { now: at(4 * H), limit: 10 })
    expect(claimed.map((c) => c.id)).not.toContain((await tasksOf(o.id))[0]!.id)
    expect((await tasksOf(o.id))[0]!.status).toBe('CANCELLED')
  })

  it('السقف اليومي لكل شريحة وساعات الاتصال', async () => {
    await _setCallCenterConfigForTests(h.db, { dailyCapPerSim: 1, outboundSims: [5, 6], inboundSim: 4 })
    const cfg = await getCallCenterConfig(h.db)
    const day = new Date('2031-03-10T09:00:00Z')
    for (const phone of [GUARDIAN, STUDENT_PHONE, OWNER]) await h.db.insert(ccTasks).values({ kind: 'CALL', rule: 'SUSPENDED_CALL', dedupeKey: uniq('cap'), target: 'ORDER', phone, script: 'SUSPENDED', runAfter: day })
    expect(await claimAgentTasks(h.db, cfg, { now: new Date('2031-03-10T20:30:00Z') })).toEqual([]) // 21:30 بالجزائر
    // الشرائح القديمة لهذه الأرقام (1..3) لم تعد صادرة ⇒ تُختار من الجديدة
    const claimed = await claimAgentTasks(h.db, cfg, { now: day, limit: 10 })
    expect(claimed.map((c) => c.simSlot).sort()).toEqual([5, 6])
    expect(await claimAgentTasks(h.db, cfg, { now: day, limit: 10 })).toEqual([]) // الشريحتان بلغتا السقف
    for (const c of claimed) await reportAgentResult(h.db, cfg, c.id, { outcome: 'ANSWERED', digit: '1' }, day)
    expect((await callCenterOverview(h.db, confirmer, day)).today.perSim).toEqual([
      { slot: 5, calls: 1, cap: 1 },
      { slot: 6, calls: 1, cap: 1 }
    ])
    await _setCallCenterConfigForTests(h.db, { dailyCapPerSim: 50, outboundSims: [1, 2, 3] })
  })

  it('الصندوق انقطع أثناء المكالمة: الحجز ينتهي فتُعاد المهمة', async () => {
    const cfg = await getCallCenterConfig(h.db)
    const day = new Date('2031-03-12T09:00:00Z')
    await h.db.update(ccTasks).set({ status: 'CANCELLED' }).where(eq(ccTasks.status, 'QUEUED')) // بقايا الاختبارات السابقة
    const [row] = await h.db.insert(ccTasks).values({ kind: 'CALL', rule: 'SUSPENDED_CALL', dedupeKey: uniq('lease'), target: 'ORDER', phone: OWNER, script: 'SUSPENDED', runAfter: day }).returning()
    const [c] = await claimAgentTasks(h.db, cfg, { now: day })
    expect(c!.id).toBe(row!.id)
    const plan = await planCallCenter(h.db, new Date(day.getTime() + 11 * 60_000))
    expect(plan.expired).toBe(1)
    const [after] = await h.db.select().from(ccTasks).where(eq(ccTasks.id, row!.id))
    expect(after).toMatchObject({ status: 'QUEUED', outcome: 'FAILED', attempts: 1 })
  })

  it('المكالمة الواردة: الاختيار والرسالة الصوتية والطلب المطابق، ورسالة شرح للخيار 2', async () => {
    const cfg = await getCallCenterConfig(h.db)
    const audio = Buffer.from('RIFF0000WAVEfmt fake audio')
    const r = await recordInbound(h.db, cfg, { phone: '+213550000009', simSlot: 4, choice: '2', durationSec: 42, recording: { bytes: audio, mime: 'audio/wav' } })
    expect(r.replySms).toBe(true)
    const [row] = await h.db.select().from(ccInbound).where(eq(ccInbound.id, r.id))
    expect(row).toMatchObject({ phone: OWNER, choice: '2', status: 'NEW', simSlot: 4, recordingMime: 'audio/wav' })
    expect(row!.orderId).toBeTruthy()
    const [reply] = await h.db.select().from(ccTasks).where(and(eq(ccTasks.rule, 'INBOUND_REPLY_SMS'), eq(ccTasks.phone, OWNER)))
    expect(reply).toMatchObject({ kind: 'SMS', target: 'CALLER' })
    const listed = (await listInbound(h.db, confirmer)).find((x) => x.id === r.id)!
    expect(listed.hasRecording).toBe(true)
    expect(listed).not.toHaveProperty('recordingKey')
    expect((await readRecording(h.db, confirmer, r.id)).bytes.equals(audio)).toBe(true)
    await expect(readRecording(h.db, student, r.id)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await resolveInbound(h.db, confirmer, r.id, 'شرحت له التفعيل')
    expect((await listInbound(h.db, confirmer)).map((x) => x.id)).not.toContain(r.id)
    await expect(recordInbound(h.db, cfg, { phone: OWNER, recording: { bytes: Buffer.from('x'), mime: 'application/pdf' } })).rejects.toMatchObject({ code: 'FILE_TYPE_NOT_ALLOWED' })
    await expect(recordInbound(h.db, cfg, { phone: '123' })).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('رمز الصندوق: يُعرض مرة، وتُحفظ بصمته فقط، والقديم يتوقف', async () => {
    expect(await authorizeAgent(h.db, 'Bearer nothing')).toBeNull()
    const { token } = await rotateAgentToken(h.db, admin)
    expect(await authorizeAgent(h.db, `Bearer ${token}`)).not.toBeNull()
    expect(JSON.stringify(await getCallCenterConfig(h.db))).not.toContain(token)
    const second = await rotateAgentToken(h.db, admin)
    expect(await authorizeAgent(h.db, `Bearer ${token}`)).toBeNull()
    expect(await authorizeAgent(h.db, second.token)).not.toBeNull()
    await expect(rotateAgentToken(h.db, confirmer)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('مزوّد بقوالب فقط (SuiviSMS الحيّ): رسالة التوصيل لا تخرج منه مشوّهة، وتبقى في الطابور', async () => {
    setSmsSenderForTests({ name: 'suivisms', send: async () => { throw new Error('must not send free text') } })
    try {
      const o = await makeOrder({ phone: OWNER, deliveryType: 'DESK' })
      await event(o, 'at_agency', new Date('2031-03-15T08:00:00Z'))
      const plan = await planCallCenter(h.db, new Date('2031-03-15T09:00:00Z'))
      expect(plan.smsFailed).toBe(0)
      const [t] = await tasksOf(o.id)
      expect(t).toMatchObject({ kind: 'SMS', status: 'QUEUED', error: 'provider_template_only', attempts: 0 })
    } finally {
      setSmsSenderForTests({ name: 'test', send: async (m) => void sent.push(m) })
    }
  })

  it('المحاكي: من ردّ ولم يختر يذهب إلى الموظف؛ والتلميذ لا يرى اللوحة', async () => {
    const day = new Date('2031-03-14T09:00:00Z')
    const [row] = await h.db.insert(ccTasks).values({ kind: 'CALL', rule: 'SUSPENDED_CALL', dedupeKey: uniq('sim'), target: 'ORDER', phone: STUDENT_PHONE, script: 'SUSPENDED', runAfter: day }).returning()
    const r = await simulateAgentRound(h.db, { now: day, answerRate: 1, digit: null })
    expect(r.claimed).toBeGreaterThanOrEqual(1)
    const [after] = await h.db.select().from(ccTasks).where(eq(ccTasks.id, row!.id))
    expect(after).toMatchObject({ status: 'DONE', outcome: 'ANSWERED', resultAction: 'NO_CHOICE', needsHuman: true })
    await expect(callCenterOverview(h.db, student)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(listHumanQueue(h.db, student)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
