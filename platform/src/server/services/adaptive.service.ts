/**
 * التعلّم التكيّفي (Exam Builder — المرحلة 8).
 * كل إجابة تدريب تُحدّث تقدّم التلميذ بالدرس (`student_node_progress`): متوسط متحرّك 0–100،
 * سلسلة الصواب، وأعلى صعوبة أتقنها. من هذا التقدّم: الصعوبة المناسبة للجلسة التالية،
 * والتوصيات (راجع / جديد / ارفع الصعوبة)، وما يراه الأستاذ عن تلاميذه.
 */
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { bankQuestions, curriculumNodes, groupStudents, studentNodeProgress, students, subjects, type StudentNodeProgressRow } from '@/server/db/schema'
import { assertRole, type Actor } from '@/server/lib/actor'
import { AppError, assertUuid } from '@/server/lib/errors'

/** وزن الإجابة الأحدث في المتوسط المتحرّك */
const NEW_WEIGHT = 0.3
export const WEAK = 60
export const STRONG = 80
/** تحتاج هذا العدد من المحاولات قبل الحكم */
const MIN_ATTEMPTS = 3

/** يُستدعى بعد تصحيح كل إجابة (داخل خدمة التدريب) */
export async function recordNodeResult(db: Db, input: { studentId: string; subjectId: string; curriculumNodeId: string; isCorrect: boolean; difficulty: number }): Promise<StudentNodeProgressRow> {
  const pct = input.isCorrect ? 100 : 0
  const [existing] = await db.select().from(studentNodeProgress).where(and(eq(studentNodeProgress.studentId, input.studentId), eq(studentNodeProgress.curriculumNodeId, input.curriculumNodeId))).limit(1)
  const prev = existing ? Number(existing.score) : null
  const score = Math.round((prev === null ? pct : prev * (1 - NEW_WEIGHT) + pct * NEW_WEIGHT) * 100) / 100
  const streak = input.isCorrect ? (existing?.streak ?? 0) + 1 : 0
  const mastered = input.isCorrect ? Math.max(existing?.masteredDifficulty ?? 0, input.difficulty) : (existing?.masteredDifficulty ?? 0)
  if (existing) {
    const [row] = await db
      .update(studentNodeProgress)
      .set({ attempts: existing.attempts + 1, correct: existing.correct + (input.isCorrect ? 1 : 0), score: String(score), streak, masteredDifficulty: mastered, lastAt: new Date(), updatedAt: new Date() })
      .where(eq(studentNodeProgress.id, existing.id))
      .returning()
    return row!
  }
  const [row] = await db
    .insert(studentNodeProgress)
    .values({ studentId: input.studentId, subjectId: input.subjectId, curriculumNodeId: input.curriculumNodeId, attempts: 1, correct: input.isCorrect ? 1 : 0, score: String(score), streak, masteredDifficulty: mastered })
    .returning()
  return row!
}

/**
 * الصعوبات المناسبة لدرس بحسب تقدّمه: ضعيف ← سهل/متوسط، متوسط ← متوسط/صعب، قوي ← صعب/صعب جداً،
 * ولا شيء معروف ← سهل/متوسط. ترجع مجموعة مسموحة (ليس قيمة واحدة) حتى لا يفرغ الاختيار.
 */
export function targetDifficulties(progress: Pick<StudentNodeProgressRow, 'score' | 'attempts' | 'streak'> | null): number[] {
  if (!progress || progress.attempts < MIN_ATTEMPTS) return [1, 2]
  const s = Number(progress.score)
  if (s < WEAK) return [1, 2]
  if (s < STRONG) return progress.streak >= 3 ? [2, 3] : [2]
  return [3, 4]
}

export interface NodeProgressItem {
  nodeId: string
  title: string
  subjectId: string
  subjectName: string
  attempts: number
  correct: number
  score: number
  streak: number
  masteredDifficulty: number
  lastAt: Date
}

