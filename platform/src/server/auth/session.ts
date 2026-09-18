import { randomBytes } from 'node:crypto'
import { and, eq, gt, isNull } from 'drizzle-orm'
import type { Db } from '@/server/db/client'
import { profiles, sessions, students, teacherAssistants, teachers, users } from '@/server/db/schema'
import type { UserRole } from '@/server/db/schema/enums'
import { sha256 } from '@/server/lib/codes'
import type { Actor } from '@/server/lib/actor'

export const SESSION_COOKIE = 'madrasa_session'
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const SESSION_REFRESH_MS = 24 * 60 * 60 * 1000

export interface CreatedSession {
  token: string
  expiresAt: Date
}

export async function createSession(
  db: Db,
  params: { userId: string; userAgent?: string | null; ip?: string | null; deviceName?: string | null }
): Promise<CreatedSession> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await db.insert(sessions).values({
    userId: params.userId,
    tokenHash: sha256(token),
    userAgent: params.userAgent ?? null,
    ip: params.ip ?? null,
    deviceName: params.deviceName ?? guessDeviceName(params.userAgent),
    expiresAt
  })
  return { token, expiresAt }
}

export async function revokeSession(db: Db, token: string): Promise<void> {
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, sha256(token)))
}

export async function revokeSessionById(db: Db, userId: string, sessionId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
}

export async function revokeAllSessions(db: Db, userId: string): Promise<void> {
  await db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
}

/** يتحقق من الجلسة ويرجع الفاعل الكامل أو null. */
export async function resolveActor(db: Db, token: string | undefined | null): Promise<Actor | null> {
  if (!token) return null
  const now = new Date()
  const rows = await db
    .select({
      sessionId: sessions.id,
      lastSeenAt: sessions.lastSeenAt,
      userId: users.id,
      role: users.role,
      email: users.email,
      userStatus: users.status,
      fullName: profiles.fullName,
      teacherId: teachers.id,
      workspaceId: teachers.workspaceId,
      assistantWorkspaceId: teacherAssistants.workspaceId,
      studentId: students.id
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .leftJoin(teachers, eq(teachers.userId, users.id))
    // المساعد: مساحته = مساحة الأستاذ الذي يتبعه (العضوية النشطة فقط؛ الإلغاء يُسقطها فوراً)
    .leftJoin(teacherAssistants, and(eq(teacherAssistants.userId, users.id), eq(teacherAssistants.status, 'ACTIVE')))
    .leftJoin(students, eq(students.userId, users.id))
    .where(and(eq(sessions.tokenHash, sha256(token)), isNull(sessions.revokedAt), gt(sessions.expiresAt, now), isNull(users.deletedAt)))
    .limit(1)

  const row = rows[0]
  if (!row) return null
  if (row.userStatus !== 'ACTIVE') return null

  // تحديث last_seen مرة يومياً على الأكثر لتخفيف الكتابة
  if (now.getTime() - new Date(row.lastSeenAt).getTime() > SESSION_REFRESH_MS) {
    await db
      .update(sessions)
      .set({ lastSeenAt: now, expiresAt: new Date(now.getTime() + SESSION_TTL_MS) })
      .where(eq(sessions.id, row.sessionId))
  }

  return {
    userId: row.userId,
    role: row.role as UserRole,
    email: row.email,
    fullName: row.fullName ?? row.email,
    teacherId: row.teacherId ?? null,
    workspaceId: row.workspaceId ?? (row.role === 'ASSISTANT' ? (row.assistantWorkspaceId ?? null) : null),
    studentId: row.studentId ?? null
  }
}

export async function listUserSessions(db: Db, userId: string) {
  return db
    .select({
      id: sessions.id,
      deviceName: sessions.deviceName,
      userAgent: sessions.userAgent,
      ip: sessions.ip,
      lastSeenAt: sessions.lastSeenAt,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt
    })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
    .orderBy(sessions.lastSeenAt)
}

function guessDeviceName(ua: string | null | undefined): string {
  if (!ua) return 'جهاز غير معروف'
  if (/iPhone/i.test(ua)) return 'iPhone'
  if (/iPad/i.test(ua)) return 'iPad'
  if (/Android/i.test(ua)) return 'Android'
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Macintosh/i.test(ua)) return 'Mac'
  if (/Linux/i.test(ua)) return 'Linux'
  return 'متصفح'
}
