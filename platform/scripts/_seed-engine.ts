// زرع تجريبي لفحص المتصفّح: موضوع بكالوريا رياضيات 3AS + تصحيحه بروابط محلية (لا يُستعمل في الإنتاج)
import { eq } from 'drizzle-orm'
import { createDatabase } from '../src/server/db/connect'
import { levels, streams, subjects } from '../src/server/db/schema'
import { seedCurriculum } from '../src/server/db/seed-curriculum'
import { upsertResource } from '../src/server/services/resources.service'

async function main() {

  const h = await createDatabase(process.env.DATABASE_URL!)
  await seedCurriculum(h.db)
  const [m] = await h.db.select({ id: subjects.id }).from(subjects).where(eq(subjects.code, 'MATH'))
  const [l] = await h.db.select({ id: levels.id }).from(levels).where(eq(levels.code, '3AS'))
  const [s] = await h.db.select({ id: streams.id }).from(streams).where(eq(streams.code, 'SCI'))
  const common = { sourceCode: 'dzexams', levelId: l!.id, streamId: s!.id, subjectId: m!.id, isOfficial: true, accessLevel: 'PUBLIC' as const, status: 'PUBLISHED' as const, originalAuthor: 'الديوان الوطني للامتحانات والمسابقات', examSession: 'NORMAL' }
  const sol = await upsertResource(h.db, { ...common, ref: 'https://www.dzexams.com/ar/annales/M2023', part: 'correction', type: 'SOLUTION', title: 'تصحيح: موضوع الرياضيات ع.ت — بكالوريا 2023', fileUrl: 'http://127.0.0.1:3056/corrige.txt', examYear: 2023 })
  await upsertResource(h.db, { ...common, ref: 'https://www.dzexams.com/ar/annales/M2023', type: 'EXAM', title: 'موضوع الرياضيات شعبة علوم تجريبية مع التصحيح — بكالوريا 2023', fileUrl: 'http://127.0.0.1:3056/bac.txt', sourceUrl: 'https://www.dzexams.com/ar/annales/M2023', examYear: 2023, hasSolution: true, solutionResourceId: sol.id })
  await upsertResource(h.db, { ...common, ref: 'https://www.dzexams.com/ar/annales/M2022', type: 'EXAM', title: 'موضوع الرياضيات شعبة علوم تجريبية — بكالوريا 2022', fileUrl: 'http://127.0.0.1:3056/missing.pdf', sourceUrl: 'https://www.dzexams.com/ar/annales/M2022', examYear: 2022 })
  console.log('seeded')
  await h.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
