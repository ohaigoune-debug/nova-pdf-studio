/**
 * استيراد ملخصات الدروس (scripts/lessons/import.ts): dry-run بلا كتابة، استيراد كمسودّات، idempotency،
 * النشر الصريح، ربط الصف/المادة/الشعبة، تخزين PDF بلا تكرار، وسجلّ التدقيق. PGlite في الذاكرة وبيانات وهمية.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eq, inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { auditLogs, content, files, levels, streams, subjects } from '@/server/db/schema'
import { seedCurriculum } from '@/server/db/seed-curriculum'
import { bodyOf, runLessonsImport, streamCodeOf, summaryOf } from '../scripts/lessons/import'
import { makeAdmin, setupDb } from './helpers'

let h: DatabaseHandle
let root: string

const frag = (title: string) => `<!doctype html><html lang="ar" dir="rtl"><head><title>${title}</title></head><body><main>
<div class="crumb">x</div><h1>${title}</h1>
<p class="goal"><span class="k">الهدف:</span> أن تفهم ${title}.</p>
<div class="lead"><span class="k">الفكرة في سطرين:</span> ملخص &amp; فكرة ${title}.</div>
<figure class="fig"><svg viewBox="0 0 10 10"><text>نص الشكل</text></svg></figure>
<div class="block rule"><h2>🔵 القواعد والمفاهيم</h2><ol><li>قاعدة <span class="k">أولى</span></li><li>قاعدة ثانية</li></ol></div>
<div class="block ex"><h2>🟢 أمثلة تطبيقية</h2><ol><li>مثال <bdi dir="ltr">2 + 2 = 4</bdi></li></ol></div>
<div class="block warn"><h2>🟠 أخطاء شائعة</h2><ul><li>خطأ</li></ul></div>
<div class="block gold"><h2>🟡 خلاصة</h2><ul><li>خلاصة</li></ul></div>
</main></body></html>`

const pdf = (n: string) => `%PDF-1.4\n% fake lesson ${n}\n%%EOF\n`

const lessons = [
  { id: '4AM__MATH__U1-L1', grade: '4AM', subject: 'MATH', stream: 'كل الشعب', unit: 'U1', unit_name: 'الأعداد', lesson: 'L1', title: 'القاسم المشترك الأكبر', lang: 'ar', html: '4AM/MATH/U1-L1.html', pdf: 'pdf/4AM/MATH/U1-L1.pdf', slug: '4am-math-u1-l1' },
  { id: '1AS__MATH__U1-L1-TC-SCI', grade: '1AS', subject: 'MATH', stream: 'TC_SCI', unit: 'U1', unit_name: 'الأعداد', lesson: 'L1', title: 'مجموعات الأعداد', lang: 'ar', html: '1AS/MATH/U1-L1-TC-SCI.html', pdf: 'pdf/1AS/MATH/U1-L1-TC-SCI.pdf', slug: '1as-math-u1-l1-tc-sci' },
  { id: '3AS__GEO__U1-L1', grade: '3AS', subject: 'GEO', stream: 'كل الشعب', unit: 'U1', unit_name: 'التنمية', lesson: 'L1', title: 'مفهوم التنمية', lang: 'ar', html: '3AS/GEO/U1-L1.html', pdf: 'pdf/3AS/GEO/U1-L1.pdf', slug: '3as-geo-u1-l1' },
  { id: '3AS__MATH__U1-L1-SCI-MATH', grade: '3AS', subject: 'MATH', stream: 'SCI/MATH', unit: 'U1', unit_name: 'الدوال', lesson: 'L1', title: 'النهايات', lang: 'ar', html: '3AS/MATH/U1-L1-SCI-MATH.html', pdf: 'pdf/3AS/MATH/U1-L1-SCI-MATH.pdf', slug: '3as-math-u1-l1-sci-math' }
]

beforeAll(async () => {
  const base = mkdtempSync(join(tmpdir(), 'lessons-import-'))
  process.env.UPLOADS_DIR = join(base, 'uploads')
  root = join(base, 'content', 'lessons')
  for (const l of lessons) {
    mkdirSync(join(root, l.html, '..'), { recursive: true })
    mkdirSync(join(root, l.pdf, '..'), { recursive: true })
    writeFileSync(join(root, l.html), frag(l.title))
    writeFileSync(join(root, l.pdf), pdf(l.id))
  }
  writeFileSync(join(root, 'MANIFEST.json'), JSON.stringify({ count: lessons.length, lessons }))
  h = await setupDb()
  await seedCurriculum(h.db)
  await makeAdmin(h.db)
})

afterAll(async () => {
  delete process.env.UPLOADS_DIR
  await h.close()
})

describe('helpers', () => {
  it('extracts summary and markdown body from the lesson HTML', () => {
    const html = frag('درس')
    expect(summaryOf(html)).toBe('ملخص & فكرة درس.')
    const body = bodyOf(html)
    expect(body).toContain('## 🔵 القواعد والمفاهيم')
    expect(body).toContain('- قاعدة أولى')
    expect(body).toContain('- مثال 2 + 2 = 4')
    expect(body).not.toContain('نص الشكل')
  })
  it('maps single streams to codes and multi/all streams to null', () => {
    expect(streamCodeOf('TC_SCI')).toBe('TC_SCI')
    expect(streamCodeOf('GE')).toBe('GE')
    expect(streamCodeOf('SCI/MATH')).toBeNull()
    expect(streamCodeOf('كل الشعب')).toBeNull()
  })
})

describe('runLessonsImport', () => {
  const slugs = lessons.map((l) => l.slug)

  it('dry-run validates everything and writes nothing', async () => {
    const r = await runLessonsImport(h.db, { root, dryRun: true })
    expect(r.errors).toEqual([])
    expect(r.inserted).toBe(4)
    expect(await h.db.select().from(content).where(inArray(content.slug, slugs))).toHaveLength(0)
    expect(await h.db.select().from(auditLogs).where(eq(auditLogs.action, 'lessons.import.run'))).toHaveLength(0)
  })

  it('imports as unpublished PDF drafts with level/subject/stream and a stored file', async () => {
    const r = await runLessonsImport(h.db, { root })
    expect(r.errors).toEqual([])
    expect(r.inserted).toBe(4)
    expect(r.filesStored).toBe(4)
    const rows = await h.db.select().from(content).where(inArray(content.slug, slugs))
    expect(rows).toHaveLength(4)
    for (const row of rows) {
      expect(row.type).toBe('PDF')
      expect(row.publishedAt).toBeNull()
      expect(row.workspaceId).toBeNull()
      expect(row.fileId).toBeTruthy()
    }
    const byslug = Object.fromEntries(rows.map((r) => [r.slug, r]))
    const [lv4am] = await h.db.select().from(levels).where(eq(levels.code, '4AM'))
    const [histgeo] = await h.db.select().from(subjects).where(eq(subjects.code, 'HISTGEO'))
    const [tcsci] = await h.db.select().from(streams).where(eq(streams.code, 'TC_SCI'))
    expect(byslug['4am-math-u1-l1']!.levelId).toBe(lv4am!.id)
    expect(byslug['3as-geo-u1-l1']!.subjectId).toBe(histgeo!.id)
    expect(byslug['1as-math-u1-l1-tc-sci']!.streamId).toBe(tcsci!.id)
    expect(byslug['3as-math-u1-l1-sci-math']!.streamId).toBeNull()
    const [f] = await h.db.select().from(files).where(eq(files.id, byslug['4am-math-u1-l1']!.fileId!))
    expect(f!.mimeType).toBe('application/pdf')
    expect(f!.checksum).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is idempotent: a re-run changes nothing and stores no new files', async () => {
    const r = await runLessonsImport(h.db, { root })
    expect(r).toMatchObject({ inserted: 0, updated: 0, unchanged: 4, filesStored: 0 })
    expect(await h.db.select().from(content).where(inArray(content.slug, slugs))).toHaveLength(4)
  })

  it('publishes only with --publish, filtered by grade', async () => {
    const r = await runLessonsImport(h.db, { root, publish: true, grade: '3AS' })
    expect(r).toMatchObject({ total: 2, updated: 2, filesStored: 0 })
    const rows = await h.db.select().from(content).where(inArray(content.slug, slugs))
    const published = rows.filter((x) => x.publishedAt).map((x) => x.slug).sort()
    expect(published).toEqual(['3as-geo-u1-l1', '3as-math-u1-l1-sci-math'])
  })

  it('updates the file when the PDF changes and never unpublishes', async () => {
    const l = lessons[2]!
    writeFileSync(join(root, l.pdf), pdf(l.id + '-v2'))
    const r = await runLessonsImport(h.db, { root, subject: 'GEO' })
    expect(r).toMatchObject({ updated: 1, filesStored: 1 })
    const [row] = await h.db.select().from(content).where(eq(content.slug, l.slug))
    expect(row!.publishedAt).not.toBeNull()
  })

  it('reports missing files and unknown subjects as errors without stopping the run', async () => {
    const bad = { ...lessons[0]!, id: 'X', slug: 'x-bad', subject: 'ZZZ' }
    const missing = { ...lessons[0]!, id: 'Y', slug: 'y-missing', pdf: 'pdf/none.pdf' }
    writeFileSync(join(root, 'MANIFEST.json'), JSON.stringify({ lessons: [...lessons, bad, missing] }))
    const r = await runLessonsImport(h.db, { root, dryRun: true })
    expect(r.errors.map((e) => e.slug).sort()).toEqual(['x-bad', 'y-missing'])
    expect(r.unchanged).toBe(4)
  })

  it('writes one audit row per real run', async () => {
    const runs = await h.db.select().from(auditLogs).where(eq(auditLogs.action, 'lessons.import.run'))
    expect(runs).toHaveLength(4)
  })
})
