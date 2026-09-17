import type { UserRole } from '@/server/db/schema/enums'
import { AppError } from './errors'

/**
 * الفاعل الحالي كما استُخرج من الجلسة. لا يُبنى أبداً من مدخلات العميل.
 * - الأستاذ: workspaceId + teacherId ثابتان.
 * - الطالب: studentId ثابت.
 * - المشرف: workspaceId = null ويرى الكل.
 */
export interface Actor {
  userId: string
  role: UserRole
  fullName: string
  email: string
  workspaceId: string | null
  teacherId: string | null
  studentId: string | null
}

export function assertRole(actor: Actor, ...roles: UserRole[]): void {
  if (!roles.includes(actor.role)) throw new AppError('FORBIDDEN')
}

/** يرجع workspace_id الإجباري للأستاذ. للمشرف يسمح بتمرير مساحة صريحة. */
export function workspaceOf(actor: Actor, explicit?: string | null): string {
  if (actor.role === 'TEACHER') {
    if (!actor.workspaceId) throw new AppError('FORBIDDEN')
    return actor.workspaceId
  }
  if (actor.role === 'SUPER_ADMIN') {
    if (explicit) return explicit
    throw new AppError('VALIDATION', { field: 'workspaceId' })
  }
  throw new AppError('FORBIDDEN')
}

export function isTeacherLike(actor: Actor): boolean {
  return actor.role === 'TEACHER' || actor.role === 'SUPER_ADMIN'
}

export function studentIdOf(actor: Actor): string {
  if (actor.role !== 'STUDENT' || !actor.studentId) throw new AppError('FORBIDDEN')
  return actor.studentId
}