export async function nodeProgress(db: Db, studentId: string, subjectId?: string | null): Promise<NodeProgressItem[]> {
  const rows = await db
    .select({ nodeId: studentNodeProgress.curriculumNodeId, title: curriculumNodes.title, subjectId: studentNodeProgress.subjectId, subjectName: subjects.nameAr, attempts: studentNodeProgress.attempts, correct: studentNodeProgress.correct, score: studentNodeProgress.score, streak: studentNodeProgress.streak, masteredDifficulty: studentNodeProgress.masteredDifficulty, lastAt: studentNodeProgress.lastAt })
    .from(studentNodeProgress)
    .innerJoin(curriculumNodes, eq(curriculumNodes.id, studentNodeProgress.curriculumNodeId))
    .innerJoin(subjects, eq(subjects.id, studentNodeProgress.subjectId))
    .where(and(eq(studentNodeProgress.studentId, studentId), subjectId ? eq(studentNodeProgress.subjectId, subjectId) : undefined))
    .orderBy(asc(studentNodeProgress.score), desc(studentNodeProgress.lastAt))
  return rows.map((r) => ({ ...r, score: Number(r.score) }))
}

/** تقدّم تلميذ لفاعل مخوَّل: التلميذ نفسه، أو أستاذ له في أحد أفواجه، أو المشرف */
export async function nodeProgressFor(db: Db, actor: Actor, studentId: string): Promise<NodeProgressItem[]> {
  assertUuid(studentId, 'NOT_FOUND')
  if (actor.role === 'STUDENT') {
    if (actor.studentId !== studentId) throw new AppError('FORBIDDEN')
  } else {
    assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
    if (actor.role === 'TEACHER') {
      const [m] = await db
        .select({ id: groupStudents.id })
        .from(groupStudents)
        .where(and(eq(groupStudents.studentId, studentId), eq(groupStudents.workspaceId, actor.workspaceId ?? '')))
        .limit(1)
      if (!m) throw new AppError('NOT_FOUND')
    }
  }
  return nodeProgress(db, studentId)
}

export type RecommendationKind = 'REVIEW' | 'NEW' | 'LEVEL_UP'

export interface Recommendation {
  kind: RecommendationKind
  nodeId: string
  title: string
  subjectId: string
  subjectName: string
  /** الصعوبة المقترحة للجلسة التالية */
  difficulty: number | null
  score: number | null
  attempts: number
  questions: number
}

/**
 * توصيات التلميذ: راجع (ضعيف بعد ≥3 محاولات)، جديد (دروس فيها أسئلة ولم يلمسها)، ارفع الصعوبة (قوي).
 * كل توصية تحمل ما يلزم لبدء جلسة مباشرة.
 */
export async function recommendations(db: Db, actor: Actor, limit = 6): Promise<Recommendation[]> {
  if (actor.role !== 'STUDENT' || !actor.studentId) throw new AppError('FORBIDDEN')
  const studentId = actor.studentId
  const [s] = await db.select({ levelId: students.levelId, streamId: students.streamId }).from(students).where(eq(students.id, studentId)).limit(1)
  const progress = await nodeProgress(db, studentId)
  // الدروس التي فيها أسئلة تدريب (بمستوى التلميذ) مع عددها
  const available = await db
    .select({ nodeId: curriculumNodes.id, title: curriculumNodes.title, subjectId: bankQuestions.subjectId, subjectName: subjects.nameAr, questions: sql<number>`count(*)::int`, maxDifficulty: sql<number>`max(${bankQuestions.difficulty})::int` })
    .from(bankQuestions)
    .innerJoin(curriculumNodes, eq(curriculumNodes.id, bankQuestions.curriculumNodeId))
    .innerJoin(subjects, eq(subjects.id, bankQuestions.subjectId))
    .where(
      and(
        isNull(bankQuestions.deletedAt),
        isNull(bankQuestions.parentId),
        eq(bankQuestions.status, 'PUBLISHED'),
        eq(bankQuestions.visibility, 'PUBLIC'),
        inArray(bankQuestions.type, ['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER', 'FILL_BLANK', 'MATCHING']),
        s?.levelId ? sql`(${bankQuestions.levelId} = ${s.levelId} or ${bankQuestions.levelId} is null)` : undefined,
        s?.streamId ? sql`(${bankQuestions.streamId} = ${s.streamId} or ${bankQuestions.streamId} is null)` : undefined
      )
    )
    .groupBy(curriculumNodes.id, curriculumNodes.title, curriculumNodes.sortOrder, bankQuestions.subjectId, subjects.nameAr)
    .orderBy(asc(curriculumNodes.sortOrder))
  const byNode = new Map(available.map((a) => [a.nodeId, a]))
  const out: Recommendation[] = []
  for (const p of progress) {
    const a = byNode.get(p.nodeId)
    if (!a || p.attempts < MIN_ATTEMPTS) continue
    if (p.score < WEAK) out.push({ kind: 'REVIEW', nodeId: p.nodeId, title: p.title, subjectId: p.subjectId, subjectName: p.subjectName, difficulty: 1, score: p.score, attempts: p.attempts, questions: a.questions })
    else if (p.score >= STRONG && p.masteredDifficulty < a.maxDifficulty) out.push({ kind: 'LEVEL_UP', nodeId: p.nodeId, title: p.title, subjectId: p.subjectId, subjectName: p.subjectName, difficulty: Math.min(4, p.masteredDifficulty + 1), score: p.score, attempts: p.attempts, questions: a.questions })
  }
  const seen = new Set(progress.map((p) => p.nodeId))
  for (const a of available) if (!seen.has(a.nodeId) && a.subjectId) out.push({ kind: 'NEW', nodeId: a.nodeId, title: a.title, subjectId: a.subjectId, subjectName: a.subjectName, difficulty: null, score: null, attempts: 0, questions: a.questions })
  const order: Record<RecommendationKind, number> = { REVIEW: 0, NEW: 1, LEVEL_UP: 2 }
  return out.sort((x, y) => order[x.kind] - order[y.kind] || (x.score ?? 0) - (y.score ?? 0)).slice(0, limit)
}

