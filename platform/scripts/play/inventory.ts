/**
 * MADRASA PLAY — جرد المصادر (قراءة فقط).
 *
 *   npx tsx scripts/play/inventory.ts                       → جرد ما في المستودع (بنك PLAY، الدروس، QCM) دون قاعدة بيانات
 *   DATABASE_URL=postgres://readonly@… npx tsx scripts/play/inventory.ts --db
 *                                                           → يضيف أرشيف المنصة (بكالوريات، فروض، اختبارات، تصحيحات، بنك الأسئلة)
 *   --out <dir>   مجلد المخرجات (الافتراضي outputs/play-night)
 *
 * الضمانات: لا هجرات (migrate: false)، كل الاستعلامات داخل معاملة READ ONLY، لا كتابة في أي جدول.
 * المخرجات: CONTENT_INVENTORY.csv، CONTENT_GAPS.csv، SOURCE_REGISTRY.json (تُدمج مع المرشحين الخارجيين المسجّلين
 * في content/play-exams/external-candidates.json دون التحقق منهم).
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { sql } from 'drizzle-orm'
import { listContentFiles } from './validate'

const ROOT = process.cwd()
const PLAY = join(ROOT, 'content/play')

export interface InventoryRow {
  source_kind: string
  location: string
  level: string
  stream: string
  subject: string
  year: string
  term: string
  paper: string
  type: string
  count: number
  with_correction: string
  status: string
  notes: string
}

export interface GapRow {
  gap_kind: string
  level: string
  stream: string
  subject: string
  unit: string
  lesson: string
  detail: string
}

const row = (r: Partial<InventoryRow> & Pick<InventoryRow, 'source_kind' | 'count'>): InventoryRow => ({
  location: '',
  level: '',
  stream: '',
  subject: '',
  year: '',
  term: '',
  paper: '',
  type: '',
  with_correction: '',
  status: '',
  notes: '',
  ...r
})

export function toCsv<T extends object>(rows: T[], columns: (keyof T)[]): string {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [columns.join(','), ...rows.map((r) => columns.map((c) => esc(r[c])).join(','))].join('\n') + '\n'
}

interface CatalogLesson {
  code: string
  name: string
  verified?: boolean
}
interface Catalog {
  grades: { grade: string; subjects: { subject: string; streams?: string[]; units: { code: string; name: string; lessons: CatalogLesson[] }[] }[] }[]
}

/** بنك PLAY + الدروس + QCM: كل ما يمكن عدّه من المستودع */
export function repoInventory(): { rows: InventoryRow[]; gaps: GapRow[]; sources: Record<string, unknown>[] } {
  const rows: InventoryRow[] = []
  const gaps: GapRow[] = []
  const sources: Record<string, unknown>[] = []

  // بنك PLAY
  const counts = new Map<string, number>()
  const perLesson = new Map<string, number>()
  for (const file of listContentFiles(PLAY)) {
    const raw = readFileSync(file, 'utf-8')
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      rows.push(row({ source_kind: 'play_bank_file', location: relative(ROOT, file), count: 0, status: 'unreadable', notes: 'JSON غير صالح' }))
      continue
    }
    const arr = (Array.isArray(parsed) ? parsed : ((parsed as { questions?: unknown[] }).questions ?? [])) as { grade: string; subject: string; unit: string; lesson: string; type: string; reviewStatus?: string; streams?: string[] }[]
    sources.push({ source_id: `repo:${relative(ROOT, file)}`, kind: 'play_bank_file', path: relative(ROOT, file), sha256: createHash('sha256').update(raw).digest('hex'), items: arr.length, trust: 'authored_in_repo', verified: 'validator' })
    for (const q of arr) {
      const k = [q.grade, (q.streams ?? []).join('+') || 'ALL', q.subject, q.type, q.reviewStatus ?? 'AUTO_VALIDATED'].join('|')
      counts.set(k, (counts.get(k) ?? 0) + 1)
      const lk = `${q.grade}|${q.subject}|${q.unit}|${q.lesson}`
      perLesson.set(lk, (perLesson.get(lk) ?? 0) + 1)
    }
  }
  for (const [k, n] of [...counts.entries()].sort()) {
    const [level, stream, subject, type, status] = k.split('|')
    rows.push(row({ source_kind: 'play_bank', location: 'content/play', level, stream, subject, type, count: n, status, notes: 'أسئلة دروس مؤلَّفة (ليست من امتحانات)' }))
  }

  // ترتيب الدروس الحالي وفجواته
  const catalog = JSON.parse(readFileSync(join(PLAY, 'catalog.json'), 'utf-8')) as Catalog
  let lessonTotal = 0
  for (const g of catalog.grades)
    for (const s of g.subjects)
      for (const u of s.units)
        for (const l of u.lessons) {
          lessonTotal++
          const n = perLesson.get(`${g.grade}|${s.subject}|${u.code}|${l.code}`) ?? 0
          if (n === 0) gaps.push({ gap_kind: 'lesson_without_questions', level: g.grade, stream: (s.streams ?? []).join('+') || 'ALL', subject: s.subject, unit: u.code, lesson: l.code, detail: l.name })
          if (!l.verified) gaps.push({ gap_kind: 'lesson_not_verified_in_catalog', level: g.grade, stream: (s.streams ?? []).join('+') || 'ALL', subject: s.subject, unit: u.code, lesson: l.code, detail: l.name })
        }
  rows.push(row({ source_kind: 'play_catalog_lessons', location: 'content/play/catalog.json', count: lessonTotal, notes: 'ترتيب الدروس المعتمد في اللعبة' }))

  // وثائق الدروس (HTML/PDF)
  const manifestPath = join(ROOT, 'content/lessons/MANIFEST.json')
  if (existsSync(manifestPath)) {
    const m = JSON.parse(readFileSync(manifestPath, 'utf-8')) as { lessons: { grade: string; subject: string }[] }
    const byGs = new Map<string, number>()
    for (const l of m.lessons) byGs.set(`${l.grade}|${l.subject}`, (byGs.get(`${l.grade}|${l.subject}`) ?? 0) + 1)
    for (const [k, n] of [...byGs.entries()].sort()) {
      const [level, subject] = k.split('|')
      rows.push(row({ source_kind: 'lesson_documents', location: 'content/lessons', level, subject, type: 'LESSON', count: n, notes: 'HTML + PDF لكل درس' }))
    }
  }

  // QCM القديمة
  const qcmDir = join(ROOT, 'content/qcm')
  if (existsSync(qcmDir)) {
    let sets = 0
    let questions = 0
    for (const f of listContentFiles(qcmDir)) {
      sets++
      try {
        questions += ((JSON.parse(readFileSync(f, 'utf-8')) as { questions?: unknown[] }).questions ?? []).length
      } catch {
        /* يُحتسب الملف فقط */
      }
    }
    rows.push(row({ source_kind: 'legacy_qcm_sets', location: 'content/qcm', subject: 'AR', count: sets, notes: `${questions} سؤالاً` }))
  }

  // ما لا يوجد في المستودع: أرشيف الامتحانات نفسه
  rows.push(
    row({
      source_kind: 'exam_archive_files',
      location: 'repository',
      count: 0,
      status: 'absent',
      notes: 'لا يحتوي المستودع أي ملف بكالوريا أو فرض أو اختبار أو تصحيح؛ الأرشيف في قاعدة الإنتاج (bac_exams، resources، bank_questions، exam_documents) وفي مواقع المصدر'
    })
  )
  return { rows, gaps, sources }
}

