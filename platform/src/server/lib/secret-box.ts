/**
 * تشفير سرّ صغير (مفتاح مزوّد) قبل حفظه في قاعدة البيانات: AES-256-GCM بمفتاح مشتقّ من SESSION_SECRET.
 * نسخة احتياطية لقاعدة البيانات وحدها لا تكشف المفتاح. تغيير SESSION_SECRET يُبطل ما حُفظ (يُعاد إدخاله).
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

function boxKey(purpose: string): Buffer {
  const s = process.env.SESSION_SECRET
  if (!s) throw new Error('SESSION_SECRET is not configured')
  return createHash('sha256').update(`secret-box:${purpose}:${s}`).digest()
}

export function seal(plain: string, purpose: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', boxKey(purpose), iv)
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), enc.toString('base64')].join('.')
}

/** null إن تعذّر الفتح (سرّ الجلسة تغيّر أو البيانات تالفة) */
export function unseal(box: string, purpose: string): string | null {
  const [v, iv, tag, enc] = box.split('.')
  if (v !== 'v1' || !iv || !tag || !enc) return null
  try {
    const d = createDecipheriv('aes-256-gcm', boxKey(purpose), Buffer.from(iv, 'base64'))
    d.setAuthTag(Buffer.from(tag, 'base64'))
    return Buffer.concat([d.update(Buffer.from(enc, 'base64')), d.final()]).toString('utf8')
  } catch {
    return null
  }
}
