import { randomBytes } from 'node:crypto'
import { and, eq, gt, isNull, lt } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { oauthIdentities, oauthTickets, users, type OAuthProvider } from '@/server/db/schema'
import { unusablePasswordHash } from '@/server/auth/password'
import { createSession, revokeAllSessions, type CreatedSession } from '@/server/auth/session'
import { writeActivity } from '@/server/lib/audit'
import { sha256 } from '@/server/lib/codes'
import { AppError } from '@/server/lib/errors'
import { createStudentAccount, type RegisterInput, type RequestMeta } from './auth.service'

/**
 * الدخول والتسجيل بـ Google وApple (قرار المالك 5 نوفمبر 2026: الموقع وآيفون وأندرويد).
 *
 * - هوية مربوطة بحساب ⇒ دخول مباشر.
 * - هوية جديدة ببريد مؤكَّد يطابق حساب تلميذ موجود ⇒ تُربط به ويدخل (لا حساب مكرَّر لمن سجّل بـ Gmail سابقًا).
 * - غير ذلك ⇒ تذكرة «إكمال الحساب»: الهاتف وهاتف الولي والمستوى والشعبة والولاية كالتسجيل العادي
 *   (دون كلمة سر)، ثم تأكيد الهاتف برمز كما في كل حساب جديد.
 * - حسابات الإدارة والأساتذة والموظفين لا تدخل بهذه الطريقة: كلمة السر وحدها.
 */

export interface VerifiedIdentity {
  provider: OAuthProvider
  subject: string
  email: string | null
  emailVerified: boolean
  fullName: string | null
  /** Apple: «clientId:refreshToken» لإلغاء الإذن عند حذف الحساب */
  refreshToken?: string | null
}

export type OAuthOutcome =
  | { kind: 'session'; userId: string; role: string; session: CreatedSession }
  | { kind: 'signup'; token: string; email: string | null; fullName: string | null; provider: OAuthProvider }

const SIGNUP_TTL_MS = 30 * 60 * 1000
const HANDOFF_TTL_MS = 2 * 60 * 1000

function newToken(): string {
  return randomBytes(32).toString('base64url')
}

function cleanEmail(email: string | null | undefined): string | null {
  const e = email?.trim().toLowerCase()
  return e && e.includes('@') && e.length <= 254 ? e : null
}

function cleanName(name: string | null | undefined): string | null {
  const n = name?.replace(/\s+/g, ' ').trim()
  return n ? n.slice(0, 120) : null
}

async function startSession(db: Db, userId: string, provider: OAuthProvider, meta: RequestMeta, now: Date) {
  await db.update(users).set({ lastLoginAt: now }).where(eq(users.id, userId))
  await writeActivity(db, { userId, event: 'auth.login', meta: { via: provider.toLowerCase() } })
  return createSession(db, { userId, ...meta })
}

