/** ملفات PDF المستوردة تُحفظ كاملة (قراءة النص لا تُفرغها)، والمحفوظ فارغاً سابقاً يُصلَح بإعادة الاستيراد */
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { setAiProviderForTests } from '@/server/ai/provider'
import type { DatabaseHandle } from '@/server/db/connect'
import { examDocuments, files } from '@/server/db/schema'
import { seedCurriculum } from '@/server/db/seed-curriculum'
import type { Actor } from '@/server/lib/actor'
import { storage } from '@/server/lib/storage'
import { importBacFiles } from '@/server/services/bac-import.service'
import { makeAdmin, setupDb } from './helpers'

let h: DatabaseHandle
let admin: Actor
let dir: string

async function pdf(label: string) {
  const d = await PDFDocument.create()
  const f = await d.embedFont(StandardFonts.Helvetica)
  for (let i = 0; i < 2; i++) d.addPage([595, 842]).drawText(`${label} ${'text '.repeat(60)}`, { x: 40, y: 760, size: 10, font: f, maxWidth: 500 })
  return d.save()
}

beforeAll(async () => {
  process.env.UPLOADS_DIR = await mkdtemp(path.join(tmpdir(), 'bac-pdf-uploads-'))
  h = await setupDb()
  await seedCurriculum(h.db)
  setAiProviderForTests(null)
  admin = await makeAdmin(h.db)
  dir = await mkdtemp(path.join(tmpdir(), 'bac-pdf-src-'))
  const leaf = path.join(dir, 'الفلسفة', 'آداب وفلسفة', '2021', 'الدورة العادية')
  await mkdir(leaf, { recursive: true })
  await writeFile(path.join(leaf, '2021 - الفلسفة - آداب وفلسفة - الدورة العادية - الموضوع.pdf'), await pdf('Sujet'))
  await writeFile(path.join(leaf, '2021 - الفلسفة - آداب وفلسفة - الدورة العادية - الحل.pdf'), await pdf('Solution'))
})

afterAll(async () => {
  delete process.env.UPLOADS_DIR
  await h.close()
})

it('الموضوع وحلّه يُحفظان بكامل بايتاتهما، والفارغ من استيراد سابق يُعاد حفظه', async () => {
  const r = await importBacFiles(h.db, admin, { kind: 'dir', dir }, { useAi: false })
  expect(r.exams).toBe(1)
  expect(r.corrections).toBe(1)
  const [doc] = await h.db.select().from(examDocuments)
  for (const id of [doc!.fileId!, doc!.solutionFileId!]) {
    const [f] = await h.db.select().from(files).where(eq(files.id, id))
    expect(f!.sizeBytes).toBeGreaterThan(500)
    const bytes = await storage().get(f!.storageKey)
    expect(Buffer.from(bytes).subarray(0, 4).toString()).toBe('%PDF')
  }

  // محاكاة ملف حُفظ فارغاً بالنسخة القديمة
  const [f] = await h.db.select().from(files).where(eq(files.id, doc!.fileId!))
  await storage().put(f!.storageKey, Buffer.alloc(0))
  await h.db.update(files).set({ sizeBytes: 0 }).where(eq(files.id, f!.id))
  const again = await importBacFiles(h.db, admin, { kind: 'dir', dir }, { useAi: false })
  expect(again.repaired).toBe(1)
  expect(again.exams + again.corrections).toBe(0)
  const [fixed] = await h.db.select().from(files).where(eq(files.id, f!.id))
  expect(fixed!.sizeBytes).toBeGreaterThan(500)
  expect(Buffer.from(await storage().get(fixed!.storageKey)).subarray(0, 4).toString()).toBe('%PDF')
})

it('مهمة استيراد متوقّفة بلا تقدّم تُغلق ويُفتح زرّ الاستيراد', async () => {
  const { enqueueJob } = await import('@/server/jobs/queue')
  const { jobs } = await import('@/server/db/schema')
  const { lastImportSummary } = await import('@/server/services/bac-import.service')
  const job = await enqueueJob(h.db, { type: 'BAC_IMPORT_FILES', payload: { folderUrl: 'x', userId: admin.userId }, workspaceId: null, maxAttempts: 1 })
  const old = new Date(Date.now() - 30 * 60_000)
  await h.db.update(jobs).set({ status: 'PROCESSING', startedAt: old, updatedAt: old, processedItems: 553, totalItems: 873 }).where(eq(jobs.id, job.id))
  const s = await lastImportSummary(h.db)
  expect(s?.running).toBe(false)
  expect(s?.error).toContain('توقّف')
})
