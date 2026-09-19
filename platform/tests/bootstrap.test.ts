import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { bootstrapPlatform } from '@/server/db/bootstrap'
import { createDatabase } from '@/server/db/connect'
import { skills, users, wilayas } from '@/server/db/schema'
import { login } from '@/server/services/auth.service'

/** قاعدة فارغة تماماً — كما هي أول مرة في الإنتاج (بلا مساعد الاختبارات الذي يزرع مرجعيات) */
const emptyDb = () => createDatabase('pglite://memory')

const STRONG = 'kalimat-sirr-qawiya-2026'

describe('إقلاع منصة إنتاجية', () => {
  it('من قاعدة فارغة: مرجعيات كاملة ومشرف يدخل فعلاً وبلا أي حساب تجريبي', async () => {
    const h = await emptyDb()
    try {
      const r = await bootstrapPlatform(h.db, { email: 'Owner@MadrasaDZ.com ', password: STRONG, fullName: 'أسامة' })
      expect(r).toMatchObject({ seededReferenceData: true, createdAdmin: true })
      expect((await h.db.select().from(wilayas)).length).toBeGreaterThan(40)
      expect((await h.db.select().from(skills)).length).toBeGreaterThan(0)

      // حساب واحد فقط، والبريد مُطبَّع
      const all = await h.db.select().from(users)
      expect(all).toHaveLength(1)
      expect(all[0]).toMatchObject({ email: 'owner@madrasadz.com', role: 'SUPER_ADMIN' })

      // يدخل فعلاً بكلمة السر المعطاة
      expect((await login(h.db, { email: 'owner@madrasadz.com', password: STRONG })).session.token).toBeTruthy()
    } finally {
      await h.close()
    }
  })

  it('تكراره عند كل نشر لا يضاعف شيئاً ولا يغيّر كلمة السر', async () => {
    const h = await emptyDb()
    try {
      await bootstrapPlatform(h.db, { email: 'owner@madrasadz.com', password: STRONG })
      const wilayaCount = (await h.db.select().from(wilayas)).length
      const again = await bootstrapPlatform(h.db, { email: 'owner@madrasadz.com', password: 'kalimat-ukhra-tamaman' })
      expect(again).toMatchObject({ seededReferenceData: false, createdAdmin: false })
      expect(await h.db.select().from(users)).toHaveLength(1)
      expect((await h.db.select().from(wilayas)).length).toBe(wilayaCount)
      // كلمة السر الأصلية باقية: النشر لا يُعيد تعيين حساب المالك
      expect((await login(h.db, { email: 'owner@madrasadz.com', password: STRONG })).session.token).toBeTruthy()
    } finally {
      await h.close()
    }
  })

  it('يرفض كلمة سر قصيرة أو بريداً غير صالح بلا إنشاء أي حساب', async () => {
    const h = await emptyDb()
    try {
      await expect(bootstrapPlatform(h.db, { email: 'x@y.com', password: 'short123' })).rejects.toThrow(/ADMIN_PASSWORD/)
      await expect(bootstrapPlatform(h.db, { email: 'not-an-email', password: STRONG })).rejects.toThrow(/ADMIN_EMAIL/)
      expect(await h.db.select().from(users).where(eq(users.email, 'x@y.com'))).toHaveLength(0)
      expect(await h.db.select().from(users)).toHaveLength(0)
    } finally {
      await h.close()
    }
  })
})
