import { describe, expect, it } from 'vitest'
import { resolveActor } from '@/server/auth/session'
import { bootstrapPlatform } from '@/server/db/bootstrap'
import { createDatabase } from '@/server/db/connect'
import { resetUserPassword } from '@/server/db/reset-password'
import { AppError } from '@/server/lib/errors'
import { login } from '@/server/services/auth.service'

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
})
