import { asc, eq, inArray } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { LEVEL_COOKIE, levelCodeOf, levelLabel, PICKER_LEVELS } from '@/lib/levels'
import type { Db } from '@/server/db/connect'
import { levels, subjectOfferings, subjects } from '@/server/db/schema'

export interface LevelScope {
  id: string
  code: string
  /** الاسم الرسمي في القاعدة (السنة الرابعة متوسط…) */
  name: string
  /** التسمية القصيرة (4 متوسط) */
  label: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** صفّ القاعدة لرمز مستوى (أو معرّفه) */
export async function levelByCodeOrId(db: Db, raw: string): Promise<LevelScope | null> {
  const code = levelCodeOf(raw)
  const where = code ? eq(levels.code, code) : UUID.test(raw) ? eq(levels.id, raw) : null
  if (!where) return null
  const [row] = await db.select({ id: levels.id, code: levels.code, name: levels.nameAr }).from(levels).where(where).limit(1)
  return row ? { ...row, label: levelLabel(row.code) ?? row.name } : null
}

/**
 * المستوى المعمول به في الصفحة: ?level= في الرابط أولاً (all = كل المستويات)، وإلا اختيار الزائر المحفوظ.
 * لا يُرمى خطأ أبداً: مستوى مجهول = كل المستويات.
 */
export async function currentLevel(db: Db, fromUrl?: string | null): Promise<LevelScope | null> {
  if (fromUrl === 'all') return null
  if (fromUrl) {
    const hit = await levelByCodeOrId(db, fromUrl)
    if (hit) return hit
  }
  let saved: string | undefined
  try {
    saved = (await cookies()).get(LEVEL_COOKIE)?.value
  } catch {
    saved = undefined
  }
  return saved ? levelByCodeOrId(db, saved) : null
}

/** رمز المستوى المحفوظ في الكوكي (للترويسة) */
export async function savedLevelCode(): Promise<string | null> {
  try {
    return levelCodeOf((await cookies()).get(LEVEL_COOKIE)?.value)
  } catch {
    return null
  }
}

/** معرّفات مستويات القائمة بترتيبها (للمرشّحات) */
export async function pickerLevelRows(db: Db): Promise<LevelScope[]> {
  const rows = await db
    .select({ id: levels.id, code: levels.code, name: levels.nameAr })
    .from(levels)
    .where(inArray(levels.code, PICKER_LEVELS.map((l) => l.code)))
    .orderBy(asc(levels.sortOrder))
  return rows.map((r) => ({ ...r, label: levelLabel(r.code) ?? r.name }))
}

/** المواد المقرّرة في المستوى (لقائمة «المادة»)؛ بلا مستوى ← كل المواد */
export async function subjectsForLevel(db: Db, levelId: string | null): Promise<{ id: string; name: string }[]> {
  if (levelId) {
    const rows = await db
      .selectDistinct({ id: subjects.id, name: subjects.nameAr, sort: subjects.sortOrder })
      .from(subjectOfferings)
      .innerJoin(subjects, eq(subjects.id, subjectOfferings.subjectId))
      .where(eq(subjectOfferings.levelId, levelId))
      .orderBy(asc(subjects.sortOrder))
    if (rows.length) return rows.map(({ id, name }) => ({ id, name }))
  }
  return db.select({ id: subjects.id, name: subjects.nameAr }).from(subjects).orderBy(asc(subjects.sortOrder))
}
