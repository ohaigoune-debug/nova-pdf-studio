import { describe, expect, it } from 'vitest'
import { AppError } from '@/server/lib/errors'
import { DEFAULT_ABOUT, getAboutSettings, updateAboutSettings } from '@/server/services/about.service'
import { makeAdmin, makeTeacher, setupDb } from './helpers'

describe('قسم الأستاذ في الصفحة الرئيسية', () => {
  it('صاحب المنصة افتراضياً، ويُحفظ مقصوصاً ومنظّفاً من الفراغات', async () => {
    const h = await setupDb()
    try {
      expect(await getAboutSettings(h.db)).toEqual(DEFAULT_ABOUT)
      const admin = await makeAdmin(h.db)
      const saved = await updateAboutSettings(h.db, admin, { name: '  أسامة  ', title: 'أستاذ', bio: 'x'.repeat(700), quote: '' })
      expect(saved.name).toBe('أسامة')
      expect(saved.bio).toHaveLength(600)
      expect(await getAboutSettings(h.db)).toEqual(saved)
    } finally {
      await h.close()
    }
  })

  it('تحديث جزئي يبقي بقية الحقول، والمشرف وحده يعدّل', async () => {
    const h = await setupDb()
    try {
      const admin = await makeAdmin(h.db)
      await updateAboutSettings(h.db, admin, { name: 'أسامة', title: 'أستاذ', bio: 'سيرة', quote: 'اقتباس' })
      const after = await updateAboutSettings(h.db, admin, { quote: '' })
      expect(after).toMatchObject({ name: 'أسامة', title: 'أستاذ', bio: 'سيرة', quote: '' })

      const teacher = await makeTeacher(h.db, admin)
      await expect(updateAboutSettings(h.db, teacher, { name: 'x' })).rejects.toBeInstanceOf(AppError)
    } finally {
      await h.close()
    }
  })
})
