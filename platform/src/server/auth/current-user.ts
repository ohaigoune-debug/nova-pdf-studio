import 'server-only'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { getDb } from '@/server/db/client'
import type { UserRole } from '@/server/db/schema/enums'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { resolveActor, SESSION_COOKIE } from './session'

/** الفاعل الحالي من كوكي الجلسة (مع cache لكل طلب). */
export const getCurrentActor = cache(async (): Promise<Actor | null> => {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) {
    // دعم Bearer للجوال
    const h = await headers()
    const auth = h.get('authorization')
    if (auth?.startsWith('Bearer ')) return resolveActor(await getDb(), auth.slice(7))
    return null
  }
  return resolveActor(await getDb(), token)
})

export async function requireActor(): Promise<Actor> {
  const actor = await getCurrentActor()
  if (!actor) throw new AppError('AUTH_REQUIRED')
  return actor
}

export async function requireRole(...roles: UserRole[]): Promise<Actor> {
  const actor = await requireActor()
  if (!roles.includes(actor.role)) throw new AppError('FORBIDDEN')
  return actor
}

/** للاستعمال في Layouts: يعيد التوجيه بدل رمي خطأ. */
export async function requirePageActor(...roles: UserRole[]): Promise<Actor> {
  const actor = await getCurrentActor()
  if (!actor) redirect('/login')
  if (roles.length > 0 && !roles.includes(actor.role)) redirect(homeFor(actor.role))
  return actor
}

export function homeFor(role: UserRole): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return '/admin'
    case 'TEACHER':
      return '/teacher'
    case 'STUDENT':
      return '/student'
    default:
      return '/'
  }
}

export async function requestMeta() {
  const h = await headers()
  return {
    userAgent: h.get('user-agent'),
    ip: (h.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || null
  }
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt
  })
}

export async function clearSessionCookie() {
  const jar = await cookies()
  jar.delete(SESSION_COOKIE)
}

export async function currentSessionToken(): Promise<string | null> {
  const jar = await cookies()
  return jar.get(SESSION_COOKIE)?.value ?? null
}
