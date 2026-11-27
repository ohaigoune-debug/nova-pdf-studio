/**
 * كشف التسريب (3 نوفمبر 2026): من العلامة المائية إلى الحساب، مع ترجيح من شاهد في اليوم الظاهر.
 */
import { eq } from 'drizzle-orm'
import { PDFDocument } from 'pdf-lib'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { auditLogs, mediaViews, profiles } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { createContent } from '@/server/services/content.service'
import { parseLeakQuery, scanLeakedPdfFor, traceLeak } from '@/server/services/leak-trace.service'
import { formatLeakRef, leakFootnotesOf, leakMarkOf, leakRefOf } from '@/server/lib/leak-ref'
import { resolveMediaAccess, stampPdf } from '@/server/services/media.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb } from './helpers'

let h: DatabaseHandle
let admin: Actor
let teacher: Actor
let leaker: Actor
let sameTail: Actor
let contentId: string

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin)
  leaker = await makeStudent(h.db, 'تلميذ مسرّب')
  sameTail = await makeStudent(h.db, 'تلميذ آخر')
  await h.db.update(profiles).set({ phone: '0661001234' }).where(eq(profiles.userId, leaker.userId))
  await h.db.update(profiles).set({ phone: '0770551234' }).where(eq(profiles.userId, sameTail.userId))
  contentId = (await createContent(h.db, teacher, { title: 'درس البلاغة المحمي', type: 'LESSON', body: 'نص', visibility: 'PUBLIC', publish: true })).id
  await h.db.insert(mediaViews).values({
    contentId, userId: leaker.userId, studentId: leaker.studentId, viewerKey: 'ios-abcdef0123456789', ip: '41.105.1.2', userAgent: 'Madrasadz iPhone',
    startedAt: new Date('2026-11-03T09:10:00Z'), lastSeenAt: new Date('2026-11-03T09:40:00Z'), secondsWatched: 1800
  })
  await h.db.insert(mediaViews).values({
    contentId, userId: sameTail.userId, studentId: sameTail.studentId, viewerKey: 'web-1234567890', ip: '41.105.9.9',
    startedAt: new Date('2026-10-20T09:10:00Z'), lastSeenAt: new Date('2026-10-20T09:20:00Z'), secondsWatched: 600
  })
})
afterAll(async () => h.close())

describe('قراءة القرينة', () => {
  it('تفهم ما يُنسخ من العلامة كما هو', () => {
    expect(parseLeakQuery('2026-11-03 · 4B21EFBC')).toEqual({ kind: 'code', value: '4b21efbc', date: '2026-11-03' })
    expect(parseLeakQuery('…1234 · 2026-11-03')).toEqual({ kind: 'phone', value: '1234', date: '2026-11-03' })
    expect(parseLeakQuery('…١٢٣٤', '2026-11-02')).toEqual({ kind: 'phone', value: '1234', date: '2026-11-02' })
    expect(parseLeakQuery(' Student@Test.dz ')).toEqual({ kind: 'email', value: 'student@test.dz', date: null })
    expect(parseLeakQuery('تلميذ مسرّب')).toEqual({ kind: 'name', value: 'تلميذ مسرّب', date: null })
    expect(() => parseLeakQuery('ab')).toThrow(AppError)
    expect(() => parseLeakQuery('4b21efbc', '03/11/2026')).toThrow(AppError)
  })
})

