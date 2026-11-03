import { eq } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { appSettings } from '@/server/db/schema'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { ttlDelete, ttlMemo } from '@/server/lib/ttl-cache'
import { cleanHiddenEntries } from '@/lib/student-menu'

const KEY = 'student.hidden_entries'

/**
 * الأقسام التي أخفاها المشرف من حساب التلميذ (كما اختارها، قبل التوسيع).
 * تُقرأ مرتين في كل صفحة للتلميذ (التخطيط والقائمة): تُحفظ 15 ثانية في كل عملية، وتُبطَل فور تعديلها هنا.
 */
export async function getHiddenStudentEntries(db: Db): Promise<string[]> {
  return ttlMemo(KEY, 15_000, async () => {
    const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, KEY)).limit(1)
    return Array.isArray(row?.value) ? cleanHiddenEntries(row.value as string[]) : []
  })
}

export async function setHiddenStudentEntries(db: Db, actor: Actor, input: string[]): Promise<string[]> {
  assertRole(actor, 'SUPER_ADMIN')
  const before = await getHiddenStudentEntries(db)
  const next = cleanHiddenEntries(input)
  await db.insert(appSettings).values({ key: KEY, value: next }).onConflictDoUpdate({ target: appSettings.key, set: { value: next, updatedAt: new Date() } })
  ttlDelete(KEY)
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'settings.student_menu', entityType: 'settings', entityId: null, oldValue: { hidden: before }, newValue: { hidden: next } })
  return next
}
