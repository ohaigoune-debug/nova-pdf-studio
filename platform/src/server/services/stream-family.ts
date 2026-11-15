import { eq } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { streams } from '@/server/db/schema'

/**
 * عائلة الشعبة: الشعبة نفسها وأمّها (وجدّتها إن وُجدت). «تقني رياضي — هندسة مدنية» يرى أيضًا ما صُنّف
 * للشعبة الأم «تقني رياضي». يعود [] إن لم تُحدَّد شعبة (= كل الشعب).
 */
export async function streamFamily(db: Db, streamId: string | null | undefined): Promise<string[]> {
  if (!streamId) return []
  const out: string[] = []
  let cur: string | null = streamId
  for (let i = 0; cur && i < 4; i++) {
    const [row] = await db.select({ id: streams.id, parentId: streams.parentId }).from(streams).where(eq(streams.id, cur)).limit(1)
    if (!row) break
    out.push(row.id)
    cur = row.parentId
  }
  return out
}
