/**
 * MADRASA PLAY — خطّ تحويل الفروض والاختبارات والبكالوريا (08_CONTENT_CONVERSION_PIPELINE).
 *
 *   npx tsx scripts/play/exams.ts validate            → تدقيق كل ملفات content/play-exams/{sets,fixtures}/**.json (خروج 1 عند الأخطاء)
 *   npx tsx scripts/play/exams.ts progress            → outputs/play-night/QUESTION_CONVERSION_PROGRESS.json
 *   npx tsx scripts/play/exams.ts report              → outputs/play-night/VALIDATION_REPORT.md (قسم المحتوى)
 *   npx tsx scripts/play/exams.ts approve <set_id> --by "الاسم"   → قرار صاحب المنصة بعد مراجعة المجموعة: يعتمد المصدر والسلّم والخطوات
 *                                                     التفاعلية (لا يُستعمل آليًا؛ الأنواع المؤجلة تبقى مؤجلة)
 *   DATABASE_URL=pglite://… npx tsx scripts/play/exams.ts import-dev --yes-dev
 *                                                     → رفع المجموعات إلى قاعدة تطوير فقط (pglite أو localhost)
 *
 * لكل ملف بصمة sha256: تُعاد المعالجة فقط إن تغيّر المحتوى (نقطة استئناف)، ولا تُكرَّر الخطوات عبر الأرشيف.
 * لا يكتب هذا السكربت في قاعدة إنتاج أبدًا: import-dev يرفض أي عنوان غير pglite:// أو localhost.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { readExamSetFile, validateExamSet, type ExamValidation } from '@/server/play/exams/engine'
import { QUEUED_STEP_TYPES, type ExamSetDocument } from '@/server/play/exams/types'

const ROOT = process.cwd()
const CONTENT = join(ROOT, 'content/play-exams')
const OUT = join(ROOT, 'outputs/play-night')

export interface LoadedSet {
  path: string
  doc: ExamSetDocument
  checksum: string
  validation: ExamValidation
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (name.endsWith('.json')) out.push(p)
  }
  return out
}

export function examSetFiles(): string[] {
  return [...walk(join(CONTENT, 'sets')), ...walk(join(CONTENT, 'fixtures'))]
}

/** يقرأ ويدقق كل المجموعات مع منع تكرار الخطوات بين المجموعات */
export function loadAll(files = examSetFiles()): { sets: LoadedSet[]; failures: { path: string; error: string }[] } {
  const seen = new Map<string, string>()
  const sets: LoadedSet[] = []
  const failures: { path: string; error: string }[] = []
  const ids = new Map<string, string>()
  for (const path of files) {
    try {
      const { doc, checksum } = readExamSetFile(path)
      const validation = validateExamSet(doc, { publicRoot: join(ROOT, 'public'), seenFingerprints: seen })
      if (ids.has(doc.set_id)) validation.errors.push({ level: 'error', code: 'DUPLICATE_SET', where: 'set_id', message: `مكرر مع ${ids.get(doc.set_id)}` })
      ids.set(doc.set_id, relative(ROOT, path))
      validation.fingerprints.forEach((fp, i) => {
        if (!seen.has(fp)) seen.set(fp, `${doc.set_id}:${doc.steps[i]?.id}`)
      })
      sets.push({ path, doc, checksum, validation })
    } catch (e) {
      failures.push({ path: relative(ROOT, path), error: e instanceof Error ? e.message : String(e) })
    }
  }
  return { sets, failures }
}

const count = <T extends string>(xs: T[]) => xs.reduce<Record<string, number>>((m, x) => ((m[x] = (m[x] ?? 0) + 1), m), {})

