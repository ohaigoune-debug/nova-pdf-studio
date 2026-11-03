/**
 * بنك الفروض والاختبارات في تطبيق الآيفون (Build 14، 3 نوفمبر 2026)، خطوة بعد خطوة كما طلب المالك:
 * الفصل ← السنة (المستوى) ← المادة ← القائمة. القائمة: ملفات الفروض والاختبارات (نفس /exams في الموقع،
 * بلا البكالوريا الرسمية)، ونسخها التفاعلية في PLAY للفصل نفسه حين تكون السنة سنةَ التلميذ.
 * وصفحة الموضوع عامة لكل ملف (فرض، اختبار، بكالوريا): الموضوع والحلّ و«العبه تفاعليًا» إن وُجد.
 *
 * ثلاثة مصادر تُعدّ معًا في كل خطوة:
 *  1. ملفات المكتبة (فرض/اختبار بفصل مسجّل).
 *  2. دروس المنصة العامة التي عنوانها فرض أو اختبار مع فصله، مثل «سلسلة الفروض والاختبارات — السنة الثالثة ثانوي
 *     — لغات أجنبية — الفصل الأول» (سلاسل المالك): الفصل والسنة من الحقول أو من العنوان، والمادة العربية إن لم تُحدَّد.
 *  3. نسخ PLAY التفاعلية (فرض/اختبار) لسنة التلميذ في PLAY وشعبته.
 */
