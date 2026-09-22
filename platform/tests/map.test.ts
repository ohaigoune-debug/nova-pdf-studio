import { describe, expect, it } from 'vitest'
import { MAP_WILAYAS } from '@/components/domain/algeria-map-data'
import { wilayas } from '@/server/db/schema'
import { studentsPerWilaya } from '@/server/queries/map.queries'
import { registerStudent } from '@/server/services/auth.service'
import { setupDb, uniq } from './helpers'

describe('خريطة الجزائر', () => {
  it('بيانات الخريطة: 58 ولاية، 48 بحدود و10 نقاط داخل ولاية أم لها حدود', () => {
    expect(MAP_WILAYAS).toHaveLength(58)
    const codes = MAP_WILAYAS.map((w) => w.code)
    expect(new Set(codes).size).toBe(58)
    expect(codes).toEqual(Array.from({ length: 58 }, (_, i) => String(i + 1).padStart(2, '0')))
    const withShape = new Set(MAP_WILAYAS.filter((w) => w.d).map((w) => w.code))
    expect(withShape.size).toBe(48)
    for (const w of MAP_WILAYAS.filter((x) => !x.d)) expect(withShape.has(w.parent!)).toBe(true)
  })

  it('يعدّ الطلاب لكل ولاية، ويُرجع كل الولايات حتى الفارغة', async () => {
    const h = await setupDb()
    try {
      const all = await h.db.select().from(wilayas)
      const guelma = all.find((w) => w.code === '24')!
      for (let i = 0; i < 3; i++) await registerStudent(h.db, { email: `${uniq('s')}@test.dz`, password: 'Student@12345', fullName: 'طالب', wilayaId: guelma.id })
      await registerStudent(h.db, { email: `${uniq('s')}@test.dz`, password: 'Student@12345', fullName: 'بلا ولاية' })

      const rows = await studentsPerWilaya(h.db)
      expect(rows).toHaveLength(all.length)
      expect(rows.find((r) => r.code === '24')).toMatchObject({ name: 'قالمة', students: 3 })
      expect(rows.find((r) => r.code === '25')!.students).toBe(0)
      // طالب بلا ولاية لا يُنسب لأي ولاية
      expect(rows.reduce((s, r) => s + r.students, 0)).toBe(3)
    } finally {
      await h.close()
    }
  })
})
