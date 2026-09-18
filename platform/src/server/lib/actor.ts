import type { UserRole } from '@/server/db/schema/enums'
import { AppError } from './errors'

/**
 * الفاعل الحالي كما استُخرج من الجلسة. لا يُبنى أبداً من مدخلات العميل.
 * - الأستاذ: workspaceId + teacherId ثابتان.
 * - مساعد الأستاذ: workspaceId = مساحة الأستاذ الذي يتبعه (من teacher_assistants النشطة)، teacherId = null.
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

/**
 * طاقم الحضور: الأستاذ ومساعده (والمشرف). يُستعمل فقط في مسارات الحصص/الحضور/السكانر
 * وقوائم الطلاب للقراءة — لا في التصحيح ولا المحتوى ولا إدارة الأفواج.
 */
export const ATTENDANCE_STAFF_ROLES: readonly UserRole[] = ['TEACHER', 'ASSISTANT', 'SUPER_ADMIN']

export function assertAttendanceStaff(actor: Actor): void {
  assertRole(actor, ...ATTENDANCE_STAFF_ROLES)
  if (actor.role !== 'SUPER_ADMIN' && !actor.workspaceId) throw new AppError('ASSISTANT_NO_WORKSPACE')
}

/** المساحة التي يعمل فيها طاقم الحضور (الأستاذ أو مساعده). المشرف يمرّر مساحة صريحة أو null = الكل. */
export function staffWorkspaceOf(actor: Actor, explicit?: string | null): string | null {
  if (actor.role === 'SUPER_ADMIN') return explicit ?? null
  assertAttendanceStaff(actor)
  return actor.workspaceId
}

/** هل السجل (بمساحته) ضمن نطاق الفاعل؟ المشرف يرى الكل. */
export function inWorkspaceScope(actor: Actor, workspaceId: string): boolean {
  return actor.role === 'SUPER_ADMIN' || (!!actor.workspaceId && actor.workspaceId === workspaceId)
}

export function studentIdOf(actor: Actor): string {
  if (actor.role !== 'STUDENT' || !actor.studentId) throw new AppError('FORBIDDEN')
  return actor.studentId
}

/** جذر لوحة الفاعل (لإعادة التوجيه بعد الإجراءات المشتركة بين الأستاذ ومساعده). */
export function portalBase(role: UserRole): string {
  return role === 'ASSISTANT' ? '/assistant' : '/teacher'
}