import { and, asc, eq, ilike, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { content, contentSources, examDocuments, levels, playExamSets, resources, streams, students, subjects } from '@/server/db/schema'
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

const TERM_WORDS: Record<string, number> = { 'الأول': 1, 'الاول': 1, '1': 1, 'الثاني': 2, '2': 2, 'الثالث': 3, '3': 3 }

/** «الفصل الأول» ← 1 (من العنوان؛ لا يُخمَّن غير ذلك) */
export function termOfTitle(title: string): number | null {
  const m = /الفصل\s*(الأول|الاول|الثاني|الثالث|[123])(?![\p{L}])/u.exec(title)
  return m ? (TERM_WORDS[m[1]!] ?? null) : null
}

const LEVEL_WORDS: [RegExp, string][] = [
  [/الأولى\s+ثانوي|الاولى\s+ثانوي/, '1AS'],
  [/الثانية\s+ثانوي/, '2AS'],
  [/الثالثة\s+ثانوي/, '3AS'],
  [/الأولى\s+متوسط|الاولى\s+متوسط/, '1AM'],
  [/الثانية\s+متوسط/, '2AM'],
  [/الثالثة\s+متوسط/, '3AM'],
  [/الرابعة\s+متوسط/, '4AM']
]

/** «السنة الثالثة ثانوي» ← 3AS */
export function levelCodeOfTitle(title: string): string | null {
  return LEVEL_WORDS.find(([re]) => re.test(title))?.[1] ?? null
}

interface Extra {
  term: number
  levelId: string
  subjectId: string
  /** درس المنصة (يظهر في القائمة) أو نسخة PLAY (تظهر في «العبه تفاعليًا») */
  kind: 'lesson' | 'play'
  lesson?: { id: string; title: string }
}

/** المصدران 2 و3: دروس الفروض العامة ونسخ PLAY، بفصلها وسنتها ومادتها */
async function extraEntries(db: Db, actor: Actor | null): Promise<Extra[]> {
  const levelRows = await db.select({ id: levels.id, code: levels.code }).from(levels)
  const levelByCode = new Map(levelRows.map((l) => [l.code, l.id]))
  const subjectRows = await db.select({ id: subjects.id, code: subjects.code }).from(subjects)
  const subjectByCode = new Map(subjectRows.map((x) => [x.code, x.id]))
  const arabic = subjectByCode.get('ARABIC') ?? null
  const out: Extra[] = []

  const lessons = await db
    .select({ id: content.id, title: content.title, levelId: content.levelId, subjectId: content.subjectId })
    .from(content)
    .where(
      and(
        eq(content.visibility, 'PUBLIC'),
        isNotNull(content.publishedAt),
        isNull(content.deletedAt),
        or(isNotNull(content.fileId), isNotNull(content.externalUrl)),
        or(ilike(content.title, '%فرض%'), ilike(content.title, '%فروض%'), ilike(content.title, '%اختبار%'))
      )
    )
    .limit(500)
  for (const l of lessons) {
    const term = termOfTitle(l.title)
    const levelId = l.levelId ?? levelByCode.get(levelCodeOfTitle(l.title) ?? '') ?? null
    const subjectId = l.subjectId ?? arabic
    if (term && levelId && subjectId) out.push({ term, levelId, subjectId, kind: 'lesson', lesson: { id: l.id, title: l.title } })
  }

  if (actor?.studentId) {
    const profile = await getPlayProfile(db, actor).catch(() => null)
    if (profile?.gradeCode) {
      const levelId = levelByCode.get(profile.gradeCode)
      const sets = await db
        .select({ term: playExamSets.term, subjectCode: playExamSets.subjectCode, streamCodes: playExamSets.streamCodes, status: playExamSets.status, publishable: playExamSets.publishable })
        .from(playExamSets)
        .where(and(eq(playExamSets.gradeCode, profile.gradeCode), inArray(playExamSets.kind, ['DEVOIR', 'TEST']), isNotNull(playExamSets.term)))
      for (const set of sets) {
        if (!isServableSet(set) || (set.streamCodes.length && profile.streamCode && !set.streamCodes.includes(profile.streamCode))) continue
        const subjectId = subjectByCode.get(PLAY_TO_CURRICULUM_SUBJECT[set.subjectCode]?.[0] ?? '')
        if (levelId && subjectId && set.term) out.push({ term: set.term, levelId, subjectId, kind: 'play' })
      }
    }
  }
  return out
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
  const extra = await extraEntries(db, actor)
  const extraFor = (f: Partial<Pick<Extra, 'term' | 'levelId' | 'subjectId'>>) =>
    extra.filter((e) => (!f.term || e.term === f.term) && (!f.levelId || e.levelId === f.levelId) && (!f.subjectId || e.subjectId === f.subjectId))
  for (const l of levelRows) l.n += extraFor({ term: term ?? undefined, levelId: l.id }).length
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
  const terms = [1, 2, 3].map((t) => ({ term: t, count: (termRows.find((r) => r.term === t)?.n ?? 0) + extraFor({ term: t, levelId: termLevel ?? undefined }).length }))

  let subjectList: { id: string; name: string; count: number }[] = []
  if (term && levelId) {
    const rows = await db
      .select({ id: subjects.id, name: subjects.nameAr, sort: subjects.sortOrder, n: sql<number>`count(*)::int` })
      .from(resources)
      .innerJoin(subjects, eq(subjects.id, resources.subjectId))
      .where(base([eq(resources.schoolTerm, term), eq(resources.levelId, levelId)]))
      .groupBy(subjects.id, subjects.nameAr, subjects.sortOrder)
      .orderBy(asc(subjects.sortOrder))
    const counts = new Map(rows.map((r) => [r.id, { id: r.id, name: r.name, sort: r.sort, count: r.n }]))
    const more = extraFor({ term, levelId })
    const missing = [...new Set(more.map((e) => e.subjectId))].filter((id) => !counts.has(id))
    if (missing.length) {
      for (const x of await db.select({ id: subjects.id, name: subjects.nameAr, sort: subjects.sortOrder }).from(subjects).where(inArray(subjects.id, missing))) counts.set(x.id, { ...x, count: 0 })
    }
    for (const e of more) {
      const c = counts.get(e.subjectId)
      if (c) c.count += 1
    }
    subjectList = [...counts.values()].filter((c) => c.count > 0).sort((a, b) => a.sort - b.sort).map(({ id, name, count }) => ({ id, name, count }))
  }

  let papers: { id: string; title: string; typeLabel: string; year: number | null; hasSolution: boolean; hasFile: boolean }[] = []
  let nextCursor: string | null = null
  let interactive: { id: string; title: string; kind: string; year: number | null }[] = []
  if (term && levelId && subjectId) {
    const list = await listResourceCards(db, { levelId, subjectId, streamIds: family, term, excludeBac: true, studentId, types: TEST_TYPES }, { cursor: q.cursor ?? null, limit: PAGE })
    papers = list.items.map((it) => ({ id: it.id, title: it.title, typeLabel: it.typeLabel, year: it.year, hasSolution: it.hasSolution, hasFile: it.hasFile }))
    // سلاسل المنصة أولًا (تُفتح من صفحة الموضوع نفسها)
    if (!q.cursor) {
      const series = extraFor({ term, levelId, subjectId }).filter((e) => e.kind === 'lesson' && e.lesson)
      papers = [...series.map((e) => ({ id: e.lesson!.id, title: e.lesson!.title, typeLabel: 'سلسلة', year: null, hasSolution: false, hasFile: true })), ...papers]
    }
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
  if (!x) return lessonPaper(db, id)
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

/** سلسلة فروض منشورة درسًا عامًا: نفس صفحة الموضوع (الملف عندنا برابط موقّع، أو رابطه https) */
async function lessonPaper(db: Db, id: string) {
  const [l] = await db
    .select({ id: content.id, title: content.title, fileId: content.fileId, externalUrl: content.externalUrl, subjectName: subjects.nameAr, streamName: streams.nameAr, publishedAt: content.publishedAt })
    .from(content)
    .leftJoin(subjects, eq(subjects.id, content.subjectId))
    .leftJoin(streams, eq(streams.id, content.streamId))
    .where(and(eq(content.id, id), eq(content.visibility, 'PUBLIC'), isNotNull(content.publishedAt), isNull(content.deletedAt)))
    .limit(1)
  if (!l) throw new AppError('NOT_FOUND')
  return {
    id: l.id,
    title: l.title,
    year: null,
    session: null,
    term: termOfTitle(l.title),
    topic: null,
    official: false,
    subjectName: l.subjectName,
    streamName: l.streamName,
    source: { name: 'مدرسة', attribution: null },
    paper: linkOf({ fileId: l.fileId, url: l.externalUrl }),
    solution: null,
    play: null
  }
}
