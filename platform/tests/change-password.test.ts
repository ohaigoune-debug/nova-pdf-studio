import { describe, expect, it } from 'vitest'
import { resolveActor } from '@/server/auth/session'
import { bootstrapPlatform } from '@/server/db/bootstrap'
import { createDatabase } from '@/server/db/connect'
import { AppError } from '@/server/lib/errors'
import { changePassword, login } from '@/server/services/auth.service'

const OLD = 'kalimat-sirr-qadima-1'
const NEW = 'kalimat-sirr-jadida-2'

async function ownerDb() {
  const h = await createDatabase('pglite://memory')
  const { userId } = await bootstrapPlatform(h.db, { email: 'owner@madrasadz.com', password: OLD })
  return { h, userId }
}

describe('تغيير كلمة السر من داخل الحساب', () => {
  it('يقبل الجديدة ويرفض القديمة بعدها', async () => {
    const { h, userId } = await ownerDb()
    try {
      await changePassword(h.db, userId, OLD, NEW)
      expect((await login(h.db, { email: 'owner@madrasadz.com', password: NEW })).session.token).toBeTruthy()
      await expect(login(h.db, { email: 'owner@madrasadz.com', password: OLD })).rejects.toBeInstanceOf(AppError)
    } finally {
      await h.close()
    }
  })

  it('يُنهي الجلسات القائمة — جهاز آخر بالكلمة القديمة يخرج', async () => {
    const { h, userId } = await ownerDb()
    try {
      const other = (await login(h.db, { email: 'owner@madrasadz.com', password: OLD })).session.token
      await changePassword(h.db, userId, OLD, NEW)
      expect(await resolveActor(h.db, other)).toBeNull()
    } finally {
      await h.close()
    }
  })

  it('كلمة حالية خاطئة أو جديدة ضعيفة: لا يتغيّر شيء', async () => {
    const { h, userId } = await ownerDb()
    try {
      await expect(changePassword(h.db, userId, 'خطأ-تماماً', NEW)).rejects.toBeInstanceOf(AppError)
      await expect(changePassword(h.db, userId, OLD, 'short')).rejects.toBeInstanceOf(AppError)
      expect((await login(h.db, { email: 'owner@madrasadz.com', password: OLD })).session.token).toBeTruthy()
    } finally {
      await h.close()
    }
  })
})
