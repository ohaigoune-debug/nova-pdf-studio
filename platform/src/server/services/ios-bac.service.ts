/**
 * بنك البكالوريات السابقة في تطبيق الآيفون (3 نوفمبر 2026): مجاني ومفتوح كما في الموقع (/bac).
 * القائمة بمرشّحات الشعبة والمادة والسنة، ولكل موضوع: ملف الموضوع وملف الحلّ.
 * الملف المخزَّن عندنا يُعطى برابط موقّع قصير العمر يفتحه التطبيق داخله (PDF)،
 * وما لم يُخزَّن عندنا يُعطى رابطه عند المصدر (https فقط) ليفتحه التطبيق في متصفح داخلي.
 */
import { eq } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { students } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { signFileUrl } from '@/server/lib/storage'
import { archiveDocument, archiveFacets, listArchive, type ArchiveFilter } from './exam-engine.service'
import { publicResourceFile } from './library.service'

const PAGE = 30
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface IosBacQuery {
  streamId?: string | null
  subjectId?: string | null
  year?: number | null
  cursor?: string | null
}

export interface IosBacLink {
  url: string
  /** true: PDF عندنا يُعرض داخل التطبيق؛ false: صفحة أو ملف عند المصدر يُفتح في متصفح داخلي */
  inApp: boolean
}

function filterOf(q: IosBacQuery): ArchiveFilter {
  return {
    type: 'EXAM',
    streamId: q.streamId && UUID.test(q.streamId) ? q.streamId : null,
    subjectId: q.subjectId && UUID.test(q.subjectId) ? q.subjectId : null,
    year: q.year && q.year >= 1990 && q.year <= 2100 ? q.year : null
  }
}

export async function iosBacList(db: Db, actor: Actor | null, q: IosBacQuery) {
  const f = filterOf(q)
  const [list, facets, mine] = await Promise.all([
    listArchive(db, f, { cursor: q.cursor ?? null, limit: PAGE }),
    archiveFacets(db, f),
    actor?.studentId ? db.select({ streamId: students.streamId }).from(students).where(eq(students.id, actor.studentId)).limit(1) : Promise.resolve([])
  ])
  return {
    items: list.items.map((it) => ({
      id: it.id,
      title: it.title,
      year: it.year,
      session: it.session,
      subjectName: it.subjectName,
      streamName: it.streamName,
      topic: it.topic,
      official: it.official,
      hasPaper: Boolean(it.fileUrl),
      hasSolution: Boolean(it.solutionUrl)
    })),
    nextCursor: list.nextCursor,
    facets: { streams: facets.streams, subjects: facets.subjects, years: facets.years },
    total: facets.total,
    /** شعبة التلميذ لاختيارها مسبقًا في التطبيق (إن كان مسجّلًا) */
    myStreamId: mine[0]?.streamId ?? null
  }
}

function linkOf(f: { fileId: string | null; url: string | null } | null): IosBacLink | null {
  if (!f) return null
  if (f.fileId) return { url: signFileUrl(f.fileId, 1800), inApp: true }
  return f.url && /^https:\/\//i.test(f.url) ? { url: f.url, inApp: false } : null
}

export async function iosBacPaper(db: Db, actor: Actor | null, id: string) {
  const d = await archiveDocument(db, id)
  const viewer = { studentId: actor?.studentId ?? null, userId: actor?.userId ?? null }
  const [paper, solution] = await Promise.all([
    publicResourceFile(db, id, 'file', viewer).catch(() => null),
    publicResourceFile(db, id, 'solution', viewer).catch(() => null)
  ])
  return {
    id: d.resource.id,
    title: d.resource.title,
    year: d.resource.year,
    session: d.resource.session,
    official: d.resource.official,
    subjectName: d.subjectName,
    streamName: d.streamName,
    source: d.source ? { name: d.source.name, attribution: d.source.attribution } : null,
    paper: linkOf(paper),
    solution: linkOf(solution)
  }
}
