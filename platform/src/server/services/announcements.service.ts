/**
 * رسائل الأستاذ إلى تلاميذه: للكل أو لأفواج محدّدة. تصل إشعاراً داخل المنصة
 * (ودفعاً على الهاتف لمن فعّله)، ويبقى سجلّ ما أُرسل.
 */
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { announcements, groups, groupStudents, students } from '@/server/db/schema'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError } from '@/server/lib/errors'
import { assertGroupAccess } from './groups.service'
import { notifyMany } from './notifications.service'

/** من يبقى في الفوج ويتلقّى رسائله: كل الحالات عدا من غادر أو أنهى */
export const REACHABLE_STATUSES = ['ACTIVE', 'SUSPENDED', 'SUSPENDED_DUE_TO_ABSENCE'] as const

/** مستخدمو تلاميذ المساحة (أو أفواج منها)، بلا تكرار */
export async function studentUserIds(db: Db, workspaceId: string, groupIds: string[] = []): Promise<string[]> {
  const rows = await db
    .selectDistinct({ userId: students.userId })
    .from(groupStudents)
    .innerJoin(groups, eq(groups.id, groupStudents.groupId))
    .innerJoin(students, eq(students.id, groupStudents.studentId))
    .where(
      and(
        eq(groups.workspaceId, workspaceId),
        isNull(groups.deletedAt),
        inArray(groupStudents.status, [...REACHABLE_STATUSES]),
        groupIds.length ? inArray(groups.id, groupIds) : undefined
      )
    )
  return rows.map((r) => r.userId)
}

function workspaceOf(actor: Actor): string {
  assertRole(actor, 'TEACHER')
  if (!actor.workspaceId) throw new AppError('FORBIDDEN')
  return actor.workspaceId
}

export async function sendAnnouncement(db: Db, actor: Actor, input: { title: string; body: string; link?: string | null; groupIds: string[] }) {
  const workspaceId = workspaceOf(actor)
  const title = input.title.trim()
  const body = input.body.trim()
  if (title.length < 2 || body.length < 2) throw new AppError('VALIDATION')
  const link = input.link?.trim() || null
  if (link && !/^(https:\/\/|\/)/.test(link)) throw new AppError('VALIDATION', { field: 'link' })
  const groupIds = [...new Set(input.groupIds)]
  for (const g of groupIds) await assertGroupAccess(db, actor, g)
  const recipients = await studentUserIds(db, workspaceId, groupIds)
  if (recipients.length === 0) throw new AppError('NO_RECIPIENTS')

  const [row] = await db.insert(announcements).values({ workspaceId, authorUserId: actor.userId, title, body, link, groupIds, recipients: recipients.length }).returning()
  // دفعات كي لا يثقل إدراج آلاف الإشعارات مرّة واحدة
  for (let i = 0; i < recipients.length; i += 500) {
    await notifyMany(
      db,
      recipients.slice(i, i + 500).map((userId) => ({ userId, workspaceId, type: 'ANNOUNCEMENT' as const, title: `📢 ${title}`, body, link: link ?? '/student/notifications', meta: { announcementId: row!.id, from: actor.fullName } }))
    )
  }
  await writeAudit(db, { actorUserId: actor.userId, workspaceId, action: 'announcement.send', entityType: 'announcement', entityId: row!.id, newValue: { title, groups: groupIds.length, recipients: recipients.length } })
  return row!
}

export async function listAnnouncements(db: Db, actor: Actor) {
  const workspaceId = workspaceOf(actor)
  const rows = await db.select().from(announcements).where(eq(announcements.workspaceId, workspaceId)).orderBy(desc(announcements.createdAt)).limit(100)
  const names = new Map((await db.select({ id: groups.id, name: groups.name }).from(groups).where(eq(groups.workspaceId, workspaceId))).map((g) => [g.id, g.name]))
  return rows.map((r) => ({ ...r, groupNames: r.groupIds.map((g) => names.get(g) ?? '—') }))
}
