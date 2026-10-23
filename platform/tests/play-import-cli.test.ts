import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { auditLogs, playQuestions } from '@/server/db/schema'
import { runImport } from '../scripts/play/import'
import { setupDb } from './helpers'

let h: DatabaseHandle
let dir: string
let prevCwd: string

const catalog = {
  version: 1,
  grades: [{ grade: '3AS', subjects: [{ subject: 'AR', units: [{ code: 'U3', name: 'البناء اللغوي', lessons: [{ code: 'L4', name: 'الصور البيانية' }] }] }] }]
}

const mcq = (n: number, patch: Record<string, unknown> = {}) => ({
  key: `3AS-AR-U3-L4-${String(n).padStart(4, '0')}`,
  type: 'MCQ',
  grade: '3AS',
  subject: 'AR',
  unit: 'U3',
  lesson: 'L4',
  difficulty: 'EASY',
  question: `ما نوع الصورة البيانية في «ابتسم الصباح»؟ (${n})`,
  options: ['تشبيه بليغ', 'استعارة مكنية', 'كناية', 'مجاز مرسل'],
  correct: 1,
  explanation: 'شُبّه الصباح بإنسان يبتسم وحُذف المشبه به وأبقيت لازمة من لوازمه.',
  ...patch
})

beforeAll(async () => {
  h = await setupDb()
  // مجلد عمل مؤقت يحاكي platform/ بملفات content/play
  dir = mkdtempSync(join(tmpdir(), 'play-import-'))
  mkdirSync(join(dir, 'content', 'play', '3AS', 'AR'), { recursive: true })
  writeFileSync(join(dir, 'content', 'play', 'catalog.json'), JSON.stringify(catalog))
  writeFileSync(join(dir, 'content', 'play', '3AS', 'AR', 'A.json'), JSON.stringify([mcq(1), mcq(2)]))
  writeFileSync(join(dir, 'content', 'play', '3AS', 'AR', 'B.json'), JSON.stringify([mcq(3), mcq(4, { correct: 9 })]))
  writeFileSync(join(dir, 'content', 'play', '3AS', 'AR', 'broken.json'), '{ not json')
  prevCwd = process.cwd()
  process.chdir(dir)
})

afterAll(async () => {
  process.chdir(prevCwd)
  await h.close()
})

const count = async () => (await h.db.select({ n: sql<number>`count(*)::int` }).from(playQuestions))[0]!.n

describe('scripts/play/import.ts', () => {
  it('dry-run يعدّ ولا يكتب شيئاً', async () => {
    const r = await runImport(h.db, { dryRun: true, catalog: false })
    expect(r.dryRun).toBe(true)
    expect(r.totals.total).toBe(4)
    expect(r.failedFiles.map((f) => f.file.endsWith('broken.json'))).toEqual([true])
    expect(await count()).toBe(0)
  })

  it('يزامن المنهاج ويستورد الصالح فقط، ويعزل الملف التالف والسؤال غير الصالح', async () => {
    const r = await runImport(h.db)
    expect(r.catalog?.lessons).toBe(1)
    expect(r.totals.inserted).toBe(3)
    expect(r.totals.skippedInvalid).toBe(1)
    expect(r.totals.errors[0]!.key).toBe('3AS-AR-U3-L4-0004')
    expect(r.failedFiles).toHaveLength(1)
    expect(await count()).toBe(3)
    const audits = await h.db.select().from(auditLogs).where(eq(auditLogs.action, 'play.import.run'))
    expect(audits).toHaveLength(1)
  })

  it('إعادة التشغيل لا تكرّر، والمرشّحات تعمل', async () => {
    const r = await runImport(h.db, { catalog: false, grade: '3AS', subject: 'AR' })
    expect(r.totals.inserted).toBe(0)
    expect(r.totals.updated).toBe(3)
    expect(await count()).toBe(3)
    const none = await runImport(h.db, { catalog: false, grade: '4AM' })
    expect(none.files).toHaveLength(0)
  })
})
