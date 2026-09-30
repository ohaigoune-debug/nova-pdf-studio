/**
 * زرع دليل أساتذة الثانوي — idempotent: يضيف الناقص بالاسم المطبَّع ولا يمسّ ما راجعه المشرف
 * (الحالة، القناة المختارة). المواد تُلحق إن كانت ناقصة.
 */
import { eq } from 'drizzle-orm'
import type { Db } from './connect'
import { SECONDARY_EDUCATORS } from './educators-data'
import { educationStages, educatorSubjects, educators, subjects } from './schema'

export const educatorKey = (name: string): string =>
  name
    .normalize('NFKC')
    .replace(/[ً-ْـ]/g, '')
    .replace(/[–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

export async function seedEducators(db: Db): Promise<{ added: number }> {
  const [secondary] = await db.select({ id: educationStages.id }).from(educationStages).where(eq(educationStages.code, 'SECONDARY')).limit(1)
  const subjectId = new Map((await db.select({ id: subjects.id, code: subjects.code }).from(subjects)).map((s) => [s.code, s.id]))
  if (!secondary || subjectId.size === 0) return { added: 0 }
  let added = 0
  for (const e of SECONDARY_EDUCATORS) {
    const key = educatorKey(e.name)
    let [row] = await db.select({ id: educators.id }).from(educators).where(eq(educators.nameKey, key)).limit(1)
    if (!row) {
      ;[row] = await db.insert(educators).values({ name: e.name, nameKey: key, stageId: secondary.id, note: e.note }).onConflictDoNothing({ target: educators.nameKey }).returning({ id: educators.id })
      if (row) added++
    }
    if (!row) continue
    for (const [code, rank] of e.subjects) {
      const sid = subjectId.get(code)
      if (!sid) continue
      await db.insert(educatorSubjects).values({ educatorId: row.id, subjectId: sid, rank }).onConflictDoNothing()
    }
  }
  return { added }
}
