/**
 * مدقق بنك أسئلة PLAY — فحص بنيوي + كشف تكرار + تطابق مع المنهاج.
 *   npx tsx scripts/play/validate.ts                 → كل ملفات content/play/** (مع كشف التكرار عبر الملفات)
 *   npx tsx scripts/play/validate.ts path/a.json ... → ملفات محددة (التكرار يُفحص داخل الملفات المعطاة + ضد بقية البنك)
 *   --json  → مخرجات JSON (للأتمتة)   --strict → التحذيرات تُعدّ أخطاءً
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { contentHash, promptHash, validateContentQuestion } from '@/server/play/engine'
import type { PlayContentQuestion } from '@/server/play/question-types'
import type { PlayCatalog } from '@/server/play/importer'

const ROOT = join(process.cwd(), 'content', 'play')

export function listContentFiles(dir = ROOT): string[] {
  const out: string[] = []
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name)
      const st = statSync(p)
      if (st.isDirectory()) walk(p)
      else if (name.endsWith('.json') && name !== 'catalog.json' && name !== 'coverage-map.json' && name !== 'progress.json') out.push(p)
    }
  }
  walk(dir)
  return out.sort()
}

export function lessonKeySet(): Set<string> {
  const catalog = JSON.parse(readFileSync(join(ROOT, 'catalog.json'), 'utf-8')) as PlayCatalog
  const set = new Set<string>()
  for (const g of catalog.grades) for (const e of g.subjects) for (const u of e.units) for (const l of u.lessons) set.add(`${g.grade}|${e.subject}|${u.code}|${l.code}`)
  return set
}

export interface FileReport {
  file: string
  count: number
  valid: number
  errors: { key: string; errors: string[] }[]
  warnings: { key: string; warnings: string[] }[]
}

export function validateFiles(files: string[], allFiles: string[], opts: { strict?: boolean } = {}) {
  const lessons = lessonKeySet()
  const keys = new Map<string, string>()
  const hashes = new Map<string, string>()
  const prompts = new Map<string, string>()
  const reports: FileReport[] = []
  const targets = new Set(files)
  // أولاً: سجّل مفاتيح/بصمات الملفات غير المستهدفة لكشف التكرار عبر البنك
  const load = (file: string): PlayContentQuestion[] => {
    try {
      const data = JSON.parse(readFileSync(file, 'utf-8'))
      if (!Array.isArray(data)) throw new Error('not an array')
      return data as PlayContentQuestion[]
    } catch (e) {
      reports.push({ file: relative(process.cwd(), file), count: 0, valid: 0, errors: [{ key: '*', errors: [`JSON غير صالح: ${(e as Error).message}`] }], warnings: [] })
      return []
    }
  }
  for (const file of allFiles) {
    if (targets.has(file)) continue
    for (const q of load(file)) {
      if (q?.key) {
        keys.set(q.key, file)
        try {
          hashes.set(contentHash(q), q.key)
          prompts.set(promptHash(q.question ?? ''), q.key)
        } catch {
          /* ignore */
        }
      }
    }
  }
  let totalValid = 0
  let total = 0
  let dupes = 0
  for (const file of files) {
    const rel = relative(process.cwd(), file)
    const rows = load(file)
    const rep: FileReport = { file: rel, count: rows.length, valid: 0, errors: [], warnings: [] }
    for (const q of rows) {
      total++
      const key = q?.key ?? '?'
      const v = validateContentQuestion(q)
      const errs = [...v.errors]
      if (q?.grade && !lessons.has(`${q.grade}|${q.subject}|${q.unit}|${q.lesson}`)) errs.push(`الدرس ${q.grade}/${q.subject}/${q.unit}/${q.lesson} غير موجود في catalog.json`)
      if (keys.has(key)) errs.push(`key مكرر (موجود في ${relative(process.cwd(), keys.get(key)!)})`)
      else keys.set(key, file)
      if (errs.length === 0) {
        const h = contentHash(q)
        const p = promptHash(q.question)
        if (hashes.has(h)) {
          errs.push(`سؤال مكرر بالمحتوى نفسه (${hashes.get(h)})`)
          dupes++
        } else if (prompts.has(p)) {
          v.warnings.push(`نص السؤال مطابق لسؤال آخر (${prompts.get(p)}) باختيارات مختلفة`)
          hashes.set(h, key)
        } else {
          hashes.set(h, key)
          prompts.set(p, key)
        }
      }
      if (opts.strict && v.warnings.length) errs.push(...v.warnings.map((w) => `تحذير صارم: ${w}`))
      if (errs.length) rep.errors.push({ key, errors: errs })
      else {
        rep.valid++
        totalValid++
      }
      if (v.warnings.length) rep.warnings.push({ key, warnings: v.warnings })
    }
    reports.push(rep)
  }
  return { reports, total, totalValid, dupes }
}

function main() {
  const args = process.argv.slice(2)
  const json = args.includes('--json')
  const strict = args.includes('--strict')
  const files = args.filter((a) => !a.startsWith('--')).map((a) => join(process.cwd(), a))
  const all = listContentFiles()
  const targets = files.length ? files : all
  const result = validateFiles(targets, all, { strict })
  if (json) {
    console.log(JSON.stringify(result, null, 1))
  } else {
    for (const r of result.reports) {
      const status = r.errors.length ? '✗' : '✓'
      console.log(`${status} ${r.file}: ${r.valid}/${r.count} صالح، ${r.errors.length} خطأ، ${r.warnings.length} تحذير`)
      for (const e of r.errors) console.log(`   - ${e.key}: ${e.errors.join(' | ')}`)
      for (const w of r.warnings.slice(0, 30)) console.log(`   ~ ${w.key}: ${w.warnings.join(' | ')}`)
      if (r.warnings.length > 30) console.log(`   ~ … و${r.warnings.length - 30} تحذيرات أخرى`)
    }
    console.log(`\nالمجموع: ${result.totalValid}/${result.total} صالح — تكرارات: ${result.dupes}`)
  }
  const failed = result.reports.some((r) => r.errors.length > 0)
  process.exit(failed ? 1 : 0)
}

if (process.argv[1] && /validate\.ts$/.test(process.argv[1])) main()