/** الخطوة بعد التحقق من رمز المزوّد: دخول، أو تذكرة إكمال الحساب. */
export async function signInWithIdentity(db: Db, identity: VerifiedIdentity, meta: RequestMeta = {}, now: Date = new Date()): Promise<OAuthOutcome> {
  const email = cleanEmail(identity.email)

  // 1) هوية مربوطة
  const [linked] = await db
    .select({ identityId: oauthIdentities.id, userId: users.id, role: users.role, status: users.status, deletedAt: users.deletedAt })
    .from(oauthIdentities)
    .innerJoin(users, eq(users.id, oauthIdentities.userId))
    .where(and(eq(oauthIdentities.provider, identity.provider), eq(oauthIdentities.subject, identity.subject)))
    .limit(1)
  if (linked) {
    if (linked.deletedAt || linked.status !== 'ACTIVE') throw new AppError('ACCOUNT_DISABLED')
    if (linked.role !== 'STUDENT') throw new AppError('OAUTH_PASSWORD_ONLY')
    await db
      .update(oauthIdentities)
      .set({ lastUsedAt: now, ...(email ? { email } : {}), ...(identity.refreshToken ? { refreshToken: identity.refreshToken } : {}) })
      .where(eq(oauthIdentities.id, linked.identityId))
    const session = await startSession(db, linked.userId, identity.provider, meta, now)
    return { kind: 'session', userId: linked.userId, role: linked.role, session }
  }

  // 2) بريد مؤكَّد لحساب موجود
  if (email && identity.emailVerified) {
    const [existing] = await db
      .select({ id: users.id, role: users.role, status: users.status, deletedAt: users.deletedAt, emailVerifiedAt: users.emailVerifiedAt })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
    if (existing && !existing.deletedAt) {
      if (existing.role !== 'STUDENT') throw new AppError('OAUTH_PASSWORD_ONLY')
      if (existing.status !== 'ACTIVE') throw new AppError('ACCOUNT_DISABLED')
      // التسجيل العادي لا يؤكّد البريد: من سجّل ببريد غيره قبل صاحبه تُغلق جلساته الآن، ويصير البريد مؤكَّدًا
      if (!existing.emailVerifiedAt) {
        await db.update(users).set({ emailVerifiedAt: now }).where(eq(users.id, existing.id))
        await revokeAllSessions(db, existing.id)
      }
      await db
        .insert(oauthIdentities)
        .values({ userId: existing.id, provider: identity.provider, subject: identity.subject, email, refreshToken: identity.refreshToken ?? null, lastUsedAt: now })
        .onConflictDoNothing()
      await writeActivity(db, { userId: existing.id, event: 'auth.oauth.link', meta: { provider: identity.provider.toLowerCase() } })
      const session = await startSession(db, existing.id, identity.provider, meta, now)
      return { kind: 'session', userId: existing.id, role: existing.role, session }
    }
  }

  // 3) حساب جديد: تذكرة إكمال
  const token = newToken()
  const fullName = cleanName(identity.fullName)
  await db.insert(oauthTickets).values({
    tokenHash: sha256(token),
    kind: 'SIGNUP',
    provider: identity.provider,
    subject: identity.subject,
    email,
    emailVerified: identity.emailVerified,
    fullName,
    refreshToken: identity.refreshToken ?? null,
    expiresAt: new Date(now.getTime() + SIGNUP_TTL_MS)
  })
  // تنظيف خفيف للتذاكر المنتهية
  await db.delete(oauthTickets).where(lt(oauthTickets.expiresAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)))
  return { kind: 'signup', token, email, fullName, provider: identity.provider }
}

/** ما تعرضه صفحة إكمال الحساب من التذكرة (دون استهلاكها) */
export async function readSignupTicket(db: Db, token: string | null | undefined, now: Date = new Date()) {
  if (!token) return null
  const [row] = await db
    .select({ provider: oauthTickets.provider, email: oauthTickets.email, emailVerified: oauthTickets.emailVerified, fullName: oauthTickets.fullName })
    .from(oauthTickets)
    .where(and(eq(oauthTickets.tokenHash, sha256(token)), eq(oauthTickets.kind, 'SIGNUP'), isNull(oauthTickets.consumedAt), gt(oauthTickets.expiresAt, now)))
    .limit(1)
  if (!row) return null
  return { provider: row.provider as OAuthProvider, email: row.email, emailVerified: row.emailVerified, fullName: row.fullName }
}

/** بريد داخلي حين لا يعطي المزوّد بريدًا (حالة نادرة في Apple): الحساب يُعرف بهاتفه */
export function placeholderEmail(provider: OAuthProvider, subject: string): string {
  return `${provider.toLowerCase()}-${sha256(subject).slice(0, 20)}@oauth.madrasadz.invalid`
}

export type OAuthSignupInput = Omit<RegisterInput, 'password' | 'email'>

