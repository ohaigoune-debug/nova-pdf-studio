import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { resolveActor } from '@/server/auth/session'
import { bootstrapPlatform } from '@/server/db/bootstrap'
import { createDatabase } from '@/server/db/connect'
import { resetUserPassword } from '@/server/db/reset-password'
import { AppError } from '@/server/lib/errors'
import { profiles } from '@/server/db/schema'
import { login, registerStudent } from '@/server/services/auth.service'

const OLD = 'kalimat-sirr-qadima-1'
const NEW = 'kalimat-sirr-jadida-2'

async function platformWithOwner() {
  const h = await createDatabase('pglite://memory')
  await bootstrapPlatform(h.db, { email: 'owner@madrasadz.com', password: OLD })
  return h
}

describe('إعادة تعيين كلمة السر من الخادم', () => {
  it('يدخل بالجديدة ولا يدخل بالقديمة', async () => {
    const h = await platformWithOwner()
    try {
      const r = await resetUserPassword(h.db, ' Owner@MadrasaDZ.com ', NEW)
      expect(r.role).toBe('SUPER_ADMIN')
      expect((await login(h.db, { email: 'owner@madrasadz.com', password: NEW })).session.token).toBeTruthy()
      await expect(login(h.db, { email: 'owner@madrasadz.com', password: OLD })).rejects.toBeInstanceOf(AppError)
    } finally {
      await h.close()
    }
  })

  it('يُخرج الجلسات القائمة — لا تبقى جلسة فُتحت بالقديمة', async () => {
    const h = await platformWithOwner()
    try {
      const before = (await login(h.db, { email: 'owner@madrasadz.com', password: OLD })).session.token
      expect(await resolveActor(h.db, before)).not.toBeNull()
      await resetUserPassword(h.db, 'owner@madrasadz.com', NEW)
      expect(await resolveActor(h.db, before)).toBeNull()
    } finally {
      await h.close()
    }
  })

  it('يرفض بريداً مجهولاً وكلمة سر قصيرة بلا تغيير شيء', async () => {
    const h = await platformWithOwner()
    try {
      await expect(resetUserPassword(h.db, 'ghost@madrasadz.com', NEW)).rejects.toThrow(/لا حساب/)
      await expect(resetUserPassword(h.db, 'owner@madrasadz.com', 'short123')).rejects.toThrow(/قصيرة/)
      // القديمة ما زالت تعمل: لم يمسّ الرفضُ الحساب
      expect((await login(h.db, { email: 'owner@madrasadz.com', password: OLD })).session.token).toBeTruthy()
    } finally {
      await h.close()
    }
  })

  it('حساب مسجَّل بالهاتف وحده: يُعاد تعيينه برقمه المؤكَّد؛ الرقم غير المؤكَّد أو المؤكَّد لحسابين يُرفض بلا تغيير', async () => {
    const h = await platformWithOwner()
    try {
      const a = await registerStudent(h.db, { email: null, password: OLD, fullName: 'بلا بريد', phone: '0661000001', guardianPhone: '0770000001' })
      // غير مؤكَّد: قد يكون كتبه غير صاحبه
      await expect(resetUserPassword(h.db, '0661000001', NEW)).rejects.toThrow(/لا حساب أكّد/)
      await h.db.update(profiles).set({ phoneVerifiedAt: new Date() }).where(eq(profiles.userId, a.userId))
      const before = (await login(h.db, { email: '0661000001', password: OLD })).session.token
      const r = await resetUserPassword(h.db, '+213 661 00 00 01', NEW)
      expect(r).toEqual({ userId: a.userId, role: 'STUDENT' })
      expect((await login(h.db, { email: '0661000001', password: NEW })).userId).toBe(a.userId)
      await expect(login(h.db, { email: '0661000001', password: OLD })).rejects.toBeInstanceOf(AppError)
      expect(await resolveActor(h.db, before)).toBeNull()
      // بيانات قديمة: الرقم مؤكَّد لحسابين ⇒ لا يختار عشوائيًا
      const b = await registerStudent(h.db, { email: 'b@example.dz', password: OLD, fullName: 'ثانٍ', phone: '0661000002' })
      await h.db.update(profiles).set({ phone: '0661000001', phoneVerifiedAt: new Date() }).where(eq(profiles.userId, b.userId))
      await expect(resetUserPassword(h.db, '0661000001', 'kalimat-sirr-thalitha-3')).rejects.toThrow(/أكثر من حساب/)
      expect((await login(h.db, { email: '0661000001', password: NEW })).userId).toBe(a.userId)
      await expect(resetUserPassword(h.db, '0123', NEW)).rejects.toThrow(/لا حساب/)
    } finally {
      await h.close()
    }
  })
})
