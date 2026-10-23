/**
 * MADRASADZ PLAY — استيراد المنهاج والأسئلة إلى قاعدة البيانات (CLI، idempotent).
 *
 *   DATABASE_URL=postgres://… npx tsx scripts/play/import.ts                 → مزامنة catalog.json ثم استيراد كل content/play/**
 *   npx tsx scripts/play/import.ts --dry-run                                 → عدّ فقط، بلا كتابة
 *   npx tsx scripts/play/import.ts --grade 3AS --subject AR                  → مرشّحات
 *   npx tsx scripts/play/import.ts content/play/3AS/AR/BL-L1.json …          → ملفات محددة
 *   --json  → تقرير JSON على stdout (للأتمتة)   --no-catalog → بلا مزامنة المنهاج
 *
 * الضمانات: upsert بالمفتاح الثابت (إعادة التشغيل لا تكرّر)، كل ملف في معاملة واحدة (فشل ملف لا يُفسد غيره)،
 * لا حذف أبداً، لا تغيير حالة سؤال اعتمده/رفضه مراجع بشري ما لم يتغيّر محتواه، ويُكتب سجلّ تدقيق لكل تشغيل.
 * بلا DATABASE_URL يستعمل PGlite المحلي (./data/pglite) — لا يصل إلى الإنتاج إلا بعنوان صريح.
 */
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createDatabase, type Db } from '@/server/db/connect'
import { importQuestions, logImportRun, syncCatalog, type ImportReport, type PlayCatalog } from '@/server/play/importer'
import type { PlayContentQuestion } from '@/server/play/question-types'
import { listContentFiles } from './validate'

export interface CliOptions {
  files?: string[]
  dryRun?: boolean
  grade?: string | null
  subject?: string | null
  catalog?: boolean
  log?: (line: string) => void
}

export interface CliReport {
  dryRun: boolean
  catalog: { lessons: number; inserted: number; updated: number } | null
  files: { file: string; report: ImportReport }[]
  totals: ImportReport
  failedFiles: { file: string; error: string }[]
}

function parseArgs(argv: string[]): CliOptions {
  const o: CliOptions & { json?: boolean } = { files: [], dryRun: false, grade: null, subject: null, catalog: true }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (a === '--dry-run') o.dryRun = true
    else if (a === '--json') o.json = true
    else if (a === '--no-catalog') o.catalog = false
    else if (a === '--grade') o.grade = argv[++i] ?? null
    else if (a === '--subject') o.subject = argv[++i] ?? null
    else if (!a.startsWith('--')) o.files!.push(a)
  }
  return o
}

/** الجزء القابل للاختبار: يأخذ db جاهزة ويعيد التقرير */
export async function runImport(db: Db, opts: CliOptions = {}): Promise<CliReport> {
  const root = join(process.cwd(), 'content', 'play')
  const log = opts.log ?? (() => {})
  const dryRun = Boolean(opts.dryRun)
  const out: CliReport = { dryRun, catalog: null, files: [], totals: { total: 0, inserted: 0, updated: 0, skippedInvalid: 0, skippedNoLesson: 0, errors: [] }, failedFiles: [] }

  if (opts.catalog !== false && !dryRun) {
    const catalog = JSON.parse(readFileSync(join(root, 'catalog.json'), 'utf-8')) as PlayCatalog
    out.catalog = await syncCatalog(db, catalog)
    log(`✔ المنهاج: ${out.catalog.lessons} درساً (${out.catalog.inserted} جديد، ${out.catalog.updated} محدَّث)`)
  }

  let files = opts.files?.length ? opts.files.map((f) => (f.startsWith('/') ? f : join(process.cwd(), f))) : listContentFiles(root)
  if (opts.grade) files = files.filter((f) => relative(root, f).split('/')[0] === opts.grade)
  if (opts.subject) files = files.filter((f) => relative(root, f).split('/')[1] === opts.subject)

  for (const file of files) {
    const rel = relative(process.cwd(), file)
    let questions: PlayContentQuestion[]
    try {
      questions = JSON.parse(readFileSync(file, 'utf-8')) as PlayContentQuestion[]
      if (!Array.isArray(questions)) throw new Error('الملف ليس مصفوفة JSON')
    } catch (e) {
      out.failedFiles.push({ file: rel, error: (e as Error).message })
      log(`✖ ${rel}: ${(e as Error).message}`)
      continue
    }
    try {
      const report = dryRun ? await importQuestions(db, questions, { dryRun: true }) : await db.transaction((tx) => importQuestions(tx as unknown as Db, questions))
      out.files.push({ file: rel, report })
      out.totals.total += report.total
      out.totals.inserted += report.inserted
      out.totals.updated += report.updated
      out.totals.skippedInvalid += report.skippedInvalid
      out.totals.skippedNoLesson += report.skippedNoLesson
      out.totals.errors.push(...report.errors.map((e) => ({ key: e.key, errors: e.errors })))
      const bad = report.skippedInvalid + report.skippedNoLesson
      log(`${bad ? '⚠' : '✔'} ${rel}: ${report.total} سؤالاً — ${report.inserted} جديد، ${report.updated} محدَّث${bad ? `، ${bad} مرفوض` : ''}`)
    } catch (e) {
      out.failedFiles.push({ file: rel, error: (e as Error).message })
      log(`✖ ${rel}: ${(e as Error).message}`)
    }
  }

  if (!dryRun) await logImportRun(db, { files: out.files.length, ...out.totals, errors: out.totals.errors.length, failedFiles: out.failedFiles.length })
  return out
}

async function main() {
  const o = parseArgs(process.argv.slice(2)) as CliOptions & { json?: boolean }
  const url = process.env.DATABASE_URL ?? 'pglite://./data/pglite'
  if (!o.json) console.log(`${o.dryRun ? '[dry-run] ' : ''}قاعدة البيانات: ${url.replace(/\/\/[^@]*@/, '//***@')}`)
  const handle = await createDatabase(url)
  try {
    const report = await runImport(handle.db, { ...o, log: o.json ? undefined : (l) => console.log(l) })
    if (o.json) console.log(JSON.stringify(report, null, 1))
    else {
      const t = report.totals
      console.log(`\nالمجموع: ${t.total} سؤالاً — ${t.inserted} جديد، ${t.updated} محدَّث، ${t.skippedInvalid} غير صالح، ${t.skippedNoLesson} بلا درس، ${report.failedFiles.length} ملف فشل`)
      for (const e of t.errors.slice(0, 40)) console.log(`   - ${e.key}: ${e.errors.join(' | ')}`)
      if (t.errors.length > 40) console.log(`   … و${t.errors.length - 40} أخرى`)
    }
    process.exitCode = report.failedFiles.length || report.totals.skippedInvalid || report.totals.skippedNoLesson ? 1 : 0
  } finally {
    await handle.close()
  }
}

if (process.argv[1] && /scripts[\\/]play[\\/]import\.ts$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
