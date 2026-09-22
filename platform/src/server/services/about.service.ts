/**
 * قسم «الأستاذ» على الصفحة الرئيسية: اسم وسطر تعريفي واقتباس، يحرّرها المشرف من الإعدادات
 * بلا لمس الشيفرة. الصورة ثابتة في public/teacher.webp. القسم لا يظهر ما دام الاسم فارغاً.
 */
import { eq } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { appSettings } from '@/server/db/schema'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'

export interface AboutSettings {
  name: string
  title: string
  bio: string
  quote: string
}

const KEY = 'about'
/** ما يظهر قبل أن يحفظ المشرف شيئاً: صاحب المنصة. تعديله من الإعدادات لا من الشيفرة */
export const DEFAULT_ABOUT: AboutSettings = { name: 'الدكتور حيقون أسامة', title: 'أستاذ الأدب العربي', bio: '', quote: '' }
const LIMITS: Record<keyof AboutSettings, number> = { name: 80, title: 120, bio: 600, quote: 240 }

function clean(v: Partial<AboutSettings>): AboutSettings {
  const out = { name: '', title: '', bio: '', quote: '' }
  for (const k of Object.keys(LIMITS) as (keyof AboutSettings)[]) {
    const raw = v[k]
    out[k] = typeof raw === 'string' ? raw.trim().slice(0, LIMITS[k]) : ''
  }
  return out
}

/** عامّ: تقرؤه الصفحة الرئيسية بلا فاعل. لا سجلّ محفوظاً ⇒ الافتراضي */
export async function getAboutSettings(db: Db): Promise<AboutSettings> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, KEY)).limit(1)
  return row ? clean(row.value as Partial<AboutSettings>) : { ...DEFAULT_ABOUT }
}

export async function updateAboutSettings(db: Db, actor: Actor, patch: Partial<AboutSettings>): Promise<AboutSettings> {
  assertRole(actor, 'SUPER_ADMIN')
  const current = await getAboutSettings(db)
  const next = clean({ ...current, ...patch })
  await db
    .insert(appSettings)
    .values({ key: KEY, value: next })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: next, updatedAt: new Date() } })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'settings.about', entityType: 'settings', entityId: null, oldValue: { ...current }, newValue: { ...next } })
  return next
}
