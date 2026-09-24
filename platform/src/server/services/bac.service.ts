/** قراءة مواضيع البكالوريا السابقة (روابط DzExams) للتبويب العام */
import { and, desc, eq, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { bacExams } from '@/server/db/schema'

export interface BacFilter {
  subject?: string | null
  stream?: string | null
  year?: number | null
}

export async function listBacExams(db: Db, f: BacFilter = {}) {
  const where = and(
    f.subject ? eq(bacExams.subjectSlug, f.subject) : undefined,
    f.stream ? eq(bacExams.streamName, f.stream) : undefined,
    f.year ? eq(bacExams.year, f.year) : undefined
  )
  const [exams, subjects, years, streams, last] = await Promise.all([
    db.select().from(bacExams).where(where).orderBy(desc(bacExams.year), bacExams.subjectName, bacExams.streamName).limit(500),
    db
      .select({ slug: bacExams.subjectSlug, name: sql<string>`min(${bacExams.subjectName})`, count: sql<number>`count(*)::int` })
      .from(bacExams)
      .groupBy(bacExams.subjectSlug)
      .orderBy(sql`min(${bacExams.subjectName})`),
    db.selectDistinct({ year: bacExams.year }).from(bacExams).where(f.subject ? eq(bacExams.subjectSlug, f.subject) : undefined).orderBy(desc(bacExams.year)),
    db.selectDistinct({ name: bacExams.streamName }).from(bacExams).where(f.subject ? eq(bacExams.subjectSlug, f.subject) : undefined),
    db.select({ at: sql<Date | null>`max(${bacExams.fetchedAt})` }).from(bacExams)
  ])
  return {
    exams,
    subjects,
    years: years.map((y) => y.year).filter((y): y is number => y !== null),
    streams: streams.map((s) => s.name).filter((s): s is string => !!s).sort(),
    lastSync: last[0]?.at ?? null
  }
}
