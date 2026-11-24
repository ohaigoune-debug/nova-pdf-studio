import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { monthOf } from '@/lib/assistant-pay'
import type { Actor } from '@/server/lib/actor'
import { cancelInvoice, createManualInvoice } from '@/server/services/invoices.service'
import { platformRevenue } from '@/server/services/platform-revenue.service'
import { makeAdmin, makeTeacher, setupDb } from './helpers'

describe('مداخيل المنصة (قرار المالك 24 نوفمبر 2026)', () => {
  let h: DatabaseHandle
  let admin: Actor
  const month = monthOf(new Date())

  beforeAll(async () => {
    h = await setupDb()
    admin = await makeAdmin(h.db)
  })
  afterAll(async () => {
    await h.close()
  })

  it('المداخيل من الفواتير الصادرة فقط، ثمّ التوصيل، والصافي، وحسب الدفع والمنتج', async () => {
    await createManualInvoice(h.db, admin, { customerName: 'أ', lines: [{ title: 'دورة الأدب العربي', qty: 1, unitDzd: 3900 }], paymentMethod: 'CASH' })
    await createManualInvoice(h.db, admin, { customerName: 'ب', lines: [{ title: 'دورة الأدب العربي', qty: 1, unitDzd: 3900 }, { title: 'كتاب الخباش', qty: 2, unitDzd: 1000 }], shippingDzd: 400, paymentMethod: 'COD' })
    const cancelled = await createManualInvoice(h.db, admin, { customerName: 'ج', lines: [{ title: 'كتاب', qty: 1, unitDzd: 5000 }], paymentMethod: 'CASH' })
    await cancelInvoice(h.db, admin, cancelled.id, 'خطأ')

    const r = await platformRevenue(h.db, admin, month)
    expect(r).toMatchObject({ invoices: 2, grossDzd: 3900 + 6300, shippingDzd: 400, assistantPaidDzd: 0, assistantDueDzd: 0, netDzd: 10200 - 400 })
    expect(r.byMethod).toEqual([
      { method: 'COD', invoices: 1, totalDzd: 6300 },
      { method: 'CASH', invoices: 1, totalDzd: 3900 }
    ])
    expect(r.byItem[0]).toEqual({ title: 'دورة الأدب العربي', qty: 2, totalDzd: 7800 })
    expect(r.trend).toHaveLength(6)
    expect(r.trend.at(-1)).toEqual({ month, invoices: 2, totalDzd: 10200 })
    expect(r.trend[0]!.totalDzd).toBe(0)
  })

  it('للمشرف وحده', async () => {
    const teacher = await makeTeacher(h.db, admin, 'أستاذ')
    await expect(platformRevenue(h.db, teacher, month)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(platformRevenue(h.db, admin, '2026-13')).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})
