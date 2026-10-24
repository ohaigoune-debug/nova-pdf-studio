/**
 * ملخصات الدروس (837) — استيراد content/lessons/MANIFEST.json إلى جدول content (CLI، idempotent).
 *
 *   npx tsx scripts/lessons/import.ts --dry-run                  → فحص كامل بلا أي كتابة (لا قاعدة ولا تخزين)
 *   DATABASE_URL=postgres://… npx tsx scripts/lessons/import.ts  → استيراد كمسودّات غير منشورة (publishedAt = NULL)
 *   … --publish                                                  → نشر الدروس المستوردة (ومن دونه لا يُغيَّر نشر درس قائم)
 *   … --grade 3AS --subject MATH                                 → مرشّحات   --json → تقرير JSON   --limit N → أول N درساً
 *
 * لكل درس: ملف PDF يُخزَّن في التخزين الخاص (إزالة التكرار بالبصمة sha256) + سطر content من نوع PDF
 * مفتاحه الثابت slug من الـ manifest. الضمانات: upsert بالـ slug (إعادة التشغيل لا تكرّر)، كل درس في معاملة،
 * لا حذف أبداً، لا يُلغى نشر درس منشور، ويُكتب سجلّ تدقيق لكل تشغيل حقيقي.
 * بلا DATABASE_URL يستعمل PGlite المحلي (./data/pglite) — لا يصل إلى الإنتاج إلا بعنوان صريح.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { createDatabase, type Db } from '@/server/db/connect'
import { auditLogs, content, files, levels, streams, subjects, users } from '@/server/db/schema'
import { newStorageKey, storage } from '@/server/lib/storage'

export interface ManifestLesson {
  id: string
  grade: string
  subject: string
  stream: string
  unit: string
  unit_name: string
  lesson: string
  title: string
  lang: string
  html: string
  pdf: string
  slug: string
  audit?: string | null
}

/** رموز المواد في الملخصات ← subjects.code في المنصة (HIST وGEO يشتركان في «التاريخ والجغرافيا») */
export const SUBJECT_CODE: Record<string, string> = {
  AR: 'ARABIC',
  MATH: 'MATH',
  PHYS: 'PHYSICS',
  SVT: 'SCIENCES',
  FR: 'FRENCH',
  EN: 'ENGLISH',
  HIST: 'HISTGEO',
  GEO: 'HISTGEO',
  ISL: 'ISLAMIC',
  CIV: 'CIVIC',
  PHILO: 'PHILO',
  ECO: 'ECONOMICS',
  ACC: 'ACCOUNTING',
  LAW: 'LAW',
  INFO: 'COMPUTING',
  TECH: 'TECHNOLOGY'
}

/** شعبة واحدة ← streams.code؛ «كل الشعب» والشعب المتعددة (SCI/MATH…) ← NULL = يظهر لكل شعب الصف */
export function streamCodeOf(stream: string): string | null {
  const s = stream.trim()
  return /^[A-Z_]+$/.test(s) ? s : null
}

export interface LessonResult {
  slug: string
  action: 'insert' | 'update' | 'unchanged' | 'error'
  error?: string
}

export interface LessonsImportReport {
  dryRun: boolean
  publish: boolean
  total: number
  inserted: number
  updated: number
  unchanged: number
  filesStored: number
  errors: { slug: string; error: string }[]
}

export interface LessonsImportOptions {
  root?: string
  dryRun?: boolean
  publish?: boolean
  grade?: string | null
  subject?: string | null
  limit?: number | null
  log?: (line: string) => void
}

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
const textOf = (html: string) => decode(html.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()

/** نصّ قصير للبطاقات والبحث: «الفكرة في سطرين» دون العنوان الفرعي */
export function summaryOf(html: string): string | null {
  const m = html.match(/<div class="lead">([\s\S]*?)<\/div>/)
  if (!m) return null
  const t = textOf(m[1]!).replace(/^[^:：]{1,40}[:：]\s*/, '')
  return t ? t.slice(0, 600) : null
}

/** متن Markdown مبسّط (عناوين + قوائم) من الكتل الأربع — للبحث والقراءة السريعة؛ الـ PDF هو العرض الكامل */
export function bodyOf(html: string): string {
  const out: string[] = []
  const goal = html.match(/<p class="goal">([\s\S]*?)<\/p>/)
  if (goal) out.push(textOf(goal[1]!))
  for (const m of html.matchAll(/<div class="block (?:rule|ex|warn|gold)">\s*<h2>([\s\S]*?)<\/h2>([\s\S]*?)<\/div>/g)) {
    out.push('', `## ${textOf(m[1]!)}`)
    for (const li of m[2]!.matchAll(/<li>([\s\S]*?)<\/li>/g)) {
      const t = textOf(li[1]!)
      if (t) out.push(`- ${t}`)
    }
  }
  return out.join('\n').trim()
}

async function adminUserId(db: Db): Promise<string> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const [u] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, 'SUPER_ADMIN'), eq(users.status, 'ACTIVE'), isNull(users.deletedAt), email ? eq(users.email, email) : undefined))
    .orderBy(asc(users.createdAt))
    .limit(1)
  if (!u) throw new Error('لا مشرف عام في القاعدة — شغّل db:bootstrap أولاً')
  return u.id
}

