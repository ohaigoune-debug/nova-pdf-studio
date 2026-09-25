/**
 * زرع المنهاج والمصادر — idempotent: يُشغَّل عند كل bootstrap، فيضيف الناقص ويحدّث الروابط
 * (الطور، الرمز القصير، الأم) دون أن يمسّ أسماء أو بيانات يعدّلها المشرف.
 */
import { eq, sql } from 'drizzle-orm'
import type { Db } from './connect'
import { CURRICULUM_VERSION, GRADE_STREAMS, GRADES, OFFERINGS, SOURCES, STAGES, STREAM_DATA, SUBJECTS } from './curriculum-data'
import { contentSources, curriculumVersions, educationStages, gradeStreams, levels, streams, subjectOfferings, subjects } from './schema'

export async function seedCurriculum(db: Db): Promise<void> {
  await db
    .insert(educationStages)
    .values(STAGES.map((s) => ({ code: s.code, nameAr: s.ar, nameFr: s.fr, examCode: s.exam, sortOrder: s.order })))
    .onConflictDoUpdate({ target: educationStages.code, set: { examCode: sql`excluded.exam_code`, sortOrder: sql`excluded.sort_order` } })
  const stageId = new Map((await db.select().from(educationStages)).map((s) => [s.code, s.id]))

  // الصفوف: الموجودة (1AS…3AS) تأخذ طورها ورمزها وترتيبها العام، ويبقى اسمها
  await db
    .insert(levels)
    .values(GRADES.map((g) => ({ code: g.code, nameAr: g.ar, slug: g.slug, stageId: stageId.get(g.stage)!, sortOrder: g.order })))
    .onConflictDoUpdate({ target: levels.code, set: { slug: sql`excluded.slug`, stageId: sql`excluded.stage_id`, sortOrder: sql`excluded.sort_order` } })

  await db
    .insert(streams)
    .values(STREAM_DATA.map((s) => ({ code: s.code, nameAr: s.ar, slug: s.slug, sortOrder: s.order })))
    .onConflictDoUpdate({ target: streams.code, set: { slug: sql`excluded.slug` } })
  const streamId = new Map((await db.select({ id: streams.id, code: streams.code }).from(streams)).map((s) => [s.code, s.id]))
  for (const s of STREAM_DATA.filter((x) => x.parent)) {
    await db.update(streams).set({ parentId: streamId.get(s.parent!)! }).where(eq(streams.code, s.code))
  }

  await db
    .insert(subjects)
    .values(SUBJECTS.map((s) => ({ code: s.code, slug: s.slug, nameAr: s.ar, nameFr: s.fr, sortOrder: s.order })))
    .onConflictDoNothing({ target: subjects.code })

  await db.insert(curriculumVersions).values(CURRICULUM_VERSION).onConflictDoNothing({ target: curriculumVersions.code })
  const [version] = await db.select({ id: curriculumVersions.id }).from(curriculumVersions).where(eq(curriculumVersions.code, CURRICULUM_VERSION.code))

  const levelId = new Map((await db.select({ id: levels.id, code: levels.code }).from(levels)).map((l) => [l.code, l.id]))
  const subjectId = new Map((await db.select({ id: subjects.id, code: subjects.code }).from(subjects)).map((s) => [s.code, s.id]))

  const gs = Object.entries(GRADE_STREAMS).flatMap(([grade, codes]) => codes.map((code) => ({ levelId: levelId.get(grade)!, streamId: streamId.get(code)! })))
  await db.insert(gradeStreams).values(gs).onConflictDoNothing()

  const offerings = OFFERINGS.flatMap((o) =>
    o.subjects.map((code, i) => ({
      levelId: levelId.get(o.grade)!,
      streamId: o.stream ? streamId.get(o.stream)! : null,
      subjectId: subjectId.get(code)!,
      curriculumVersionId: version!.id,
      isExamSubject: o.exam.includes(code),
      sortOrder: i
    }))
  )
  for (let i = 0; i < offerings.length; i += 200) await db.insert(subjectOfferings).values(offerings.slice(i, i + 200)).onConflictDoNothing()

  await db
    .insert(contentSources)
    .values(SOURCES.map((s) => ({ code: s.code, type: s.type, name: s.name, baseUrl: s.baseUrl, attribution: s.attribution })))
    .onConflictDoNothing({ target: contentSources.code })
}
