/**
 * منع الدفع عند الاستلام لمن أرجع طلبًا بلا سبب (قرار المالك 17 نوفمبر 2026):
 * قائمة نوفا المستوردة، ومرتجعات مدرسة نفسها، والإرجاع المعذور (طلب آخر سُلِّم خلال 7 أيام)، والإعفاء.
 */
import { readFileSync } from 'node:fs'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { codPhoneBlocks, profiles } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { blockPhone, codBlockFor, liftPhone, listCodBlocks, localPhone } from '@/server/services/cod-blocks.service'
import { placeCourseOrder, setCourseBook } from '@/server/services/course-purchase.service'
import { createCourse, setCourseStatus } from '@/server/services/courses.service'
import { transitionOrder } from '@/server/services/order-status.service'
import { makeAdmin, makeStudent, makeTeacher, refIds, setupDb, workspaceIdOfTeacher } from './helpers'

describe('صيغة الرقم', () => {
  it('يوحّد +213 والفراغات والأرقام التسعة', () => {
    expect(localPhone('+213 550 12 34 56')).toBe('0550123456')
    expect(localPhone('550123456')).toBe('0550123456')
    expect(localPhone('0550-12-34-56')).toBe('0550123456')
    expect(localPhone('0450123456')).toBeNull()
    expect(localPhone('')).toBeNull()
  })
})