type Sql = ReturnType<typeof sql>

/** أرشيف المنصة من قاعدة البيانات — قراءة فقط داخل معاملة READ ONLY */
export async function databaseInventory(url: string): Promise<{ rows: InventoryRow[]; gaps: GapRow[]; sources: Record<string, unknown>[]; kind: string }> {
  const { createDatabase } = await import('@/server/db/connect')
  const handle = await createDatabase(url, { migrate: false })
  const rows: InventoryRow[] = []
  const gaps: GapRow[] = []
  const sources: Record<string, unknown>[] = []
  try {
    await handle.db.transaction(async (tx) => {
      await tx.execute(sql`SET TRANSACTION READ ONLY`)
      const all = async <T>(q: Sql): Promise<T[]> => {
        const res = (await tx.execute(q)) as unknown as { rows?: T[] } | T[]
        return Array.isArray(res) ? res : (res.rows ?? [])
      }
      // البكالوريات (روابط المصدر)
      const bac = await all<{ year: number | null; subject_name: string; stream_name: string | null; n: number; with_corr: number; with_exam: number }>(sql`
        SELECT year, subject_name, stream_name, count(*)::int AS n,
               count(correction_url)::int AS with_corr, count(exam_url)::int AS with_exam
        FROM bac_exams GROUP BY year, subject_name, stream_name ORDER BY year DESC NULLS LAST, subject_name, stream_name`)
      for (const b of bac) {
        rows.push(row({ source_kind: 'bac_exam_links', location: 'db:bac_exams', level: '3AS', stream: b.stream_name ?? '', subject: b.subject_name, year: String(b.year ?? ''), type: 'BAC', count: b.n, with_correction: `${b.with_corr}/${b.n}`, status: 'link_only', notes: `${b.with_exam} برابط تنزيل مباشر` }))
        if (b.with_corr < b.n) gaps.push({ gap_kind: 'bac_without_correction', level: '3AS', stream: b.stream_name ?? '', subject: b.subject_name, unit: String(b.year ?? ''), lesson: '', detail: `${b.n - b.with_corr} موضوعاً بلا رابط تصحيح` })
      }
      const bacList = await all<{ id: string; year: number | null; subject_name: string; stream_name: string | null; title: string; page_url: string; exam_url: string | null; correction_url: string | null; source: string }>(sql`
        SELECT id, year, subject_name, stream_name, title, page_url, exam_url, correction_url, source FROM bac_exams ORDER BY year DESC NULLS LAST, subject_name`)
      for (const b of bacList)
        sources.push({ source_id: `db:bac_exams:${b.id}`, kind: 'bac', year: b.year, stream: b.stream_name, subject: b.subject_name, title: b.title, original_url: b.exam_url ?? b.page_url, correction_url: b.correction_url, origin: b.source, trust: 'third_party_archive_link', verified: false })

      // المكتبة: امتحانات وفروض واختبارات وحلول
      const res = await all<{ type: string; level: string | null; stream: string | null; subject: string | null; term: number | null; exam_year: number | null; status: string; n: number; with_solution: number; official: number }>(sql`
        SELECT r.type, l.code AS level, st.code AS stream, su.name_ar AS subject, r.school_term AS term, r.exam_year, r.status,
               count(*)::int AS n, count(*) FILTER (WHERE r.has_solution)::int AS with_solution, count(*) FILTER (WHERE r.is_official)::int AS official
        FROM resources r
        LEFT JOIN levels l ON l.id = r.level_id
        LEFT JOIN streams st ON st.id = r.stream_id
        LEFT JOIN subjects su ON su.id = r.subject_id
        WHERE r.deleted_at IS NULL AND r.type IN ('EXAM','TEST','HOMEWORK','SOLUTION','EXERCISE')
        GROUP BY r.type, l.code, st.code, su.name_ar, r.school_term, r.exam_year, r.status
        ORDER BY r.type, su.name_ar, l.code`)
      for (const r of res) rows.push(row({ source_kind: 'library_resources', location: 'db:resources', level: r.level ?? '', stream: r.stream ?? '', subject: r.subject ?? '', year: String(r.exam_year ?? ''), term: String(r.term ?? ''), type: r.type, count: r.n, with_correction: `${r.with_solution}/${r.n}`, status: r.status, notes: `${r.official} رسمي` }))

      // بنك أسئلة الأساتذة ووثائق الامتحانات
      for (const [table, kind] of [
        ['bank_questions', 'teacher_question_bank'],
        ['exam_documents', 'teacher_exam_documents'],
        ['exams', 'teacher_exams']
      ] as const) {
        try {
          const [c] = await all<{ n: number }>(sql.raw(`SELECT count(*)::int AS n FROM ${table}`))
          rows.push(row({ source_kind: kind, location: `db:${table}`, count: c?.n ?? 0 }))
        } catch (e) {
          rows.push(row({ source_kind: kind, location: `db:${table}`, count: 0, status: 'unreadable', notes: String(e).slice(0, 120) }))
        }
      }
    })
  } finally {
    await handle.close()
  }
  return { rows, gaps, sources, kind: handle.kind }
}

