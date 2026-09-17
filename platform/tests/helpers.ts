import { eq } from 'drizzle-orm'
import { createDatabase, type DatabaseHandle, type Db } from '@/server/db/connect'
import { academicYears, levels, profiles, streams, students, teacherWorkspaces, teachers, users, wilayas } from '@/server/db/schema'
import { hashPassword } from '@/server/auth/password'
import { createSession, resolveActor } from '@/server/auth/session'
import type { Actor } from '@/server/lib/actor'
import { createTeacher } from '@/server/services/admin.service'
import { registerStudent } from '@/server/services/auth.service'

let counter = 0
export const uniq = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${++counter}`

export async function setupDb(): Promise<DatabaseHandle> {
  const handle = await createDatabase('pglite://memory')
  await seedReference(handle.db)
  return handle
}

export async function seedReference(db: Db) {
  await db.insert(wilayas).values([
    { code: '24', nameAr: 'قالمة', nameFr: 'Guelma' },
    { code: '25', nameAr: 'قسنطينة', nameFr: 'Constantine' }
  ])
  await db.insert(levels).values([{ code: '3AS', nameAr: 'السنة الثالثة ثانوي', sortOrder: 3 }])
  await db.insert(streams).values([{ code: 'SCI', nameAr: 'علوم تجريبية', sortOrder: 1 }])
  await db.insert(academicYears).values({ label: '2026/2027', startsOn: '2026-09-01', endsOn: '2027-06-30', isCurrent: true })
}

export async function makeAdmin(db: Db): Promise<Actor> {
  const email = uniq('admin') + '@test.dz'
  const [u] = await db.insert(users).values({ email, passwordHash: hashPassword('Admin@12345'), role: 'SUPER_ADMIN' }).returning()
  if (!u) throw new Error('admin insert failed')
  await db.insert(profiles).values({ userId: u.id, fullName: 'المشرف العام' })
  return actorOf(db, u.id)
}

export async function makeTeacher(db: Db, admin: Actor, name = 'أستاذ تجريبي'): Promise<Actor> {
  const email = uniq('teacher') + '@test.dz'
  const r = await createTeacher(db, admin, { email, password: 'Teacher@12345', fullName: name })
  return actorOf(db, r.userId)
}

export async function makeStudent(db: Db, name = 'طالب تجريبي'): Promise<Actor> {
  const email = uniq('student') + '@test.dz'
  const r = await registerStudent(db, { email, password: 'Student@12345', fullName: name })
  return actorOf(db, r.userId)
}

/** يبني Actor عبر جلسة حقيقية (نفس المسار الذي يستعمله التطبيق). */
export async function actorOf(db: Db, userId: string): Promise<Actor> {
  const s = await createSession(db, { userId })
  const actor = await resolveActor(db, s.token)
  if (!actor) throw new Error('could not resolve actor')
  return actor
}

export async function workspaceIdOfTeacher(db: Db, teacherActor: Actor): Promise<string> {
  const [t] = await db.select({ ws: teachers.workspaceId }).from(teachers).where(eq(teachers.userId, teacherActor.userId))
  if (!t) throw new Error('teacher not found')
  return t.ws
}

export async function refIds(db: Db) {
  const [w] = await db.select().from(wilayas).where(eq(wilayas.code, '24'))
  const [l] = await db.select().from(levels)
  const [s] = await db.select().from(streams)
  const [y] = await db.select().from(academicYears)
  return { wilayaId: w?.id ?? null, levelId: l?.id ?? null, streamId: s?.id ?? null, yearId: y?.id ?? null }
}

export const _tables = { students, teacherWorkspaces }
