/**
 * بنك الفروض والاختبارات في تطبيق الآيفون (Build 14، 3 نوفمبر 2026)، خطوة بعد خطوة كما طلب المالك:
 * الفصل ← السنة (المستوى) ← المادة ← القائمة. القائمة: ملفات الفروض والاختبارات (نفس /exams في الموقع،
 * بلا البكالوريا الرسمية)، ونسخها التفاعلية في PLAY للفصل نفسه حين تكون السنة سنةَ التلميذ.
 * وصفحة الموضوع عامة لكل ملف (فرض، اختبار، بكالوريا): الموضوع والحلّ و«العبه تفاعليًا» إن وُجد.
 */
import { and, asc, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { contentSources, examDocuments, levels, playExamSets, resources, streams, students, subjects } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { signFileUrl } from '@/server/lib/storage'
import { PLAY_TO_CURRICULUM_SUBJECT } from '@/server/play/constants'
import { topicNumberOf } from '@/lib/bac-bank'
import { streamFamily } from './academy-catalog.service'
import type { ResourceType } from '@/server/db/schema/enums'
import { bacExclusionClauses, listResourceCards, notAttachedSolution, publicResourceFile, visibleResources } from './library.service'
import { getPlayProfile } from './play.service'
import { isServableSet, listExamSets } from './play-exams.service'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TEST_TYPES: ResourceType[] = ['HOMEWORK', 'TEST', 'EXAM']
const PAGE = 40

export interface IosTestsQuery {
  term?: number | null
  levelId?: string | null
  subjectId?: string | null
  cursor?: string | null
}

/** رموز مواد PLAY لمادة المنهاج (ARABIC ← AR…) */
function playCodesFor(subjectCode: string | null | undefined): string[] {
  if (!subjectCode) return []
  return Object.entries(PLAY_TO_CURRICULUM_SUBJECT)
    .filter(([, codes]) => codes.includes(subjectCode))
    .map(([play]) => play)
}

async function studentScope(db: Db, actor: Actor | null): Promise<{ levelId: string | null; streamId: string | null }> {
  if (!actor?.studentId) return { levelId: null, streamId: null }
  const [s] = await db.select({ levelId: students.levelId, streamId: students.streamId }).from(students).where(eq(students.id, actor.studentId)).limit(1)
  return { levelId: s?.levelId ?? null, streamId: s?.streamId ?? null }
}

export async function iosTestsBank(db: Db, actor: Actor | null, q: IosTestsQuery) {
  const term = q.term && q.term >= 1 && q.term <= 3 ? q.term : null
  const levelId = q.levelId && UUID.test(q.levelId) ? q.levelId : null
  const subjectId = q.subjectId && UUID.test(q.subjectId) ? q.subjectId : null
  const mine = await studentScope(db, actor)
  const family = await streamFamily(db, mine.streamId)
  const studentId = actor?.studentId ?? null
  const base = (extra: (ReturnType<typeof eq> | undefined)[] = []) =>
    and(
      visibleResources(studentId),
      notAttachedSolution(),
      ...bacExclusionClauses(),
      inArray(resources.type, TEST_TYPES),
      isNotNull(resources.schoolTerm),
      family.length ? sql`(${resources.streamId} is null or ${inArray(resources.streamId, family)})` : undefined,
      ...extra
    )

  // السنوات (المستويات) التي فيها فروض لهذا الفصل، وسنة التلميذ أولًا
  const levelRows = await db
    .select({ id: levels.id, name: levels.nameAr, code: levels.code, sort: levels.sortOrder, n: sql<number>`count(${resources.id})::int` })
    .from(levels)
    .leftJoin(resources, and(eq(resources.levelId, levels.id), base(term ? [eq(resources.schoolTerm, term)] : [])))
    .groupBy(levels.id, levels.nameAr, levels.code, levels.sortOrder)
    .orderBy(asc(levels.sortOrder))
  const levelList = levelRows
    .filter((l) => l.n > 0 || l.id === mine.levelId)
    .sort((a, b) => Number(b.id === mine.levelId) - Number(a.id === mine.levelId) || a.sort - b.sort)
    .map((l) => ({ id: l.id, name: l.name, code: l.code, count: l.n }))

  // عدد كل فصل (لسنة التلميذ إن لم تُختر سنة)
  const termLevel = levelId ?? mine.levelId
  const termRows = await db
    .select({ term: resources.schoolTerm, n: sql<number>`count(*)::int` })
    .from(resources)
    .where(base(termLevel ? [eq(resources.levelId, termLevel)] : []))
    .groupBy(resources.schoolTerm)
  const terms = [1, 2, 3].map((t) => ({ term: t, count: termRows.find((r) => r.term === t)?.n ?? 0 }))

  let subjectList: { id: string; name: string; count: number }[] = []
  if (term && levelId) {
    const rows = await db
      .select({ id: subjects.id, name: subjects.nameAr, sort: subjects.sortOrder, n: sql<number>`count(*)::int` })
      .from(resources)
      .innerJoin(subjects, eq(subjects.id, resources.subjectId))
      .where(base([eq(resources.schoolTerm, term), eq(resources.levelId, levelId)]))
      .groupBy(subjects.id, subjects.nameAr, subjects.sortOrder)
      .orderBy(asc(subjects.sortOrder))
    subjectList = rows.map((r) => ({ id: r.id, name: r.name, count: r.n }))
  }

  let papers: { id: string; title: string; typeLabel: string; year: number | null; hasSolution: boolean; hasFile: boolean }[] = []
  let nextCursor: string | null = null
  let interactive: { id: string; title: string; kind: string; year: number | null }[] = []
  if (term && levelId && subjectId) {
    const list = await listResourceCards(db, { levelId, subjectId, streamIds: family, term, excludeBac: true, studentId, types: TEST_TYPES }, { cursor: q.cursor ?? null, limit: PAGE })
    papers = list.items.map((it) => ({ id: it.id, title: it.title, typeLabel: it.typeLabel, year: it.year, hasSolution: it.hasSolution, hasFile: it.hasFile }))
    nextCursor = list.nextCursor
    // النسخ التفاعلية في PLAY: لسنة التلميذ في PLAY فقط (حزم المواضيع تتبع سنته)
    const [lv] = await db.select({ code: levels.code }).from(levels).where(eq(levels.id, levelId)).limit(1)
    const [sub] = await db.select({ code: subjects.code }).from(subjects).where(eq(subjects.id, subjectId)).limit(1)
    const play = playCodesFor(sub?.code)[0]
    if (actor?.studentId && play && !q.cursor) {
      const sets = await listExamSets(db, actor, { subjectCode: play, kind: 'TESTS' })
      if (sets.gradeCode && sets.gradeCode === lv?.code) {
        interactive = sets.items.filter((s) => s.term === term).map((s) => ({ id: s.id, title: s.title, kind: s.kind, year: s.year }))
      }
    }
  }

  return { terms, levels: levelList, myLevelId: mine.levelId, subjects: subjectList, papers, nextCursor, interactive }
}

export interface IosPaperLink {
  url: string
  /** true: PDF عندنا يُعرض داخل التطبيق؛ false: صفحة أو ملف عند المصدر يُفتح في المتصفح */
  inApp: boolean
}

function linkOf(f: { fileId: string | null; url: string | null } | null): IosPaperLink | null {
  if (!f) return null
  if (f.fileId) return { url: signFileUrl(f.fileId, 1800), inApp: true }
  return f.url && /^https:\/\//i.test(f.url) ? { url: f.url, inApp: false } : null
}

/** النسخة التفاعلية في PLAY لموضوع (بكالوريا أو فرض أو اختبار) إن وُجدت لسنة التلميذ وشعبته */
async function playVersionOf(
  db: Db,
  actor: Actor | null,
  r: { type: string; isOfficial: boolean; examYear: number | null; academicYear: number | null; schoolTerm: number | null; title: string },
  levelCode: string | null,
  subjectCode: string | null,
  topic: number | null
): Promise<{ id: string; title: string } | null> {
  if (!actor?.studentId || !levelCode) return null
  const kind = r.type === 'HOMEWORK' ? 'DEVOIR' : r.type === 'TEST' ? 'TEST' : r.type === 'EXAM' && r.isOfficial ? 'BAC' : r.type === 'EXAM' ? 'TEST' : null
  const codes = playCodesFor(subjectCode)
  const year = r.examYear ?? r.academicYear
  if (!kind || !codes.length || !year) return null
  const profile = await getPlayProfile(db, actor)
  if (profile.gradeCode !== levelCode) return null
  const rows = await db
    .select({ id: playExamSets.id, title: playExamSets.title, status: playExamSets.status, publishable: playExamSets.publishable, streamCodes: playExamSets.streamCodes, term: playExamSets.term, paper: playExamSets.paper })
    .from(playExamSets)
    .where(and(eq(playExamSets.kind, kind), eq(playExamSets.gradeCode, levelCode), inArray(playExamSets.subjectCode, codes), eq(playExamSets.year, year)))
  const hit = rows.find(
    (s) =>
      isServableSet(s) &&
      (!s.streamCodes.length || !profile.streamCode || s.streamCodes.includes(profile.streamCode)) &&
      (kind === 'BAC' ? !topic || !s.paper || s.paper === topic : !r.schoolTerm || !s.term || s.term === r.schoolTerm)
  )
  return hit ? { id: hit.id, title: hit.title } : null
}

/** صفحة موضوع في التطبيق: الموضوع والحلّ و«العبه تفاعليًا» — لأي ملف يراه التلميذ (فرض، اختبار، بكالوريا) */
export async function iosPaper(db: Db, actor: Actor | null, id: string) {
  if (!UUID.test(id)) throw new AppError('NOT_FOUND')
  const viewer = { studentId: actor?.studentId ?? null, userId: actor?.userId ?? null }
  const [x] = await db
    .select({
      r: resources,
      subjectName: subjects.nameAr,
      subjectCode: subjects.code,
      levelCode: levels.code,
      streamName: streams.nameAr,
      source: { name: contentSources.name, attribution: contentSources.attribution },
      topic: examDocuments.topicNumber
    })
    .from(resources)
    .innerJoin(contentSources, eq(contentSources.id, resources.sourceId))
    .leftJoin(subjects, eq(subjects.id, resources.subjectId))
    .leftJoin(levels, eq(levels.id, resources.levelId))
    .leftJoin(streams, eq(streams.id, resources.streamId))
    .leftJoin(examDocuments, eq(examDocuments.resourceId, resources.id))
    .where(and(eq(resources.id, id), visibleResources(viewer.studentId)))
    .limit(1)
  if (!x) throw new AppError('NOT_FOUND')
  const topic = x.topic ?? topicNumberOf(x.r.title)
  const [paper, solution, play] = await Promise.all([
    publicResourceFile(db, id, 'file', viewer).catch(() => null),
    publicResourceFile(db, id, 'solution', viewer).catch(() => null),
    playVersionOf(db, actor, x.r, x.levelCode, x.subjectCode, topic).catch(() => null)
  ])
  return {
    id: x.r.id,
    title: x.r.title,
    year: x.r.examYear ?? x.r.academicYear,
    session: x.r.examSession,
    term: x.r.schoolTerm,
    topic,
    official: x.r.isOfficial,
    subjectName: x.subjectName,
    streamName: x.streamName,
    source: { name: x.source.name, attribution: x.source.attribution },
    paper: linkOf(paper),
    solution: linkOf(solution),
    play
  }
}