interface DriveUnit {
  group_id: string
  kind: string
  is_solution: boolean
  has_correction_inside: boolean
  level: string
  stream_group: string
  term: string
  year: string
  session: string
  subject: string
  title: string
  files: { file_id: string; format: string; duplicate_of: string }[]
  solution_group_id: string
}

/** أرشيف Drive لصاحب المنصة (من outputs/play-night/DRIVE_ARCHIVE_INVENTORY.json إن وُجد): تجميع + فجوات + سجل مصادر */
export function driveInventory(path = join(ROOT, 'outputs/play-night/DRIVE_ARCHIVE_INVENTORY.json')): { rows: InventoryRow[]; gaps: GapRow[]; sources: Record<string, unknown>[] } {
  if (!existsSync(path)) return { rows: [], gaps: [], sources: [] }
  const inv = JSON.parse(readFileSync(path, 'utf-8')) as { units: DriveUnit[] }
  const exams = inv.units.filter((u) => ['BAC', 'TEST', 'DEVOIR'].includes(u.kind) && !u.is_solution)
  const groups = new Map<string, { r: InventoryRow; n: number; c: number }>()
  for (const u of exams) {
    const corrected = !!u.solution_group_id || u.has_correction_inside
    const key = [u.kind, u.level, u.stream_group, u.subject, u.kind === 'BAC' ? u.year : '', u.term].join('|')
    const g = groups.get(key) ?? { r: row({ source_kind: 'drive_archive', location: 'Google Drive (المالك)', level: u.level, stream: u.stream_group, subject: u.subject, year: u.kind === 'BAC' ? u.year : '', term: u.term === 'unknown' ? '' : u.term, type: u.kind, count: 0, status: 'discovered' }), n: 0, c: 0 }
    g.n++
    if (corrected) g.c++
    groups.set(key, g)
  }
  const rows = [...groups.values()].map((g) => ({ ...g.r, count: g.n, with_correction: `${g.c}/${g.n}` })).sort((a, b) => a.type.localeCompare(b.type) || a.subject.localeCompare(b.subject) || b.year.localeCompare(a.year))
  const gaps: GapRow[] = []
  for (const u of exams.filter((x) => !x.solution_group_id && !x.has_correction_inside)) gaps.push({ gap_kind: 'drive_exam_without_correction', level: u.level, stream: u.stream_group, subject: u.subject, unit: u.group_id, lesson: '', detail: `${u.kind} ${u.year !== 'unknown' ? u.year : ''} ${u.title}`.trim() })
  for (const u of inv.units.filter((x) => x.is_solution && !inv.units.some((e) => e.solution_group_id === x.group_id))) gaps.push({ gap_kind: 'drive_solution_without_exam', level: u.level, stream: u.stream_group, subject: u.subject, unit: u.group_id, lesson: '', detail: u.title })
  const sources = exams.map((u) => ({
    source_id: `gdrive-unit-${u.group_id}`,
    kind: u.kind,
    level: u.level,
    stream: u.stream_group,
    subject: u.subject,
    year: u.year,
    term: u.term,
    session: u.session,
    title: u.title,
    files: u.files.filter((f) => !f.duplicate_of).map((f) => `gdrive:${f.file_id} (${f.format})`),
    solution_unit: u.solution_group_id || null,
    correction_inside: u.has_correction_inside,
    trust: 'owner_archive',
    status: u.solution_group_id || u.has_correction_inside ? 'discovered' : 'blocked',
    blocker: u.solution_group_id || u.has_correction_inside ? null : 'لا تصحيح مرتبط في Drive'
  }))
  return { rows, gaps, sources }
}

