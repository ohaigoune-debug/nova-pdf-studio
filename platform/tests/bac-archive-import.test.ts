/**
 * أرشيف «BAC 2008-2026» على Drive: مادة / شعبة / سنة / دورة / «2022 - القانون - تسيير واقتصاد - الدورة العادية - الموضوع.pdf»
 * يُستورد كاملاً (أعمق وأكبر من حدود مكتبة الأستاذ)، مجلداً مجلداً، ويُستأنف بلا إعادة تنزيل.
 */
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setAiProviderForTests } from '@/server/ai/provider'
import type { AIProvider } from '@/server/ai/types'
import type { DatabaseHandle } from '@/server/db/connect'
import { contentSources, examDocuments, resources, streams, subjects } from '@/server/db/schema'
import { seedCurriculum } from '@/server/db/seed-curriculum'
import type { Actor } from '@/server/lib/actor'
import { parseEmbeddedFolderView } from '@/server/lib/google-drive'
import { importBacFiles } from '@/server/services/bac-import.service'
import { makeAdmin, setupDb } from './helpers'

let h: DatabaseHandle
let admin: Actor

const noAi: AIProvider = {
  name: 'fake',
  model: 'fake-1',
  evaluateEssay: () => Promise.reject(new Error('n/a')),
  generateTeacherInsights: () => Promise.reject(new Error('n/a')),
  generateExercises: () => Promise.reject(new Error('n/a')),
  analyzeStudent: () => Promise.reject(new Error('n/a')),
  classifyBacFile: () => Promise.reject(new Error('الأسماء تكفي: لا يُسأل الذكاء الاصطناعي'))
}

/** شجرة الأرشيف: [مادة، شعبة، سنة، دورة، [ملفات]] */
type Leaf = { subject: string; stream: string; year: number; session: string; files: string[] }
const LEAVES: Leaf[] = [
  { subject: 'القانون', stream: 'تسيير واقتصاد', year: 2022, session: 'الدورة العادية', files: ['الموضوع', 'الحل'] },
  { subject: 'القانون', stream: 'تسيير واقتصاد', year: 2017, session: 'الدورة العادية', files: ['الموضوع', 'الحل'] },
  { subject: 'الرياضيات', stream: 'رياضيات', year: 2019, session: 'الدورة العادية', files: ['الموضوع', 'الحل'] },
  { subject: 'الرياضيات', stream: 'تقني رياضي', year: 2019, session: 'الدورة العادية', files: ['الموضوع', 'الحل'] },
  { subject: 'اللغة العربية وآدابها', stream: 'آداب وفلسفة', year: 2017, session: 'الدورة الاستدراكية', files: ['الموضوع'] },
  { subject: 'الهندسة الكهربائية', stream: 'تقني رياضي', year: 2015, session: 'الدورة العادية', files: ['الموضوع', 'الحل'] }
]

interface Node {
  id: string
  name: string
  folder: boolean
  parent: string
  text?: string
}

/** يبني الشجرة بمعرّفات Drive حقيقية الشكل */
function buildTree(): Node[] {
  const nodes: Node[] = [{ id: 'ROOTfolder000000', name: 'اختبارات مدرسة', folder: true, parent: '' }]
  let n = 0
  const id = () => `F${String(++n).padStart(15, '0')}`
  const folder = (name: string, parent: string) => {
    const hit = nodes.find((x) => x.folder && x.name === name && x.parent === parent)
    if (hit) return hit.id
    const node = { id: id(), name, folder: true, parent }
    nodes.push(node)
    return node.id
  }
  for (const l of LEAVES) {
    const s = folder(l.subject, 'ROOTfolder000000')
    const st = folder(l.stream, s)
    const y = folder(String(l.year), st)
    const se = folder(l.session, y)
    for (const f of l.files) {
      const name = `${l.year} - ${l.subject} - ${l.stream} - ${l.session} - ${f}.txt`
      nodes.push({ id: id(), name, folder: false, parent: se, text: `${f === 'الحل' ? 'الإجابة النموذجية' : 'امتحان بكالوريا التعليم الثانوي'} — دورة ${l.year} — ${l.subject} — ${l.stream}\n${'نصّ الموضوع. '.repeat(30)}` })
    }
  }
  return nodes
}