async function idMaps(db: Db) {
  const [lv, sb, st] = await Promise.all([
    db.select({ id: levels.id, code: levels.code }).from(levels),
    db.select({ id: subjects.id, code: subjects.code }).from(subjects),
    db.select({ id: streams.id, code: streams.code }).from(streams)
  ])
  return {
    level: new Map(lv.map((r) => [r.code, r.id])),
    subject: new Map(sb.map((r) => [r.code, r.id])),
    stream: new Map(st.map((r) => [r.code, r.id]))
  }
}

export function loadManifest(root: string): ManifestLesson[] {
  const m = JSON.parse(readFileSync(join(root, 'MANIFEST.json'), 'utf-8')) as { lessons: ManifestLesson[] }
  if (!Array.isArray(m.lessons)) throw new Error('MANIFEST.json: الحقل lessons ليس مصفوفة')
  return m.lessons
}

/** الجزء القابل للاختبار: يأخذ db جاهزة ويعيد التقرير */
export async function runLessonsImport(db: Db, opts: LessonsImportOptions = {}): Promise<LessonsImportReport> {
  const root = opts.root ?? join(process.cwd(), 'content', 'lessons')
  const log = opts.log ?? (() => {})
  const dryRun = Boolean(opts.dryRun)
  const publish = Boolean(opts.publish)
  const report: LessonsImportReport = { dryRun, publish, total: 0, inserted: 0, updated: 0, unchanged: 0, filesStored: 0, errors: [] }

  let lessons = loadManifest(root)
  if (opts.grade) lessons = lessons.filter((l) => l.grade === opts.grade)
  if (opts.subject) lessons = lessons.filter((l) => l.subject === opts.subject)
  if (opts.limit) lessons = lessons.slice(0, opts.limit)
  report.total = lessons.length

  const maps = await idMaps(db)
  const authorId = dryRun ? null : await adminUserId(db)
  const now = new Date()

  for (const l of lessons) {
    try {
      const levelId = maps.level.get(l.grade)
      if (!levelId) throw new Error(`صف غير موجود في levels: ${l.grade}`)
      const subjectCode = SUBJECT_CODE[l.subject]
      const subjectId = subjectCode ? maps.subject.get(subjectCode) : undefined
      if (!subjectId) throw new Error(`مادة غير موجودة في subjects: ${l.subject} → ${subjectCode ?? '؟'}`)
      const sc = streamCodeOf(l.stream)
      const streamId = sc ? maps.stream.get(sc) : null
      if (sc && !streamId) throw new Error(`شعبة غير موجودة في streams: ${sc}`)
      const htmlPath = join(root, l.html)
      const pdfPath = join(root, l.pdf)
      if (!existsSync(htmlPath)) throw new Error(`HTML مفقود: ${l.html}`)
      if (!existsSync(pdfPath)) throw new Error(`PDF مفقود: ${l.pdf}`)
      const html = readFileSync(htmlPath, 'utf-8')
      const pdf = readFileSync(pdfPath)
      if (pdf.subarray(0, 5).toString() !== '%PDF-') throw new Error(`ليس ملف PDF صالحاً: ${l.pdf}`)
      const checksum = createHash('sha256').update(pdf).digest('hex')
      const summary = summaryOf(html)
      const body = bodyOf(html)
      if (!summary || !body) throw new Error('تعذّر استخراج «الفكرة في سطرين» أو الكتل من HTML')

      const [existing] = await db
        .select({ id: content.id, fileId: content.fileId, title: content.title, summary: content.summary, body: content.body, publishedAt: content.publishedAt, checksum: files.checksum })
        .from(content)
        .leftJoin(files, eq(files.id, content.fileId))
        .where(eq(content.slug, l.slug))
        .limit(1)

      const sameFile = existing?.checksum === checksum
      const changed = !existing || !sameFile || existing.title !== l.title || existing.summary !== summary || existing.body !== body || (publish && !existing.publishedAt)
      const action: LessonResult['action'] = !existing ? 'insert' : changed ? 'update' : 'unchanged'

      if (!dryRun && action !== 'unchanged') {
        await db.transaction(async (tx) => {
          let fileId = sameFile ? existing!.fileId : null
          if (!fileId) {
            const [dup] = await tx.select({ id: files.id }).from(files).where(and(eq(files.checksum, checksum), isNull(files.deletedAt))).limit(1)
            if (dup) fileId = dup.id
            else {
              const key = newStorageKey(null, 'pdf')
              await storage().put(key, pdf)
              const [row] = await tx
                .insert(files)
                .values({ workspaceId: null, ownerUserId: authorId!, bucket: 'private', storageKey: key, originalName: `${l.title} — ${basename(l.pdf)}`.replace(/[\\/:*?"<>|]/g, ' ').slice(0, 180), mimeType: 'application/pdf', sizeBytes: pdf.byteLength, checksum })
                .returning({ id: files.id })
              fileId = row!.id
              report.filesStored++
            }
          }
          const values = { type: 'PDF', title: l.title, summary, body, fileId, levelId, subjectId, streamId: streamId ?? null, topic: l.unit_name, updatedAt: now }
          if (existing) {
            await tx
              .update(content)
              .set({ ...values, ...(publish && !existing.publishedAt ? { publishedAt: now } : {}) })
              .where(eq(content.id, existing.id))
          } else {
            await tx.insert(content).values({ ...values, workspaceId: null, authorUserId: authorId!, slug: l.slug, visibility: 'PUBLIC', publishedAt: publish ? now : null, allowDownload: false })
          }
        })
      }
      if (action === 'insert') report.inserted++
      else if (action === 'update') report.updated++
      else report.unchanged++
      log(`${action === 'unchanged' ? '·' : '✔'} ${l.slug}: ${action}`)
    } catch (e) {
      report.errors.push({ slug: l.slug, error: (e as Error).message })
      log(`✖ ${l.slug}: ${(e as Error).message}`)
    }
  }

  if (!dryRun) {
    await db.insert(auditLogs).values({
      actorUserId: null,
      workspaceId: null,
      action: 'lessons.import.run',
      entityType: 'content',
      entityId: null,
      newValue: { total: report.total, inserted: report.inserted, updated: report.updated, unchanged: report.unchanged, filesStored: report.filesStored, errors: report.errors.length, publish }
    })
  }
  return report
}

function parseArgs(argv: string[]) {
  const o: LessonsImportOptions & { json?: boolean } = { dryRun: false, publish: false, grade: null, subject: null, limit: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (a === '--dry-run') o.dryRun = true
    else if (a === '--publish') o.publish = true
    else if (a === '--json') o.json = true
    else if (a === '--grade') o.grade = argv[++i] ?? null
    else if (a === '--subject') o.subject = argv[++i] ?? null
    else if (a === '--limit') o.limit = Number(argv[++i]) || null
  }
  return o
}

async function main() {
  const o = parseArgs(process.argv.slice(2))
  const url = process.env.DATABASE_URL ?? 'pglite://./data/pglite'
  if (!o.json) console.log(`${o.dryRun ? '[dry-run] ' : ''}قاعدة البيانات: ${url.replace(/\/\/[^@]*@/, '//***@')}${o.publish ? ' — مع النشر' : ' — كمسودّات'}`)
  const handle = await createDatabase(url)
  try {
    const r = await runLessonsImport(handle.db, { ...o, log: o.json ? undefined : (l) => console.log(l) })
    if (o.json) console.log(JSON.stringify(r, null, 1))
    else {
      console.log(`\nالمجموع: ${r.total} درساً — ${r.inserted} جديد، ${r.updated} محدَّث، ${r.unchanged} دون تغيير، ${r.filesStored} ملف PDF خُزّن، ${r.errors.length} خطأ`)
      for (const e of r.errors.slice(0, 40)) console.log(`   - ${e.slug}: ${e.error}`)
    }
    process.exitCode = r.errors.length ? 1 : 0
  } finally {
    await handle.close()
  }
}

if (process.argv[1] && /scripts[\\/]lessons[\\/]import\.ts$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