export function progress(sets: LoadedSet[], failures: { path: string; error: string }[]) {
  const real = sets.filter((s) => !s.doc.fixture)
  const steps = real.flatMap((s) => s.doc.steps)
  // وحدات الأرشيف المكتشفة في Drive (إن وُجد الجرد) لمعرفة ما لم يُحوَّل بعد
  const invPath = join(OUT, 'DRIVE_ARCHIVE_INVENTORY.json')
  let discovered: { group_id: string; kind: string; level: string; title: string; converted_set: string | null }[] = []
  if (existsSync(invPath)) {
    try {
      const inv = JSON.parse(readFileSync(invPath, 'utf-8')) as { units?: { group_id: string; kind: string; level: string; title: string; files?: { file_id: string }[] }[] }
      const refs = new Map<string, string>()
      for (const s of real) for (const r of [s.doc.source.original_file_ref, s.doc.source.correction_file_ref]) {
        const m = r?.match(/gdrive:([\w-]+)/)
        if (m) refs.set(m[1]!, s.doc.set_id)
      }
      discovered = (inv.units ?? []).map((u) => ({ group_id: u.group_id, kind: u.kind, level: u.level, title: u.title, converted_set: (u.files ?? []).map((f) => refs.get(f.file_id)).find(Boolean) ?? null }))
    } catch {
      /* الجرد غير صالح: يُتجاهل */
    }
  }
  return {
    generated_at: new Date().toISOString(),
    totals: {
      set_files: sets.length,
      fixtures: sets.length - real.length,
      real_sets: real.length,
      unreadable_files: failures.length,
      original_questions: real.reduce((a, s) => a + s.doc.original_questions.length, 0),
      rubric_elements: real.reduce((a, s) => a + s.doc.original_questions.reduce((b, q) => b + q.rubric_elements.length, 0), 0),
      training_steps: steps.length,
      interactive_steps: steps.filter((s) => !(QUEUED_STEP_TYPES as readonly string[]).includes(s.type)).length,
      deferred_steps: steps.filter((s) => (QUEUED_STEP_TYPES as readonly string[]).includes(s.type)).length,
      steps_by_type: count(steps.map((s) => s.type)),
      steps_by_review_status: count(real.flatMap((s) => Object.values(s.validation.stepStatus))),
      sets_by_status: count(real.map((s) => s.doc.status)),
      sets_with_errors: real.filter((s) => s.validation.errors.length).length,
      publishable_sets: real.filter((s) => s.validation.publishable).length,
      archive_units_discovered: discovered.length || null,
      archive_units_converted: discovered.length ? discovered.filter((d) => d.converted_set).length : null
    },
    sets: sets.map((s) => ({
      set_id: s.doc.set_id,
      file: relative(ROOT, s.path),
      checksum: s.checksum,
      fixture: !!s.doc.fixture,
      status: s.doc.status,
      kind: s.doc.source.kind,
      level: s.doc.source.level,
      streams: s.doc.source.streams,
      subject: s.doc.source.subject,
      year: s.doc.source.year,
      term: s.doc.source.term,
      paper: s.doc.source.paper,
      title: s.doc.source.title,
      trust: s.doc.source.trust,
      source_verified: s.doc.source.verified,
      original: s.doc.source.original_file_ref ?? s.doc.source.original_url,
      correction: s.doc.source.correction_file_ref ?? s.doc.source.correction_url,
      original_questions: s.doc.original_questions.length,
      steps: s.doc.steps.length,
      steps_by_type: count(s.doc.steps.map((x) => x.type)),
      score_total: s.doc.score_total,
      points_total: round(s.validation.totalPoints),
      interactive_points: round(s.validation.totalPoints - s.validation.deferredPoints),
      deferred_points: round(s.validation.deferredPoints),
      errors: s.validation.errors.length,
      warnings: s.validation.warnings.length,
      publishable: s.validation.publishable
    })),
    unreadable: failures,
    archive_units: discovered
  }
}

const round = (n: number) => Math.round(n * 1000) / 1000

