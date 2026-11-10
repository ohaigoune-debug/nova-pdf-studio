import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

const N = 16384
const R = 8
const P = 1
const KEYLEN = 64

/**
 * scrypt غير المتزامن: يُحسب في خيوط libuv لا في حلقة الأحداث، فلا يتجمّد الخادم
 * عن بقية الطلبات أثناء الحساب (النسخة المتزامنة كانت توقف العملية كلها ~38 مللي ثانية لكل دخول).
 * الصيغة المخزّنة والمعاملات لم تتغيّر: scrypt$N$r$p$salt$hash.
 */
function derive(password: string, salt: Buffer, keylen: number, opts: { N: number; r: number; p: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key)))
  })
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await derive(password, salt, KEYLEN, { N, r: R, p: P })
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`
}

/** تنبيه: النتيجة Promise — لا بد من await، وإلا صار الشرط صادقاً دائماً وقُبلت أي كلمة سر. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const n = Number(parts[1])
  const r = Number(parts[2])
  const p = Number(parts[3])
  const salt = Buffer.from(parts[4] ?? '', 'base64')
  const expected = Buffer.from(parts[5] ?? '', 'base64')
  // تجزئة فارغة لا تطابق شيئاً (وإلا ساوت مفتاحاً بطول صفر فقُبلت أي كلمة سر)
  if (expected.length === 0) return false
  let actual: Buffer
  try {
    actual = await derive(password, salt, expected.length, { N: n, r, p })
  } catch {
    // معاملات مخزّنة تالفة (N ليس قوة 2، قيم غير رقمية…): رفض لا خطأ خادم
    return false
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function isStrongEnough(password: string): boolean {
  return password.length >= 8
}
