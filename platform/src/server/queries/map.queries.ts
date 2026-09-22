import { count, eq, isNull } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { students, users, wilayas } from '@/server/db/schema'

export interface WilayaCount {
  code: string
  name: string
  students: number
}

/**
 * عدد الطلاب في كل ولاية (كل الولايات الـ58 حتى ما عددها صفر).
 * أعداد مجمّعة فقط — لا أسماء — فتصلح للصفحة العامة كما للوحة المشرف.
 */
export async function studentsPerWilaya(db: Db): Promise<WilayaCount[]> {
  const [all, counts] = await Promise.all([
    db.select({ id: wilayas.id, code: wilayas.code, name: wilayas.nameAr }).from(wilayas),
    db
      .select({ wilayaId: students.wilayaId, n: count() })
      .from(students)
      .innerJoin(users, eq(users.id, students.userId))
      .where(isNull(users.deletedAt))
      .groupBy(students.wilayaId)
  ])
  const byId = new Map(counts.map((c) => [c.wilayaId, Number(c.n)]))
  return all.map((w) => ({ code: w.code, name: w.name, students: byId.get(w.id) ?? 0 })).sort((a, b) => a.code.localeCompare(b.code))
}