export function reportMarkdown(sets: LoadedSet[], failures: { path: string; error: string }[]): string {
  const lines: string[] = []
  lines.push('## تدقيق مجموعات الفروض والاختبارات والبكالوريا', '')
  lines.push(`المدقق: \`npx tsx scripts/play/exams.ts validate\` — ${new Date().toISOString()}`, '')
  lines.push('| المجموعة | الحالة | الخطوات | النقاط (تفاعلية + مؤجلة) | أخطاء | تنبيهات | قابلة للنشر |', '|---|---|---|---|---|---|---|')
  for (const s of sets) {
    const v = s.validation
    lines.push(`| \`${s.doc.set_id}\`${s.doc.fixture ? ' (اختبار محرك)' : ''} | ${s.doc.status} | ${s.doc.steps.length} | ${round(v.totalPoints - v.deferredPoints)} + ${round(v.deferredPoints)} = ${round(v.totalPoints)}/${s.doc.score_total} | ${v.errors.length} | ${v.warnings.length} | ${v.publishable ? 'نعم' : 'لا'} |`)
  }
  for (const s of sets) {
    const v = s.validation
    if (!v.errors.length && !v.warnings.length) continue
    lines.push('', `### \`${s.doc.set_id}\``)
    const byCode = new Map<string, number>()
    for (const w of v.warnings) byCode.set(w.code, (byCode.get(w.code) ?? 0) + 1)
    for (const e of v.errors) lines.push(`- ❌ ${e.code} — ${e.where}: ${e.message}`)
    for (const [code, n] of byCode) lines.push(`- ⚠️ ${code} × ${n} — ${v.warnings.find((w) => w.code === code)?.message}`)
  }
  if (failures.length) {
    lines.push('', '### ملفات تعذّرت قراءتها')
    for (const f of failures) lines.push(`- \`${f.path}\`: ${f.error}`)
  }
  return lines.join('\n') + '\n'
}

function assertDevDatabase(url: string | undefined): string {
  if (!url) throw new Error('DATABASE_URL مطلوب')
  if (url.startsWith('pglite://')) return url
  const host = (() => {
    try {
      return new URL(url).hostname
    } catch {
      return ''
    }
  })()
  if (host === 'localhost' || host === '127.0.0.1') return url
  throw new Error(`رفض: ${host || 'عنوان غير معروف'} ليس قاعدة تطوير. import-dev يعمل فقط على pglite:// أو localhost.`)
}