export interface GroupNodeWeakness {
  nodeId: string
  title: string
  subjectName: string
  /** تلاميذ دون العتبة / من قيّموا */
  weak: number
  assessed: number
  average: number
  students: string[]
}

/** للأستاذ: أضعف الدروس في فوج (من تدريب تلاميذه الذاتي) — لتوجيه الحصة أو امتحان الدعم */
export async function groupNodeWeakness(db: Db, actor: Actor, groupId: string, threshold = WEAK): Promise<GroupNodeWeakness[]> {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  assertUuid(groupId, 'NOT_FOUND')
  const members = await db
    .select({ studentId: groupStudents.studentId })
    .from(groupStudents)
    .where(and(eq(groupStudents.groupId, groupId), actor.workspaceId ? eq(groupStudents.workspaceId, actor.workspaceId) : undefined, eq(groupStudents.status, 'ACTIVE')))
  if (members.length === 0) return []
  const rows = await db
    .select({ nodeId: studentNodeProgress.curriculumNodeId, title: curriculumNodes.title, subjectName: subjects.nameAr, studentId: studentNodeProgress.studentId, score: studentNodeProgress.score, attempts: studentNodeProgress.attempts, name: sql<string>`(select p.full_name from profiles p join students st on st.user_id = p.user_id where st.id = ${studentNodeProgress.studentId})` })
    .from(studentNodeProgress)
    .innerJoin(curriculumNodes, eq(curriculumNodes.id, studentNodeProgress.curriculumNodeId))
    .innerJoin(subjects, eq(subjects.id, studentNodeProgress.subjectId))
    .where(and(inArray(studentNodeProgress.studentId, members.map((m) => m.studentId)), sql`${studentNodeProgress.attempts} >= ${MIN_ATTEMPTS}`))
  const map = new Map<string, GroupNodeWeakness & { sum: number }>()
  for (const r of rows) {
    const e = map.get(r.nodeId) ?? { nodeId: r.nodeId, title: r.title, subjectName: r.subjectName, weak: 0, assessed: 0, average: 0, students: [], sum: 0 }
    e.assessed++
    e.sum += Number(r.score)
    if (Number(r.score) < threshold) {
      e.weak++
      e.students.push(r.name ?? '—')
    }
    map.set(r.nodeId, e)
  }
  return [...map.values()]
    .map(({ sum, ...e }) => ({ ...e, average: Math.round(sum / e.assessed) }))
    .filter((e) => e.weak > 0)
    .sort((a, b) => b.weak / b.assessed - a.weak / a.assessed || a.average - b.average)
    .slice(0, 10)
}
