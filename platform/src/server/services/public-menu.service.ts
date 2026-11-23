import { eq } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { appSettings } from '@/server/db/schema'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { ttlDelete, ttlMemo } from '@/server/lib/ttl-cache'
import { cleanHiddenPublic, resolveHiddenPublic } from '@/lib/public-menu'

const KEY = 'public.hidden_entries'

/**
 * تبويبات الواجهة العامة المخفيّة (الترويسة والتذييل). تُقرأ في كل صفحة عامّة:
 * تُحفظ 15 ثانية في كل عمليّة، وتُبطَل فور تعديلها هنا.
 */
export async function getHiddenPublicEntries(db: Db): Promise<string[]> {
  return ttlMemo(KEY, 15_000, async () => {
    const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, KEY)).limit(1)
    return resolveHiddenPublic(row?.value)
  })
}

export async function setHiddenPublicEntries(db: Db, actor: Actor, input: readonly unknown[]): Promise<string[]> {
  assertRole(actor, 'SUPER_ADMIN')
  const before = await getHiddenPublicEntries(db)
  const next = cleanHiddenPublic(input)
  await db.insert(appSettings).values({ key: KEY, value: next }).onConflictDoUpdate({ target: appSettings.key, set: { value: next, updatedAt: new Date() } })
  ttlDelete(KEY)
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'settings.public_menu', entityType: 'settings', entityId: null, oldValue: { hidden: before }, newValue: { hidden: next } })
  return next
}
