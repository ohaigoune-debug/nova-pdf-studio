import { generateKeyPairSync, sign as cryptoSign, type KeyObject } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { oauthIdentities, oauthTickets, profiles, sessions, students, users } from '@/server/db/schema'
import { resolveActor } from '@/server/auth/session'
import { appleClientSecret, appleConfig, setOAuthFetchForTests, verifyIdToken } from '@/server/auth/oauth-tokens'
import { deleteOwnAccount, deletionNeedsPassword, DELETE_CONFIRM_WORD } from '@/server/services/account-deletion.service'
import { login, registerStudent } from '@/server/services/auth.service'
import { completeOAuthSignup, createLoginHandoff, readSignupTicket, redeemLoginHandoff, signInWithIdentity, type VerifiedIdentity } from '@/server/services/oauth.service'
import { levels, streams, wilayas } from '@/server/db/schema'
import { makeAdmin, makeTeacher, setupDb, uniq } from './helpers'

// ── مفاتيح مزوّد مزيّف ─────────────────────────────────────────────────────
let rsa: { privateKey: KeyObject; publicKey: KeyObject }
let other: { privateKey: KeyObject; publicKey: KeyObject }
const KID = 'test-kid-1'

function jwt(payload: Record<string, unknown>, opts: { key?: KeyObject; kid?: string; alg?: string } = {}) {
  const header = Buffer.from(JSON.stringify({ alg: opts.alg ?? 'RS256', kid: opts.kid ?? KID })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = cryptoSign('RSA-SHA256', Buffer.from(`${header}.${body}`), opts.key ?? rsa.privateKey).toString('base64url')
  return `${header}.${body}.${sig}`
}

const fetchCalls: string[] = []
function installFetch() {
  setOAuthFetchForTests(async (url) => {
    fetchCalls.push(url)
    if (url.includes('/certs') || url.endsWith('/auth/keys')) {
      const jwk = rsa.publicKey.export({ format: 'jwk' })
      return new Response(JSON.stringify({ keys: [{ ...jwk, kid: KID, alg: 'RS256', use: 'sig' }] }), { status: 200 })
    }
    if (url.endsWith('/auth/revoke')) return new Response('', { status: 200 })
    return new Response('{}', { status: 404 })
  })
}

beforeAll(() => {
  rsa = generateKeyPairSync('rsa', { modulusLength: 2048 })
  other = generateKeyPairSync('rsa', { modulusLength: 2048 })
})
afterEach(() => {
  setOAuthFetchForTests(null)
  fetchCalls.length = 0
})

const nowS = () => Math.floor(Date.now() / 1000)
const googleClaims = (extra: Record<string, unknown> = {}) => ({ iss: 'https://accounts.google.com', aud: 'web-client', sub: 'g-123', exp: nowS() + 600, iat: nowS(), email: 'x@gmail.com', email_verified: true, ...extra })

describe('التحقق من رمز الهوية (ID token)', () => {
  it('يقبل الرمز الصحيح ويرفض الجمهور الخطأ والمنتهي والتوقيع المزوّر والـnonce المختلف', async () => {
    installFetch()
    const ok = await verifyIdToken('GOOGLE', jwt(googleClaims({ nonce: 'n1' })), { audiences: ['web-client'], nonce: 'n1' })
    expect(ok.sub).toBe('g-123')
    await expect(verifyIdToken('GOOGLE', jwt(googleClaims()), { audiences: ['other-client'] })).rejects.toMatchObject({ code: 'OAUTH_FAILED' })
    await expect(verifyIdToken('GOOGLE', jwt(googleClaims({ exp: nowS() - 3600 })), { audiences: ['web-client'] })).rejects.toMatchObject({ code: 'OAUTH_FAILED' })
    await expect(verifyIdToken('GOOGLE', jwt(googleClaims(), { key: other.privateKey }), { audiences: ['web-client'] })).rejects.toMatchObject({ code: 'OAUTH_FAILED' })
    await expect(verifyIdToken('GOOGLE', jwt(googleClaims({ nonce: 'n1' })), { audiences: ['web-client'], nonce: 'n2' })).rejects.toMatchObject({ code: 'OAUTH_FAILED' })
    await expect(verifyIdToken('GOOGLE', jwt(googleClaims({ iss: 'https://evil.example' })), { audiences: ['web-client'] })).rejects.toMatchObject({ code: 'OAUTH_FAILED' })
    // رمز Google لا يُقبل كرمز Apple (مُصدِر مختلف)
    await expect(verifyIdToken('APPLE', jwt(googleClaims()), { audiences: ['web-client'] })).rejects.toMatchObject({ code: 'OAUTH_FAILED' })
  })

  it('يرفض alg غير RS256 (مثل none)', async () => {
    installFetch()
    const header = Buffer.from(JSON.stringify({ alg: 'none', kid: KID })).toString('base64url')
    const body = Buffer.from(JSON.stringify(googleClaims())).toString('base64url')
    await expect(verifyIdToken('GOOGLE', `${header}.${body}.`, { audiences: ['web-client'] })).rejects.toMatchObject({ code: 'OAUTH_FAILED' })
  })
})

async function profileInput(db: Awaited<ReturnType<typeof setupDb>>['db']) {
  const [w] = await db.select().from(wilayas).limit(1)
  const [l] = await db.select().from(levels).limit(1)
  const [s] = await db.select().from(streams).limit(1)
  return { fullName: 'تلميذ Google', phone: '0551234567', guardianPhone: '0661234567', wilayaId: w!.id, levelId: l!.id, streamId: s!.id }
}

const ident = (over: Partial<VerifiedIdentity> = {}): VerifiedIdentity => ({
  provider: 'GOOGLE',
  subject: uniq('sub'),
  email: `${uniq('g')}@gmail.com`,
  emailVerified: true,
  fullName: 'تلميذ Google',
  ...over
})

describe('الدخول والتسجيل بـ Google وApple', () => {
  it('هوية جديدة ⇒ تذكرة إكمال، ثم حساب تلميذ بلا كلمة سر مربوط بالهوية، ثم دخول مباشر', async () => {
    const h = await setupDb()
    try {
      const id = ident()
      const first = await signInWithIdentity(h.db, id)
      expect(first.kind).toBe('signup')
      if (first.kind !== 'signup') return
      expect(await readSignupTicket(h.db, first.token)).toMatchObject({ provider: 'GOOGLE', email: id.email, fullName: 'تلميذ Google' })

      const r = await completeOAuthSignup(h.db, first.token, await profileInput(h.db))
      const actor = await resolveActor(h.db, r.session.token)
      expect(actor).toMatchObject({ role: 'STUDENT' })
      const [u] = await h.db.select().from(users).where(eq(users.id, r.userId))
      expect(u!.email).toBe(id.email)
      expect(u!.emailVerifiedAt).not.toBeNull()
      expect(u!.passwordHash.startsWith('oauth$')).toBe(true)
      const [p] = await h.db.select().from(profiles).where(eq(profiles.userId, r.userId))
      expect(p).toMatchObject({ phone: '0551234567', phoneVerifiedAt: null })
      const [st] = await h.db.select().from(students).where(eq(students.userId, r.userId))
      expect(st).toMatchObject({ guardianPhone: '0661234567' })

      // التذكرة لا تُستعمل مرتين
      await expect(completeOAuthSignup(h.db, first.token, await profileInput(h.db))).rejects.toMatchObject({ code: 'OAUTH_TICKET_EXPIRED' })
      // لا دخول بكلمة سر لحساب Google
      await expect(login(h.db, { email: id.email!, password: 'oauth$anything' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })

      const again = await signInWithIdentity(h.db, id)
      expect(again).toMatchObject({ kind: 'session', userId: r.userId })
    } finally {
      await h.close()
    }
  })

  it('بريد Gmail مؤكَّد لتلميذ مسجّل سابقًا ⇒ يُربط بحسابه ويدخل، وتُغلق الجلسات القديمة', async () => {
    const h = await setupDb()
    try {
      const email = `${uniq('old')}@gmail.com`
      const reg = await registerStudent(h.db, { email, password: 'Student@12345', fullName: 'تلميذ قديم' })
      const out = await signInWithIdentity(h.db, ident({ email: email.toUpperCase() }))
      expect(out).toMatchObject({ kind: 'session', userId: reg.userId })
      expect(await resolveActor(h.db, reg.session.token)).toBeNull()
      const links = await h.db.select().from(oauthIdentities).where(eq(oauthIdentities.userId, reg.userId))
      expect(links).toHaveLength(1)
      // كلمة السر القديمة باقية
      await expect(login(h.db, { email, password: 'Student@12345' })).resolves.toBeTruthy()
    } finally {
      await h.close()
    }
  })

  it('بريد غير مؤكَّد يطابق حسابًا ⇒ لا ربط، والإكمال يرفض البريد المستعمل', async () => {
    const h = await setupDb()
    try {
      const email = `${uniq('u')}@example.com`
      await registerStudent(h.db, { email, password: 'Student@12345', fullName: 'صاحب البريد' })
      const out = await signInWithIdentity(h.db, ident({ email, emailVerified: false }))
      expect(out.kind).toBe('signup')
      if (out.kind !== 'signup') return
      await expect(completeOAuthSignup(h.db, out.token, await profileInput(h.db))).rejects.toMatchObject({ code: 'EMAIL_TAKEN' })
    } finally {
      await h.close()
    }
  })

  it('حسابات الأساتذة والإدارة لا تدخل بـ Google', async () => {
    const h = await setupDb()
    try {
      const teacher = await makeTeacher(h.db, await makeAdmin(h.db))
      const [u] = await h.db.select({ email: users.email }).from(users).where(eq(users.id, teacher.userId))
      await expect(signInWithIdentity(h.db, ident({ email: u!.email }))).rejects.toMatchObject({ code: 'OAUTH_PASSWORD_ONLY' })
    } finally {
      await h.close()
    }
  })

  it('Apple دون بريد ⇒ بريد داخلي، والحساب يُعرف بهاتفه', async () => {
    const h = await setupDb()
    try {
      const out = await signInWithIdentity(h.db, ident({ provider: 'APPLE', email: null, emailVerified: false, fullName: null }))
      if (out.kind !== 'signup') throw new Error('expected signup')
      const r = await completeOAuthSignup(h.db, out.token, await profileInput(h.db))
      const [u] = await h.db.select().from(users).where(eq(users.id, r.userId))
      expect(u!.email).toMatch(/^apple-[0-9a-f]{20}@oauth\.madrasadz\.invalid$/)
      expect(u!.emailVerifiedAt).toBeNull()
    } finally {
      await h.close()
    }
  })

  it('تسليم الدخول إلى تطبيق الآيفون: صالح مرة واحدة', async () => {
    const h = await setupDb()
    try {
      const out = await signInWithIdentity(h.db, ident())
      if (out.kind !== 'signup') throw new Error('expected signup')
      const r = await completeOAuthSignup(h.db, out.token, await profileInput(h.db))
      const ticket = await createLoginHandoff(h.db, r.userId, 'GOOGLE')
      const s = await redeemLoginHandoff(h.db, ticket)
      expect(await resolveActor(h.db, s.session.token)).toMatchObject({ userId: r.userId })
      await expect(redeemLoginHandoff(h.db, ticket)).rejects.toMatchObject({ code: 'OAUTH_TICKET_EXPIRED' })
      // تذكرة منتهية
      const late = await createLoginHandoff(h.db, r.userId, 'GOOGLE', new Date(Date.now() - 10 * 60 * 1000))
      await expect(redeemLoginHandoff(h.db, late)).rejects.toMatchObject({ code: 'OAUTH_TICKET_EXPIRED' })
    } finally {
      await h.close()
    }
  })

  it('حذف حساب Apple: بكلمة «حذف» لا بكلمة سر، ويُلغى إذن Apple ويُفكّ الربط', async () => {
    const h = await setupDb()
    const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' })
    const env = { ...process.env }
    process.env.APPLE_TEAM_ID = 'TEAM123456'
    process.env.APPLE_SIGNIN_KEY_ID = 'KEY1234567'
    process.env.APPLE_SIGNIN_PRIVATE_KEY = ec.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString()
    try {
      installFetch()
      const id = ident({ provider: 'APPLE', refreshToken: 'com.madrasadz.student:r-refresh' })
      const out = await signInWithIdentity(h.db, id)
      if (out.kind !== 'signup') throw new Error('expected signup')
      const r = await completeOAuthSignup(h.db, out.token, await profileInput(h.db))
      expect(await deletionNeedsPassword(h.db, r.userId)).toBe(false)
      await expect(deleteOwnAccount(h.db, r.userId, 'كلمة')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
      await deleteOwnAccount(h.db, r.userId, ` ${DELETE_CONFIRM_WORD} `)
      expect(fetchCalls.some((u) => u.endsWith('/auth/revoke'))).toBe(true)
      expect(await h.db.select().from(oauthIdentities).where(eq(oauthIdentities.userId, r.userId))).toHaveLength(0)
      expect(await h.db.select().from(sessions).where(eq(sessions.userId, r.userId))).toSatisfy((rows: { revokedAt: Date | null }[]) => rows.every((s) => s.revokedAt))
      // الدخول بـ Apple بعد الحذف ⇒ تسجيل جديد لا الحساب المحذوف
      expect((await signInWithIdentity(h.db, id)).kind).toBe('signup')
      expect(await h.db.select().from(oauthTickets).where(eq(oauthTickets.userId, r.userId))).toHaveLength(0)
    } finally {
      process.env = env
      await h.close()
    }
  })

  it('سرّ عميل Apple: JWT بتوقيع ES256 صالح بالمفتاح العام', async () => {
    const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' })
    const env = { ...process.env }
    process.env.APPLE_TEAM_ID = 'TEAM123456'
    process.env.APPLE_SIGNIN_KEY_ID = 'KEY1234567'
    process.env.APPLE_SIGNIN_PRIVATE_KEY = ec.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString().replace(/\n/g, '\\n')
    try {
      const cfg = appleConfig()
      expect(cfg).toMatchObject({ teamId: 'TEAM123456', bundleId: 'com.madrasadz.student', servicesId: null })
      const secret = appleClientSecret(cfg!, 'com.madrasadz.student')
      const [hd, pl, sig] = secret.split('.')
      const { verify } = await import('node:crypto')
      expect(verify('sha256', Buffer.from(`${hd}.${pl}`), { key: ec.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig!, 'base64url'))).toBe(true)
      expect(JSON.parse(Buffer.from(pl!, 'base64url').toString())).toMatchObject({ iss: 'TEAM123456', sub: 'com.madrasadz.student', aud: 'https://appleid.apple.com' })
    } finally {
      process.env = env
    }
  })
})