/** Drive API v3 مزيّف (بمفتاح) */
function apiFetch(nodes: Node[], downloads: string[]): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    if (url.searchParams.get('key') !== 'test-key') return new Response('{"error":{"message":"API key not valid"}}', { status: 400 })
    const parts = url.pathname.replace('/drive/v3/', '').split('/')
    if (parts[0] === 'files' && parts.length === 1) {
      const parent = /'([^']+)' in parents/.exec(url.searchParams.get('q') ?? '')?.[1] ?? ''
      return Response.json({ files: nodes.filter((x) => x.parent === parent).map((x) => ({ id: x.id, name: x.name, mimeType: x.folder ? 'application/vnd.google-apps.folder' : 'text/plain', modifiedTime: '2026-10-11T20:00:00Z' })) })
    }
    const node = nodes.find((x) => x.id === decodeURIComponent(parts[1] ?? ''))
    if (!node) return new Response('', { status: 404 })
    if (url.searchParams.get('alt') === 'media') {
      downloads.push(node.id)
      return new Response(node.text ?? '')
    }
    return Response.json({ id: node.id, name: node.name, mimeType: node.folder ? 'application/vnd.google-apps.folder' : 'text/plain' })
  }) as typeof fetch
}

/** مجلد عامّ بلا مفتاح: صفحات embeddedfolderview ورابط التنزيل المباشر */
function publicFetch(nodes: Node[], downloads: string[]): typeof fetch {
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  return (async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    if (url.hostname === 'www.googleapis.com') return new Response('{"error":{"status":"PERMISSION_DENIED","message":"Drive API has not been used in project"}}', { status: 403 })
    if (url.pathname === '/embeddedfolderview') {
      const id = url.searchParams.get('id')!
      const self = nodes.find((x) => x.id === id)
      if (!self) return new Response('', { status: 404 })
      const entries = nodes
        .filter((x) => x.parent === id)
        .map(
          (x) =>
            `<div class="flip-entry" id="entry-${x.id}" tabindex="0" role="link"><div class="flip-entry-info"><a href="${x.folder ? `https://drive.google.com/drive/folders/${x.id}` : `https://drive.google.com/file/d/${x.id}/view?usp=drive_web`}" target="_blank"><div class="flip-entry-thumb"></div><div class="flip-entry-title">${esc(x.name)}</div></a></div></div>`
        )
        .join('')
      return new Response(`<!DOCTYPE html><html><head><title>${esc(self.name)}</title></head><body><div class="flip-list">${entries}</div></body></html>`, { headers: { 'content-type': 'text/html; charset=utf-8' } })
    }
    if (url.hostname === 'drive.usercontent.google.com') {
      const node = nodes.find((x) => x.id === url.searchParams.get('id'))
      if (!node) return new Response('<html>login</html>', { status: 200, headers: { 'content-type': 'text/html' } })
      downloads.push(node.id)
      return new Response(node.text ?? '', { headers: { 'content-type': 'text/plain' } })
    }
    return new Response('', { status: 404 })
  }) as typeof fetch
}

beforeAll(async () => {
  process.env.UPLOADS_DIR = await mkdtemp(path.join(tmpdir(), 'bac-archive-uploads-'))
  h = await setupDb()
  await seedCurriculum(h.db)
  setAiProviderForTests(noAi)
  admin = await makeAdmin(h.db)
})

afterAll(async () => {
  setAiProviderForTests(null)
  delete process.env.UPLOADS_DIR
  await h.close()
})

