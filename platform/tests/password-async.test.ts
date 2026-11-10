import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '@/server/auth/password'
import { createDatabase } from '@/server/db/connect'
import { login, registerStudent } from '@/server/services/auth.service'

/** التنفيذ القديم المتزامن حرفياً — مرجع التوافق في الاتجاهين */
function oldHash(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password.normalize('NFKC'), salt, 64, { N: 16384, r: 8, p: 1 })
  return `scrypt$16384$8$1$${salt.toString('base64')}$${hash.toString('base64')}`
}
function oldVerify(password: string, stored: string): boolean {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const salt = Buffer.from(parts[4] ?? '', 'base64')
  const expected = Buffer.from(parts[5] ?? '', 'base64')
  const actual = scryptSync(password.normalize('NFKC'), salt, expected.length, { N: Number(parts[1]), r: Number(parts[2]), p: Number(parts[3]) })
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

describe('تجزئة كلمة السر غير المتزامنة', () => {
  it('تجزئة ثم تحقق: الصحيحة تُقبل والخاطئة تُرفض', async () => {
    const stored = await hashPassword('kalimat-sirr-1')
    expect(stored).toMatch(/^scrypt\$16384\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/)
    expect(await verifyPassword('kalimat-sirr-1', stored)).toBe(true)
    expect(await verifyPassword('kalimat-sirr-2', stored)).toBe(false)
    expect(await verifyPassword('', stored)).toBe(false)
  })

  it('ملح جديد في كل مرة', async () => {
    expect(await hashPassword('kalimat-sirr-1')).not.toBe(await hashPassword('kalimat-sirr-1'))
  })

  it('تجزئة من التنفيذ القديم المتزامن ما زالت تُقبل، والجديدة يقبلها القديم', async () => {
    const legacy = oldHash('كلمة-سرّ-قديمة-1')
    expect(await verifyPassword('كلمة-سرّ-قديمة-1', legacy)).toBe(true)
    expect(await verifyPassword('كلمة-سرّ-قديمة-2', legacy)).toBe(false)
    const fresh = await hashPassword('كلمة-سرّ-جديدة-1')
    expect(oldVerify('كلمة-سرّ-جديدة-1', fresh)).toBe(true)
    expect(oldVerify('كلمة-سرّ-جديدة-2', fresh)).toBe(false)
  })

  it('تجزئة ثابتة مخزّنة من قبل (متجه معروف) تُقبل', async () => {
    // ملح ثابت = 16 بايت أصفار؛ المتوقَّع يُحسب بـscryptSync كما كان يُخزَّن
    const salt = Buffer.alloc(16)
    const stored = `scrypt$16384$8$1$${salt.toString('base64')}$${scryptSync('Admin@12345', salt, 64, { N: 16384, r: 8, p: 1 }).toString('base64')}`
    expect(await verifyPassword('Admin@12345', stored)).toBe(true)
  })

  it('تطبيع NFKC محفوظ: الصيغتان المتكافئتان تتطابقان', async () => {
    const stored = await hashPassword('ﬁ-password-①')
    expect(await verifyPassword('fi-password-1', stored)).toBe(true)
  })

  it('نص مخزَّن تالف: false بلا رمي خطأ', async () => {
    const good = await hashPassword('kalimat-sirr-1')
    const [, , , , salt, hash] = good.split('$')
    const bad = [
      '',
      'not-a-hash',
      'bcrypt$16384$8$1$a$b',
      'scrypt$16384$8$1$onlyfive',
      `scrypt$16384$8$1$${salt}$${hash}$extra`,
      `scrypt$16384$8$1$${salt}$`,
      `scrypt$abc$8$1$${salt}$${hash}`,
      `scrypt$16385$8$1$${salt}$${hash}`,
      `scrypt$16384$-1$1$${salt}$${hash}`,
      `scrypt$16384$8$x$${salt}$${hash}`,
      `scrypt$$$$$`
    ]
    for (const stored of bad) {
      await expect(verifyPassword('kalimat-sirr-1', stored), stored).resolves.toBe(false)
    }
  })

  it('لا يحجب حلقة الأحداث: مؤقّت يعمل قبل انتهاء تحققات متزامنة', async () => {
    const stored = await hashPassword('kalimat-sirr-1')
    let done = false
    let firedBeforeDone = false
    let ticks = 0
    const all = Promise.all(Array.from({ length: 8 }, (_, i) => verifyPassword(i % 2 ? 'kalimat-sirr-1' : 'ghalat', stored))).then((r) => {
      done = true
      return r
    })
    setImmediate(() => {
      firedBeforeDone = !done
    })
    const timer = setInterval(() => {
      if (!done) ticks++
    }, 1)
    const results = await all
    clearInterval(timer)
    expect(results).toEqual([false, true, false, true, false, true, false, true])
    expect(firedBeforeDone).toBe(true)
    // 8 حسابات ≈ 40 مللي ثانية لكلٍّ على 4 خيوط: الحلقة دارت مرات أثناءها (المتزامن كان يعطي 0)
    expect(ticks).toBeGreaterThan(0)
  })
})

describe('الدخول بعد التحويل إلى await', () => {
  it('بريد: كلمة خاطئة وحساب غير موجود يُرفضان، والصحيحة تُقبل', async () => {
    const h = await createDatabase('pglite://memory')
    try {
      await registerStudent(h.db, { email: 'a@example.com', password: 'kalimat-sirr-1', fullName: 'تلميذ أول' })
      await expect(login(h.db, { email: 'a@example.com', password: 'ghalat-ghalat' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
      await expect(login(h.db, { email: 'nobody@example.com', password: 'kalimat-sirr-1' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
      expect((await login(h.db, { email: 'a@example.com', password: 'kalimat-sirr-1' })).session.token).toBeTruthy()
    } finally {
      await h.close()
    }
  })

  it('هاتف مشترك بين حسابين: يدخل صاحب كلمة السر المطابقة فقط', async () => {
    const h = await createDatabase('pglite://memory')
    try {
      const a = await registerStudent(h.db, { email: 'a@example.com', password: 'kalimat-sirr-1', fullName: 'تلميذ أول', phone: '0550000001' })
      const b = await registerStudent(h.db, { email: 'b@example.com', password: 'kalimat-sirr-2', fullName: 'تلميذ ثانٍ', phone: '0550000001' })
      expect((await login(h.db, { email: '0550000001', password: 'kalimat-sirr-1' })).userId).toBe(a.userId)
      expect((await login(h.db, { email: '0550000001', password: 'kalimat-sirr-2' })).userId).toBe(b.userId)
      await expect(login(h.db, { email: '0550000001', password: 'kalimat-sirr-3' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
      await expect(login(h.db, { email: '0550000009', password: 'kalimat-sirr-1' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    } finally {
      await h.close()
    }
  })
})

/**
 * حارس: verifyPassword/hashPassword صارا يرجعان Promise. نداء بلا await داخل شرط
 * يكون صادقاً دائماً فتُقبل أي كلمة سر — لذلك يفشل هذا الاختبار عند أي نداء بلا await في src/.
 */
describe('حارس await', () => {
  const ROOT = join(__dirname, '..')
  const CALL = /\b(hashPassword|verifyPassword)\s*\(/g
  // الاستثناء الوحيد: Promise التجزئة الوهمية، يُنتظر عند استعماله (await DUMMY_HASH)
  const ALLOWED = new Set(["src/server/services/auth.service.ts|const DUMMY_HASH: Promise<string> = hashPassword('dummy-password-for-timing')"])

  function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = join(dir, e.name)
      if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(p)
      return /\.(ts|tsx|mts|js|mjs)$/.test(e.name) ? [p] : []
    })
  }

  function unawaited(file: string, text: string): string[] {
    const out: string[] = []
    for (const m of text.matchAll(CALL)) {
      const before = text.slice(0, m.index)
      if (/\bawait\s+$/.test(before)) continue
      if (/\bfunction\s+$/.test(before)) continue // التعريف نفسه
      const lineStart = before.lastIndexOf('\n') + 1
      const lineEnd = text.indexOf('\n', m.index)
      const line = text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim()
      if (line.startsWith('//') || line.startsWith('*')) continue
      if (ALLOWED.has(`${file}|${line}`)) continue
      out.push(`${file}:${before.split('\n').length}: ${line}`)
    }
    return out
  }

  it('الحارس نفسه يلتقط النداء بلا await', () => {
    expect(unawaited('x.ts', 'if (!verifyPassword(a, b)) throw 1')).toHaveLength(1)
    expect(unawaited('x.ts', 'list.find((c) => verifyPassword(a, c.h))')).toHaveLength(1)
    expect(unawaited('x.ts', '{ passwordHash: hashPassword(p) }')).toHaveLength(1)
    expect(unawaited('x.ts', 'if (!(await verifyPassword(a, b))) throw 1')).toHaveLength(0)
    expect(unawaited('x.ts', 'await verifyPasswordResetToken(db, t)\nverifyPasswordResetToken(db, t)')).toHaveLength(0)
  })

  it('لا نداء بلا await في src/ ولا scripts/', () => {
    const files = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'scripts'))]
    expect(files.length).toBeGreaterThan(100)
    const offenders = files.flatMap((f) => unawaited(relative(ROOT, f).split('\\').join('/'), readFileSync(f, 'utf8')))
    expect(offenders).toEqual([])
  })

  it('لا استعمال للتجزئة المتزامنة خارج الاختبارات', () => {
    const files = walk(join(ROOT, 'src'))
    expect(files.filter((f) => /\bscryptSync\b/.test(readFileSync(f, 'utf8'))).map((f) => relative(ROOT, f))).toEqual([])
  })
})