describe('الكشف', () => {
  it('برمز الحساب: الحساب وسجل مشاهدته وجهازه', async () => {
    const r = await traceLeak(h.db, admin, parseLeakQuery(`2026-11-03 · ${leaker.userId.slice(0, 8)}`))
    expect(r.matches).toHaveLength(1)
    const m = r.matches[0]!
    expect(m).toMatchObject({ userId: leaker.userId, fullName: 'تلميذ مسرّب', phone: '0661001234', viewedOnDate: true })
    expect(m.views).toEqual([expect.objectContaining({ contentTitle: 'درس البلاغة المحمي', secondsWatched: 1800, ip: '41.105.1.2', device: 'iPhone (التطبيق)' })])
    const [audit] = await h.db.select().from(auditLogs).where(eq(auditLogs.action, 'leak.trace'))
    expect(audit).toMatchObject({ actorUserId: admin.userId, entityId: leaker.userId })
    expect(JSON.stringify(audit!.newValue)).not.toContain('0661')
  })

  it('بآخر 4 أرقام مع التاريخ: من شاهد في ذلك اليوم أولًا', async () => {
    const r = await traceLeak(h.db, admin, parseLeakQuery('…1234', '2026-11-03'))
    expect(r.matches.map((m) => m.userId)).toEqual([leaker.userId, sameTail.userId])
    expect(r.matches.map((m) => m.viewedOnDate)).toEqual([true, false])
    expect(r.matches[1]!.views).toEqual([])
  })

  it('برمز النسخة المكتوب في ملف PDF: نفس الحساب حتى بعد حذف العلامة المائية', async () => {
    const access = await resolveMediaAccess(h.db, leaker, contentId)
    expect(access.leakMark).toEqual(leakMarkOf(leaker.userId))
    const r = await traceLeak(h.db, admin, parseLeakQuery(`Ref. ${formatLeakRef(access.leakMark!.ref).toLowerCase()}`, '2026-11-03'))
    expect(r.query.kind).toBe('ref')
    expect(r.matches).toHaveLength(1)
    expect(r.matches[0]).toMatchObject({ userId: leaker.userId, ref: formatLeakRef(access.leakMark!.ref), viewedOnDate: true })
    expect((await resolveMediaAccess(h.db, null, contentId)).leakMark).toBeNull()
    expect((await traceLeak(h.db, admin, parseLeakQuery('Ref. ZZZZ-ZZ'))).matches.filter((m) => m.userId === leaker.userId)).toEqual([])
  })

  it('بأرقام التهميش المنقولة من الصورة بترتيبها — مفصولةً أو ملتصقة (8 أرقام)', async () => {
    const nums = leakFootnotesOf(leaker.userId).slice(0, 4)
    const r = await traceLeak(h.db, admin, parseLeakQuery(nums.map((n) => `(${n})`).join(' '), '2026-11-03'))
    expect(r.query).toEqual({ kind: 'fn', value: nums.join(' '), date: '2026-11-03' })
    expect(r.matches.map((m) => m.userId)).toEqual([leaker.userId])
    expect(r.matches[0]!.footnotes).toEqual(nums)
    const glued = await traceLeak(h.db, admin, parseLeakQuery(nums.join('')))
    expect(glued.query.kind).toBe('code')
    expect(glued.matches.map((m) => m.userId)).toContain(leaker.userId)
    // ترتيب خاطئ لا يطابق
    expect((await traceLeak(h.db, admin, parseLeakQuery([nums[1], nums[0], nums[2], nums[3]].join(' ')))).matches.map((m) => m.userId)).not.toContain(leaker.userId)
  })

  it('فحص ملف مسرَّب: للمشرف وحده، ويُسجَّل دون بيانات شخصية', async () => {
    const doc = await PDFDocument.create()
    doc.addPage([595, 842])
    const stamped = await stampPdf(Buffer.from(await doc.save()), ['x@test.dz', '2026-11-03 · abcdef12'], leakMarkOf(leaker.userId))
    const r = await scanLeakedPdfFor(h.db, admin, stamped)
    expect(r.ref).toBe(leakRefOf(leaker.userId))
    const [audit] = await h.db.select().from(auditLogs).where(eq(auditLogs.action, 'leak.scan'))
    expect(audit).toMatchObject({ actorUserId: admin.userId })
    expect(JSON.stringify(audit!.newValue)).not.toContain(leakRefOf(leaker.userId))
    await expect(scanLeakedPdfFor(h.db, teacher, stamped)).rejects.toSatisfy((e) => e instanceof AppError && e.code === 'FORBIDDEN')
  })

  it('للمشرف العام وحده', async () => {
    await expect(traceLeak(h.db, teacher, parseLeakQuery('…1234'))).rejects.toSatisfy((e) => e instanceof AppError && e.code === 'FORBIDDEN')
    await expect(traceLeak(h.db, leaker, parseLeakQuery('…1234'))).rejects.toSatisfy((e) => e instanceof AppError && e.code === 'FORBIDDEN')
  })
})