describe('استيراد أرشيف البكالوريا من Drive', () => {
  it('يقرأ الأرشيف على خمسة مستويات، يربط كل حلّ بموضوعه، ويرفق الملف بموضوع مسجّل بلا ملف بدل تكراره', async () => {
    // موضوع مسجّل سلفاً بلا ملف (كمواضيع البنك القديمة): القانون — تسيير واقتصاد — 2017
    const [law] = await h.db.select().from(subjects).where(eq(subjects.code, 'LAW'))
    const [ge] = await h.db.select().from(streams).where(eq(streams.code, 'GE'))
    const [onec] = await h.db.select().from(contentSources).where(eq(contentSources.code, 'onec'))
    const [old] = await h.db.insert(resources).values({ title: 'بكالوريا 2017 — القانون — شعبة تسيير واقتصاد', type: 'EXAM', subjectId: law!.id, streamId: ge!.id, examYear: 2017, examSession: 'NORMAL', sourceId: onec!.id, isOfficial: true, fingerprint: 'legacy:law-2017', status: 'PUBLISHED', accessLevel: 'PUBLIC' }).returning()
    await h.db.insert(examDocuments).values({ resourceId: old!.id, title: old!.title, docType: 'BAC', subjectId: law!.id, streamId: ge!.id, examYear: 2017, examSession: 'NORMAL', sourceId: onec!.id, status: 'PENDING' })

    const nodes = buildTree()
    const downloads: string[] = []
    const r = await importBacFiles(h.db, admin, { kind: 'drive', folderUrl: 'https://drive.google.com/drive/folders/ROOTfolder000000?usp=sharing' }, { drive: { apiKey: 'test-key', fetch: apiFetch(nodes, downloads) } })
    expect(r.files).toBe(11)
    expect(r.errors).toBe(0)
    expect(r.unclassified).toBe(0)
    expect(r.exams).toBe(6)
    expect(r.corrections).toBe(5)
    expect(r.items.find((i) => i.name.includes('2017 - القانون') && i.outcome === 'exam')?.title).toContain('أُرفق الملف بالموضوع الموجود')

    const docs = await h.db.select().from(examDocuments).where(eq(examDocuments.docType, 'BAC'))
    expect(docs).toHaveLength(6)
    for (const d of docs) expect(d.fileId).toBeTruthy()
    const elec = docs.find((d) => d.title.includes('الهندسة الكهربائية'))!
    expect(elec).toMatchObject({ examYear: 2015, examSession: 'NORMAL' })
    expect(elec.solutionFileId).toBeTruthy()
    const arabic = docs.find((d) => d.title.includes('اللغة العربية'))!
    expect(arabic).toMatchObject({ examYear: 2017, examSession: 'MAKEUP' })
    expect(arabic.solutionFileId).toBeNull()
    // الشعبة من اسم المجلد: «رياضيات» شعبة الرياضيات و«تقني رياضي» شعبة تقني رياضي
    const mathDocs = docs.filter((d) => d.title.includes('الرياضيات'))
    expect(mathDocs).toHaveLength(2)
    const legacy = docs.find((d) => d.resourceId === old!.id)!
    expect(legacy.fileId).toBeTruthy()
    expect(legacy.solutionFileId).toBeTruthy()
    const [legacyRes] = await h.db.select().from(resources).where(eq(resources.id, old!.id))
    expect(legacyRes).toMatchObject({ hasSolution: true })
    expect(legacyRes!.fileId).toBeTruthy()

    // الاستئناف: لا تنزيل لما استُورد، ولا تكرار
    const before = downloads.length
    const again = await importBacFiles(h.db, admin, { kind: 'drive', folderUrl: 'ROOTfolder000000' }, { drive: { apiKey: 'test-key', fetch: apiFetch(nodes, downloads) } })
    expect(downloads.length).toBe(before)
    expect(again.duplicates).toBe(11)
    expect(again.exams + again.corrections).toBe(0)
    expect(await h.db.select().from(examDocuments).where(eq(examDocuments.docType, 'BAC'))).toHaveLength(6)
  })

  it('بلا مفتاح Drive API صالح: المجلد العامّ يُقرأ من صفحة العرض المضمَّن ويُنزَّل بالرابط المباشر', async () => {
    const nodes = buildTree().map((x) => (x.folder ? x : { ...x, id: `P${x.id.slice(1)}`, text: `${x.text}\nنسخة ثانية` }))
    // معرّفات مختلفة ونصوص مختلفة: ملفات جديدة على مواضيع موجودة ⇒ مكرّرة بالمفتاح، والحلول مكرّرة بالمفتاح أيضاً
    const downloads: string[] = []
    const r = await importBacFiles(h.db, admin, { kind: 'drive', folderUrl: 'ROOTfolder000000' }, { drive: { apiKey: 'bad-key', fetch: publicFetch(nodes, downloads) } })
    expect(r.files).toBe(11)
    expect(downloads).toHaveLength(11)
    expect(r.errors).toBe(0)
    expect(r.exams + r.corrections).toBe(0)
    // المواضيع موجودة بملفاتها وحلولها: النسخ الثانية لا تُخزَّن ولا تستبدل شيئاً
    expect(r.duplicates).toBe(11)
    expect(await h.db.select().from(examDocuments).where(and(eq(examDocuments.docType, 'BAC')))).toHaveLength(6)
  })

  it('يقرأ صفحة embeddedfolderview: مجلدات وملفات بأسمائها العربية', () => {
    const html = `<div class="flip-entry" id="entry-1aBcDeFgHiJkLmN" tabindex="0" role="link"><div class="flip-entry-info"><a href="https://drive.google.com/drive/folders/1aBcDeFgHiJkLmN" target="_blank"><div class="flip-entry-title">القانون</div></a></div></div><div class="flip-entry" id="entry-1zYxWvUtSrQpOnM" tabindex="0" role="link"><div class="flip-entry-info"><a href="https://drive.google.com/file/d/1zYxWvUtSrQpOnM/view?usp=drive_web" target="_blank"><div class="flip-entry-title">2022 - القانون - تسيير واقتصاد - الدورة العادية - الموضوع.pdf</div></a></div></div>`
    expect(parseEmbeddedFolderView(html)).toEqual([
      { id: '1aBcDeFgHiJkLmN', name: 'القانون', folder: true },
      { id: '1zYxWvUtSrQpOnM', name: '2022 - القانون - تسيير واقتصاد - الدورة العادية - الموضوع.pdf', folder: false }
    ])
  })
})
