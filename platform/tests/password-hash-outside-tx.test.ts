/**
 * مراجعة الموجة (أ): التجزئة غير المتزامنة تُعيد التحكم لحلقة الأحداث. إن حُسبت داخل db.transaction
 * بقي اتصال من المجمّع (10 لكل عملية) مفتوحاً في معاملة خاملة طوال انتظار خيوط libuv (4)،
 * فتستنزف موجة تسجيلات كل الاتصالات وتتوقف بقية الطلبات. التسجيل يجزّئ قبل فتح المعاملة.
 * وفشل داخلي في scrypt لا يصير دخولاً ناجحاً أبداً، ويُسجَّل (بلا كلمة السر ولا التجزئة).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDatabase } from '@/server/db/connect'

const events: string[] = []
let failScrypt = false

vi.mock('node:crypto', async (orig) => {
  const actual = await orig<typeof import('node:crypto')>()
  const scrypt = (...args: unknown[]) => {
    const cb = args[args.length - 1] as (err: Error | null, key?: Buffer) => void
    if (failScrypt) return void setImmediate(() => cb(new Error('scrypt internal failure (simulated)')))
    events.push('hash:start')
    ;(actual.scrypt as (...a: unknown[]) => void)(...args.slice(0, -1), (err: Error | null, key?: Buffer) => {
      events.push('hash:end')
      cb(err, key)
    })
  }
  return { ...actual, default: { ...actual, scrypt }, scrypt }
})

afterEach(() => {
  failScrypt = false
  vi.restoreAllMocks()
})

describe('التجزئة خارج معاملة قاعدة البيانات', () => {
  it('registerStudent: التجزئة تكتمل قبل فتح المعاملة (لا اتصال محجوز أثناء انتظار خيوط scrypt)', async () => {
    const { registerStudent, login } = await import('@/server/services/auth.service')
    const h = await createDatabase('pglite://memory')
    try {
      // تجزئة DUMMY_HASH عند تحميل الوحدة تنتهي قبل القياس
      await new Promise((r) => setTimeout(r, 300))
      events.length = 0
      const realTx = h.db.transaction.bind(h.db)
      vi.spyOn(h.db, 'transaction').mockImplementation(((fn: never, cfg: never) => {
        events.push('tx:open')
        return realTx(fn, cfg)
      }) as never)
      const out = await registerStudent(h.db, { email: 'tx@example.com', password: 'kalimat-sirr-1', fullName: 'تلميذ المعاملة' })
      expect(events).toEqual(['hash:start', 'hash:end', 'tx:open'])
      // السلوك لم يتغيّر: الحساب أُنشئ ويدخل بكلمته، والبريد المكرر يُرفض
      expect((await login(h.db, { email: 'tx@example.com', password: 'kalimat-sirr-1' })).userId).toBe(out.userId)
      await expect(registerStudent(h.db, { email: 'tx@example.com', password: 'kalimat-sirr-1', fullName: 'مكرر' })).rejects.toMatchObject({ code: 'EMAIL_TAKEN' })
    } finally {
      await h.close()
    }
  })

  it('فشل داخلي في scrypt: verifyPassword يرفض ولا يقبل أبداً، ويُسجَّل الخطأ بلا أسرار', async () => {
    const { hashPassword, verifyPassword } = await import('@/server/auth/password')
    const stored = await hashPassword('kalimat-sirr-1')
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    failScrypt = true
    expect(await verifyPassword('kalimat-sirr-1', stored)).toBe(false)
    expect(await verifyPassword('ghalat', stored)).toBe(false)
    expect(log).toHaveBeenCalled()
    const printed = JSON.stringify(log.mock.calls)
    expect(printed).toContain('scrypt internal failure')
    expect(printed).not.toContain('kalimat-sirr-1')
    expect(printed).not.toContain(stored.split('$')[5])
  })
})