async function importDev(sets: LoadedSet[]) {
  const url = assertDevDatabase(process.env.DATABASE_URL)
  const { createDatabase } = await import('@/server/db/connect')
  const { playExamSets } = await import('@/server/db/schema')
  const handle = await createDatabase(url)
  let inserted = 0
  let updated = 0
  let unchanged = 0
  try {
    for (const s of sets) {
      if (s.doc.fixture) continue
      if (s.validation.errors.length) {
        console.log(`تخطّي ${s.doc.set_id}: ${s.validation.errors.length} خطأ في التدقيق`)
        continue
      }
      const row = {
        setId: s.doc.set_id,
        kind: s.doc.source.kind,
        gradeCode: s.doc.source.level,
        streamCodes: s.doc.source.streams,
        subjectCode: s.doc.source.subject,
        year: s.doc.source.year,
        term: s.doc.source.term,
        paper: s.doc.source.paper,
        title: s.doc.source.title,
        status: s.doc.status,
        publishable: s.validation.publishable,
        scoreTotal: s.doc.score_total,
        stepCount: s.doc.steps.length,
        checksum: s.checksum,
        document: s.doc
      }
      const { eq } = await import('drizzle-orm')
      const [prev] = await handle.db.select({ id: playExamSets.id, checksum: playExamSets.checksum }).from(playExamSets).where(eq(playExamSets.setId, s.doc.set_id)).limit(1)
      if (!prev) {
        await handle.db.insert(playExamSets).values(row)
        inserted++
      } else if (prev.checksum !== s.checksum) {
        await handle.db.update(playExamSets).set({ ...row, updatedAt: new Date() }).where(eq(playExamSets.id, prev.id))
        updated++
      } else unchanged++
    }
  } finally {
    await handle.close()
  }
  console.log(`import-dev: ${inserted} جديدة، ${updated} محدّثة، ${unchanged} دون تغيير`)
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2)
  const { sets, failures } = loadAll()
  if (cmd === 'validate' || !cmd) {
    for (const s of sets) {
      const v = s.validation
      console.log(`${v.errors.length ? '✗' : '✓'} ${s.doc.set_id} — ${s.doc.steps.length} خطوة، ${round(v.totalPoints)}/${s.doc.score_total}، مؤجلة ${round(v.deferredPoints)}، أخطاء ${v.errors.length}، تنبيهات ${v.warnings.length}${v.publishable ? '، قابلة للنشر' : ''}`)
      for (const e of v.errors) console.log(`    ❌ ${e.code} ${e.where}: ${e.message}`)
    }
    for (const f of failures) console.log(`✗ ${f.path}: ${f.error}`)
    // مجموعة «محجوبة» (BLOCKED) تحفظ ما قُرئ بيقين مع سبب الحجب: أخطاؤها متوقعة ولا تُفشل التدقيق، ولا تُستورد
    const blocked = sets.filter((s) => s.doc.status === 'BLOCKED').length
    const bad = sets.filter((s) => s.validation.errors.length && s.doc.status !== 'BLOCKED').length + failures.length
    console.log(`\n${sets.length} ملف، ${bad} بها أخطاء${blocked ? `، ${blocked} محجوبة (سبب الحجب في source.notes)` : ''}`)
    process.exitCode = bad ? 1 : 0
  } else if (cmd === 'progress') {
    mkdirSync(OUT, { recursive: true })
    const p = progress(sets, failures)
    writeFileSync(join(OUT, 'QUESTION_CONVERSION_PROGRESS.json'), JSON.stringify(p, null, 1) + '\n')
    console.log(JSON.stringify(p.totals))
  } else if (cmd === 'report') {
    const out = rest[0] ? resolve(ROOT, rest[0]) : join(OUT, 'VALIDATION_CONTENT_SECTION.md')
    writeFileSync(out, reportMarkdown(sets, failures))
    console.log(`كُتب ${relative(ROOT, out)}`)
  } else if (cmd === 'approve') {
    const id = rest[0]
    const byIdx = rest.indexOf('--by')
    const by = byIdx >= 0 ? rest[byIdx + 1] : undefined
    if (!id || !by) throw new Error('الاستعمال: approve <set_id> --by "الاسم"')
    const s = sets.find((x) => x.doc.set_id === id)
    if (!s) throw new Error(`مجموعة غير موجودة: ${id}`)
    if (s.doc.fixture) throw new Error('لا تُعتمد مجموعات اختبار المحرك')
    if (s.validation.errors.length) throw new Error(`لا اعتماد مع أخطاء التدقيق (${s.validation.errors.length})`)
    if (!(s.doc.source.correction_file_ref || s.doc.source.correction_url)) throw new Error('لا اعتماد بلا تصحيح موثّق')
    const at = new Date().toISOString()
    const doc = s.doc
    doc.status = 'APPROVED'
    Object.assign(doc.source, { verified: true, verified_by: by, verified_at: at })
    for (const q of doc.original_questions) for (const e of q.rubric_elements) e.verified = true
    for (const st of doc.steps) if (!(QUEUED_STEP_TYPES as readonly string[]).includes(st.type) && st.review_status !== 'rejected') st.review_status = 'approved'
    doc.review_log.push({ at, by, action: 'approved', note: 'اعتماد بعد المراجعة البشرية' })
    const v = validateExamSet(doc, { publicRoot: join(ROOT, 'public') })
    writeFileSync(s.path, JSON.stringify(doc, null, 1) + '\n')
    console.log(`${id}: APPROVED — قابلة للنشر: ${v.publishable ? 'نعم' : 'لا'}${v.publishable ? '' : ` (${[...v.errors.map((e) => e.code), ...Object.entries(v.stepStatus).filter(([, x]) => x !== 'approved' && x !== 'needs_engine_support').map(([k, x]) => `${k}:${x}`)].join('، ')})`}`)
  } else if (cmd === 'import-dev') {
    if (!rest.includes('--yes-dev')) throw new Error('أضف --yes-dev لتأكيد أن الهدف قاعدة تطوير')
    await importDev(sets)
  } else {
    throw new Error(`أمر غير معروف: ${cmd}`)
  }
}

if (process.argv[1] && process.argv[1].endsWith('exams.ts')) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
}
