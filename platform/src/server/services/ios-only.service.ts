import { eq } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { appSettings } from '@/server/db/schema'
import type { UserRole } from '@/server/db/schema/enums'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { isIosStudyOnly } from '@/server/lib/ios-study'
import { ttlDelete, ttlMemo } from '@/server/lib/ttl-cache'
import { expandHidden } from '@/lib/student-menu'
import { iosOnlyHiddenFor, withIosOnly } from '@/lib/ios-only'
import { getHiddenStudentEntries } from './student-menu.service'

const KEY = 'web.play_bac_ios_only'

/**
 * PLAY وبنك البكالوريات في تطبيق آيفون وحده؟ مفعّل ما لم يُطفئه المشرف (قرار المالك 13 نوفمبر 2026).
 * يُقرأ في كل صفحة للتلميذ: 15 ثانية في كل عملية، ويُبطَل فور تعديله هنا.
 */
export async function playBacIosOnly(db: Db): Promise<boolean> {
  return ttlMemo(KEY, 15_000, async () => {
    const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, KEY)).limit(1)
    return row?.value !== false
  })
}

export async function setPlayBacIosOnly(db: Db, actor: Actor, on: boolean): Promise<boolean> {
  assertRole(actor, 'SUPER_ADMIN')
  const before = await playBacIosOnly(db)
  await db.insert(appSettings).values({ key: KEY, value: on }).onConflictDoUpdate({ target: appSettings.key, set: { value: on, updatedAt: new Date() } })
  ttlDelete(KEY)
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'settings.play_bac_ios_only', entityType: 'settings', entityId: null, oldValue: { iosOnly: before }, newValue: { iosOnly: on } })
  return on
}

/** هل يُخفيان في هذا الطلب؟ (لا في تطبيق آيفون، ولا عن فريق المنصة) */
export async function playBacHiddenHere(db: Db, role?: UserRole | null): Promise<boolean> {
  return iosOnlyHiddenFor({ enabled: await playBacIosOnly(db), ios: await isIosStudyOnly(), role })
}

/** كل ما يُخفى عن التلميذ في هذا الطلب: ما أخفاه المشرف، ومعه PLAY والبنك خارج آيفون */
export async function studentHiddenPaths(db: Db): Promise<string[]> {
  const [entries, hide] = await Promise.all([getHiddenStudentEntries(db), playBacHiddenHere(db, 'STUDENT')])
  return withIosOnly(expandHidden(entries), hide)
}
