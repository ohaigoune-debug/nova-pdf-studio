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
import { archiveFacets, listArchive, type ArchiveFilter } from './exam-engine.service'
import { iosPaper } from './ios-tests.service'

const PAGE = 30
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface IosBacQuery {
  streamId?: string | null
  subjectId?: string | null
  year?: number | null
  cursor?: string | null
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

/** صفحة موضوع البكالوريا: الصفحة العامة نفسها لكل الملفات (مع «العبه تفاعليًا» إن وُجد في PLAY) */
export const iosBacPaper = iosPaper