describe('منع الدفع عند الاستلام', () => {
  let h: DatabaseHandle
  let admin: Actor
  let workspaceId: string
  let wilayaId: string
  let n = 0
  const phoneOf = () => `0661${String(100000 + ++n).slice(-6)}`

  beforeAll(async () => {
    h = await setupDb()
    admin = await makeAdmin(h.db)
    const teacher = await makeTeacher(h.db, admin, 'أستاذ المنع')
    workspaceId = await workspaceIdOfTeacher(h.db, teacher)
    wilayaId = (await refIds(h.db)).wilayaId!
  })

  afterAll(async () => {
    await h.close()
  })

  async function course() {
    const c = await createCourse(h.db, admin, { title: `دورة المنع ${++n}`, workspaceId, season: '2026/2027', status: 'DRAFT' })
    await setCourseBook(h.db, admin, c.id, { title: `كتاب ${n}`, priceDzd: 5900, stock: null, active: true })
    await setCourseStatus(h.db, admin, c.id, 'PUBLISHED')
    return c
  }

  const order = (s: Actor, courseId: string, phone: string) =>
    placeCourseOrder(h.db, s, { courseId, phone, wilayaId, address: 'حي النصر', deliveryType: 'HOME' } as Parameters<typeof placeCourseOrder>[2])
  const setStatus = (id: string, next: 'RETURNED' | 'DELIVERED') => transitionOrder(h.db, id, next, { source: 'admin', actorUserId: admin.userId, force: true, silent: true })

  it('رقم في قائمة نوفا: لا دفع عند الاستلام، ورسالة واضحة', async () => {
    const phone = phoneOf()
    await h.db.insert(codPhoneBlocks).values({ phone, source: 'NOVA', returns: 1, lastReturnAt: new Date('2026-05-01T10:00:00Z') })
    expect((await codBlockFor(h.db, [phone]))?.source).toBe('NOVA')
    const s = await makeStudent(h.db, 'تلميذ نوفا')
    await expect(order(s, (await course()).id, phone)).rejects.toMatchObject({ code: 'COD_BLOCKED' })
  })

  it('هاتف الحساب ممنوع: لا يكفي تغيير رقم الاستلام', async () => {
    const blocked = phoneOf()
    await h.db.insert(codPhoneBlocks).values({ phone: blocked, source: 'NOVA', returns: 2 })
    const s = await makeStudent(h.db, 'تلميذ برقمين')
    await h.db.update(profiles).set({ phone: blocked }).where(eq(profiles.userId, s.userId))
    await expect(order(s, (await course()).id, phoneOf())).rejects.toMatchObject({ code: 'COD_BLOCKED' })
  })

  it('مرتجع مدرسة بلا سبب يمنع الطلب التالي فورًا', async () => {
    const phone = phoneOf()
    const s = await makeStudent(h.db, 'تلميذ أرجع')
    const first = await order(s, (await course()).id, phone)
    await setStatus(first.id, 'RETURNED')
    expect(await codBlockFor(h.db, [phone])).toMatchObject({ source: 'MADRASA', returns: 1 })
    await expect(order(s, (await course()).id, phone)).rejects.toMatchObject({ code: 'COD_BLOCKED' })
  })

  it('إرجاع معذور: استلم طلبًا آخر خلال 7 أيام ⇒ لا منع', async () => {
    const phone = phoneOf()
    const s = await makeStudent(h.db, 'تلميذ بطلبين')
    const a = await order(s, (await course()).id, phone)
    const b = await order(s, (await course()).id, phone)
    await setStatus(b.id, 'DELIVERED')
    await setStatus(a.id, 'RETURNED')
    expect(await codBlockFor(h.db, [phone])).toBeNull()
  })

  it('الإعفاء يعيد الدفع عند الاستلام، ومرتجع جديد بلا سبب يمنع من جديد', async () => {
    const phone = phoneOf()
    const s = await makeStudent(h.db, 'تلميذ أُعفي')
    const first = await order(s, (await course()).id, phone)
    await setStatus(first.id, 'RETURNED')
    await liftPhone(h.db, admin, phone, 'اتصل واعتذر')
    expect(await codBlockFor(h.db, [phone])).toBeNull()
    const second = await order(s, (await course()).id, phone)
    await setStatus(second.id, 'RETURNED')
    expect(await codBlockFor(h.db, [phone])).toMatchObject({ source: 'MADRASA', returns: 1 })
  })

  it('إعفاء رقم نوفا ثم منعه يدويًا', async () => {
    const phone = phoneOf()
    await h.db.insert(codPhoneBlocks).values({ phone, source: 'NOVA', returns: 1 })
    await liftPhone(h.db, admin, phone)
    expect(await codBlockFor(h.db, [phone])).toBeNull()
    await blockPhone(h.db, admin, phone, 'رفض مرة أخرى')
    expect((await codBlockFor(h.db, [phone]))?.source).toBe('NOVA')
    const other = phoneOf()
    await blockPhone(h.db, admin, `+213${other.slice(1)}`)
    expect((await codBlockFor(h.db, [other]))?.source).toBe('ADMIN')
  })

  it('القائمة للمشرف وحده: تجمع نوفا واليدوي ومرتجعات مدرسة، وتبحث بالرقم', async () => {
    const all = await listCodBlocks(h.db, admin)
    expect(new Set(all.rows.map((r) => r.source))).toEqual(new Set(['NOVA', 'ADMIN', 'MADRASA']))
    const one = all.rows.find((r) => r.source === 'MADRASA')!
    const found = await listCodBlocks(h.db, admin, { q: one.phone })
    expect(found.rows.map((r) => r.phone)).toEqual([one.phone])
    const s = await makeStudent(h.db, 'تلميذ فضولي')
    await expect(listCodBlocks(h.db, s)).rejects.toThrow()
    await expect(blockPhone(h.db, s, phoneOf())).rejects.toThrow()
  })

  it('الرقم الصالح وحده يُقبل، والقاعدة ترفض غيره', async () => {
    await expect(blockPhone(h.db, admin, '12345')).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(h.db.insert(codPhoneBlocks).values({ phone: '12345', source: 'NOVA' })).rejects.toThrow()
  })

  it('المتجر أيضًا يرفض الدفع عند الاستلام لرقم ممنوع، واستمارة الدورة تعرض البطاقة وحدها', () => {
    const store = readFileSync('src/server/services/store.service.ts', 'utf8')
    expect(store).toContain("if (paymentMethod === 'COD') await assertCodAllowed(db, actor.userId, phone)")
    expect(store).toContain('codBlocked')
    const form = readFileSync('src/components/academy/course-order-form.tsx', 'utf8')
    expect(form).toContain('const cardOnly = codBlocked && Boolean(data.onlinePay)')
    expect(form).toContain('!(codBlocked && !payNow)')
  })
})