/** إكمال الحساب: يستهلك التذكرة مرة واحدة، وينشئ التلميذ ويربط الهوية في معاملة واحدة. */
export async function completeOAuthSignup(db: Db, token: string, input: OAuthSignupInput, meta: RequestMeta = {}, now: Date = new Date()) {
  const ticket = await readSignupTicket(db, token, now)
  if (!ticket) throw new AppError('OAUTH_TICKET_EXPIRED')
  const [full] = await db.select().from(oauthTickets).where(eq(oauthTickets.tokenHash, sha256(token))).limit(1)
  if (!full) throw new AppError('OAUTH_TICKET_EXPIRED')

  // سباق: الهوية رُبطت منذ إصدار التذكرة (ضغطتان) ⇒ دخول عادي
  const [already] = await db
    .select({ userId: oauthIdentities.userId })
    .from(oauthIdentities)
    .where(and(eq(oauthIdentities.provider, full.provider), eq(oauthIdentities.subject, full.subject)))
    .limit(1)
  if (already) {
    await db.update(oauthTickets).set({ consumedAt: now }).where(eq(oauthTickets.id, full.id))
    const session = await startSession(db, already.userId, full.provider as OAuthProvider, meta, now)
    return { userId: already.userId, studentId: null, session }
  }

  const email = full.email ?? placeholderEmail(full.provider as OAuthProvider, full.subject)
  const r = await createStudentAccount(db, { ...input, email }, unusablePasswordHash(), meta, async (tx, userId) => {
    // الاستهلاك داخل المعاملة: تذكرة واحدة ⇒ حساب واحد حتى مع طلبين متزامنين
    const consumed = await tx
      .update(oauthTickets)
      .set({ consumedAt: now })
      .where(and(eq(oauthTickets.id, full.id), isNull(oauthTickets.consumedAt)))
      .returning({ id: oauthTickets.id })
    if (consumed.length === 0) throw new AppError('OAUTH_TICKET_EXPIRED')
    await tx.insert(oauthIdentities).values({
      userId,
      provider: full.provider,
      subject: full.subject,
      email: full.email,
      refreshToken: full.refreshToken,
      lastUsedAt: now
    })
    if (full.email && full.emailVerified) await tx.update(users).set({ emailVerifiedAt: now }).where(eq(users.id, userId))
  })
  return r
}

/**
 * تسليم الدخول من المتصفح إلى تطبيق الآيفون (Google عبر نافذة النظام): الصفحة لا تضع كوكي الجلسة
 * بل تعيد التطبيق برمز صالح دقيقتين ومرة واحدة.
 */
export async function createLoginHandoff(db: Db, userId: string, provider: OAuthProvider, now: Date = new Date()): Promise<string> {
  const token = newToken()
  await db.insert(oauthTickets).values({ tokenHash: sha256(token), kind: 'LOGIN', provider, subject: '-', userId, expiresAt: new Date(now.getTime() + HANDOFF_TTL_MS) })
  return token
}

export async function redeemLoginHandoff(db: Db, token: string, meta: RequestMeta = {}, now: Date = new Date()) {
  const [row] = await db
    .update(oauthTickets)
    .set({ consumedAt: now })
    .where(and(eq(oauthTickets.tokenHash, sha256(token)), eq(oauthTickets.kind, 'LOGIN'), isNull(oauthTickets.consumedAt), gt(oauthTickets.expiresAt, now)))
    .returning({ userId: oauthTickets.userId, provider: oauthTickets.provider })
  if (!row?.userId) throw new AppError('OAUTH_TICKET_EXPIRED')
  const [user] = await db.select({ role: users.role, status: users.status, deletedAt: users.deletedAt }).from(users).where(eq(users.id, row.userId)).limit(1)
  if (!user || user.deletedAt || user.status !== 'ACTIVE') throw new AppError('ACCOUNT_DISABLED')
  const session = await createSession(db, { userId: row.userId, ...meta })
  return { userId: row.userId, role: user.role, session }
}

/** هويات الحساب (لحذف الحساب: إلغاء إذن Apple ثم فكّ الربط) */
export async function identitiesOf(db: Db, userId: string) {
  return db.select({ id: oauthIdentities.id, provider: oauthIdentities.provider, refreshToken: oauthIdentities.refreshToken }).from(oauthIdentities).where(eq(oauthIdentities.userId, userId))
}