async function main() {
  const argv = process.argv.slice(2)
  const outIdx = argv.indexOf('--out')
  const outDir = resolve(ROOT, outIdx >= 0 ? argv[outIdx + 1]! : 'outputs/play-night')
  mkdirSync(outDir, { recursive: true })
  const repo = repoInventory()
  let db: Awaited<ReturnType<typeof databaseInventory>> | null = null
  let dbNote = 'لم تُفحص قاعدة البيانات (شغّل مع --db و DATABASE_URL للقراءة فقط)'
  if (argv.includes('--db')) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL مطلوب مع --db')
    db = await databaseInventory(url)
    dbNote = `قاعدة البيانات (${db.kind}) فُحصت للقراءة فقط`
  }
  const drive = driveInventory()
  const rows = [...repo.rows, ...(db?.rows ?? []), ...drive.rows]
  if (!db) rows.push(row({ source_kind: 'exam_archive_db', location: 'database', count: 0, status: 'not_accessible', notes: dbNote }))
  const gaps = [...repo.gaps, ...(db?.gaps ?? []), ...drive.gaps]
  const candidatesPath = join(ROOT, 'content/play-exams/external-candidates.json')
  const candidates = existsSync(candidatesPath) ? (JSON.parse(readFileSync(candidatesPath, 'utf-8')) as Record<string, unknown>[]) : []
  const registry = { generated_at: new Date().toISOString(), database: dbNote, sources: [...repo.sources, ...(db?.sources ?? []), ...drive.sources, ...candidates] }
  writeFileSync(join(outDir, 'CONTENT_INVENTORY.csv'), toCsv(rows, ['source_kind', 'location', 'level', 'stream', 'subject', 'year', 'term', 'paper', 'type', 'count', 'with_correction', 'status', 'notes']))
  writeFileSync(join(outDir, 'CONTENT_GAPS.csv'), toCsv(gaps, ['gap_kind', 'level', 'stream', 'subject', 'unit', 'lesson', 'detail']))
  writeFileSync(join(outDir, 'SOURCE_REGISTRY.json'), JSON.stringify(registry, null, 1) + '\n')
  const bank = rows.filter((r) => r.source_kind === 'play_bank').reduce((a, r) => a + r.count, 0)
  console.log(`inventory: ${rows.length} rows, play bank ${bank} questions, ${gaps.length} gaps, ${registry.sources.length} sources — ${dbNote}`)
}

if (process.argv[1] && process.argv[1].endsWith('inventory.ts')) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
