/**
 * MADRASADZ PLAY — خدمة الطالب: الملف الدراسي، بدء الجلسات، التصحيح على الخادم، XP، الذاكرة المتباعدة، الشارات.
 * لا تثق بأي حساب نقاط من المتصفح؛ مفاتيح الإجابة لا تغادر الخادم قبل التصحيح.
 */
import { and, asc, desc, eq, inArray, isNull, lte, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import {
  appSettings,
  playAnswers,
  playLessonProgress,
  playLessons,
  playQuestionMemory,
  playQuestionReports,
  playQuestions,
  playSessions,
  playStudentBadges,
  playStudentStats,
  playSubjectStats,
  playSubjects,
  levels,
  streams,
  students
} from '@/server/db/schema'
import { assertRole, studentIdOf, type Actor } from '@/server/lib/actor'
import { AppError, assertUuid } from '@/server/lib/errors'
import {
  CHALLENGE_SIZES,
  DEFAULT_PLAY_RULES,
  LEITNER_INTERVALS_DAYS,
  LEITNER_MASTERED_BOX,
  PLAY_BADGES,
  PLAY_GRADES,
  PLAY_SETTINGS_KEY,
  TIMED_SECONDS_PER_QUESTION,
  gradeByCode,
  type PlayChallengeType,
  type PlayDifficulty,
  type PlayReportReason,
  type PlayRules
} from '@/server/play/constants'
import { correctAnswerText, gradePlayAnswer, hashToSeed, seededRandom, shufflePayloadForSession } from '@/server/play/engine'
import type { PlayPublicPayload, PlayStudentAnswer } from '@/server/play/question-types'

/* --------------------------------- القواعد -------------------------------- */

export async function getPlayRules(db: Db): Promise<PlayRules> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, PLAY_SETTINGS_KEY)).limit(1)
  const v = (row?.value as Partial<PlayRules> | undefined) ?? {}
  return {
    xp: { ...DEFAULT_PLAY_RULES.xp, ...(v.xp ?? {}) },
    levels: v.levels?.length ? v.levels : DEFAULT_PLAY_RULES.levels,
    mastery: { ...DEFAULT_PLAY_RULES.mastery, ...(v.mastery ?? {}) },
    servableStatuses: v.servableStatuses?.length ? v.servableStatuses : DEFAULT_PLAY_RULES.servableStatuses,
    publicLeaderboard: Boolean(v.publicLeaderboard)
  }
}

export function levelFor(rules: PlayRules, xp: number): { index: number; title: string; minXp: number; nextMinXp: number | null; progressPct: number } {
  let index = 0
  for (let i = 0; i < rules.levels.length; i++) if (xp >= rules.levels[i]!.minXp) index = i
  const cur = rules.levels[index]!
  const next = rules.levels[index + 1] ?? null
  const progressPct = next ? Math.min(100, Math.round(((xp - cur.minXp) / Math.max(1, next.minXp - cur.minXp)) * 100)) : 100
  return { index, title: cur.title, minXp: cur.minXp, nextMinXp: next?.minXp ?? null, progressPct }
}

/* ------------------------------ الملف الدراسي ------------------------------ */

async function ensureStats(db: Db, studentId: string) {
  const [row] = await db.select().from(playStudentStats).where(eq(playStudentStats.studentId, studentId)).limit(1)
  if (row) return row
  const [created] = await db.insert(playStudentStats).values({ studentId }).onConflictDoNothing().returning()
  if (created) return created
  const [again] = await db.select().from(playStudentStats).where(eq(playStudentStats.studentId, studentId)).limit(1)
  if (!again) throw new AppError('INTERNAL')
  return again
}

export async function getPlayProfile(db: Db, actor: Actor) {
  const studentId = studentIdOf(actor)
  const stats = await ensureStats(db, studentId)
  if (!stats.gradeCode) {
    // محاولة الاستنتاج من ملف الحساب (level/stream)
    const [s] = await db.select({ levelId: students.levelId, streamId: students.streamId }).from(students).where(eq(students.id, studentId)).limit(1)
    if (s?.levelId) {
      const [lv] = await db.select({ code: levels.code }).from(levels).where(eq(levels.id, s.levelId)).limit(1)
      const [st] = s.streamId ? await db.select({ code: streams.code }).from(streams).where(eq(streams.id, s.streamId)).limit(1) : [null]
      const grade = lv ? gradeByCode(lv.code) : undefined
      if (grade) {
        const streamCode = st && grade.streams.includes(st.code) ? st.code : null
        if (grade.streams.length === 0 || streamCode) {
          await db.update(playStudentStats).set({ gradeCode: grade.code, streamCode }).where(eq(playStudentStats.studentId, studentId))
          return { ...stats, gradeCode: grade.code, streamCode }
        }
      }
    }
  }
  return stats
}

export async function setPlayProfile(db: Db, actor: Actor, input: { gradeCode: string; streamCode: string | null }) {
  const studentId = studentIdOf(actor)
  const grade = gradeByCode(input.gradeCode)
  if (!grade || !grade.isActive) throw new AppError('VALIDATION', { field: 'gradeCode' })
  const streamCode = grade.streams.length ? input.streamCode : null
  if (grade.streams.length && (!streamCode || !grade.streams.includes(streamCode))) throw new AppError('VALIDATION', { field: 'streamCode' })
  await ensureStats(db, studentId)
  await db.update(playStudentStats).set({ gradeCode: grade.code, streamCode }).where(eq(playStudentStats.studentId, studentId))
  return { gradeCode: grade.code, streamCode }
}

export async function setPlayPrefs(db: Db, actor: Actor, prefs: { sound?: boolean; motion?: boolean }) {
  const studentId = studentIdOf(actor)
  const stats = await ensureStats(db, studentId)
  const next = { ...stats.prefs, ...prefs }
  await db.update(playStudentStats).set({ prefs: next }).where(eq(playStudentStats.studentId, studentId))
  return next
}

/* -------------------------------- المنهاج -------------------------------- */

function streamFilter(streamCode: string | null) {
  // أسئلة/دروس عامة (مصفوفة فارغة) أو تحوي شعبة الطالب
  return streamCode ? sql`(cardinality(${playLessons.streamCodes}) = 0 OR ${streamCode} = ANY(${playLessons.streamCodes}))` : sql`TRUE`
}

function questionStreamFilter(streamCode: string | null) {
  return streamCode ? sql`(cardinality(${playQuestions.streamCodes}) = 0 OR ${streamCode} = ANY(${playQuestions.streamCodes}))` : sql`TRUE`
}

function servableFilter(rules: PlayRules) {
  return and(isNull(playQuestions.deletedAt), eq(playQuestions.isSuspended, false), inArray(playQuestions.reviewStatus, rules.servableStatuses))
}

/** المواد المتاحة للطالب في سنته/شعبته مع عدد الأسئلة المتاحة */
export async function listSubjectsFor(db: Db, gradeCode: string, streamCode: string | null) {
  const rules = await getPlayRules(db)
  const rows = await db
    .select({
      code: playSubjects.code,
      nameAr: playSubjects.nameAr,
      color: playSubjects.color,
      icon: playSubjects.icon,
      language: playSubjects.language,
      sortOrder: playSubjects.sortOrder,
      lessons: sql<number>`count(distinct ${playLessons.id})`.mapWith(Number),
      questions: sql<number>`count(distinct ${playQuestions.id})`.mapWith(Number)
    })
    .from(playSubjects)
    .innerJoin(playLessons, and(eq(playLessons.subjectCode, playSubjects.code), eq(playLessons.gradeCode, gradeCode), eq(playLessons.isActive, true), streamFilter(streamCode)))
    .leftJoin(playQuestions, and(eq(playQuestions.lessonId, playLessons.id), servableFilter(rules), questionStreamFilter(streamCode)))
    .where(eq(playSubjects.isActive, true))
    .groupBy(playSubjects.code)
    .orderBy(asc(playSubjects.sortOrder))
  return rows
}

/** الوحدات والدروس لمادة (مع عدد الأسئلة وتقدم الطالب إن وُجد) */
export async function listLessonsFor(db: Db, gradeCode: string, streamCode: string | null, subjectCode: string, studentId?: string) {
  const rules = await getPlayRules(db)
  const rows = await db
    .select({
      id: playLessons.id,
      unitCode: playLessons.unitCode,
      unitName: playLessons.unitName,
      unitOrder: playLessons.unitOrder,
      lessonCode: playLessons.lessonCode,
      lessonName: playLessons.lessonName,
      lessonOrder: playLessons.lessonOrder,
      objective: playLessons.objective,
      verified: playLessons.verified,
      questions: sql<number>`count(${playQuestions.id})`.mapWith(Number)
    })
    .from(playLessons)
    .leftJoin(playQuestions, and(eq(playQuestions.lessonId, playLessons.id), servableFilter(rules), questionStreamFilter(streamCode)))
    .where(and(eq(playLessons.gradeCode, gradeCode), eq(playLessons.subjectCode, subjectCode), eq(playLessons.isActive, true), streamFilter(streamCode)))
    .groupBy(playLessons.id)
    .orderBy(asc(playLessons.unitOrder), asc(playLessons.lessonOrder))
  const progress = studentId && rows.length ? await db.select().from(playLessonProgress).where(and(eq(playLessonProgress.studentId, studentId), inArray(playLessonProgress.lessonId, rows.map((r) => r.id)))) : []
  const pmap = new Map(progress.map((p) => [p.lessonId, p]))
  const units = new Map<string, { unitCode: string; unitName: string; unitOrder: number; lessons: (typeof rows[number] & { masteryPct: number; mastered: boolean; answered: number })[] }>()
  for (const r of rows) {
    const u = units.get(r.unitCode) ?? { unitCode: r.unitCode, unitName: r.unitName, unitOrder: r.unitOrder, lessons: [] }
    const p = pmap.get(r.id)
    u.lessons.push({ ...r, masteryPct: p?.masteryPct ?? 0, mastered: !!p?.masteredAt, answered: p?.answered ?? 0 })
    units.set(r.unitCode, u)
  }
  return [...units.values()].sort((a, b) => a.unitOrder - b.unitOrder)
}

/* ------------------------------ اختيار الأسئلة ------------------------------ */

interface Candidate {
  id: string
  lessonId: string
  difficulty: PlayDifficulty
  weight: number
}

const DIFFICULTY_MIX: Record<PlayDifficulty, number> = { EASY: 0.3, MEDIUM: 0.45, HARD: 0.25 }

/** اختيار متوازن: صعوبة حسب النسب، توزيع على الدروس، تقليل المتقن وإعادة الخاطئ المستحق */
export function pickBalanced(cands: Candidate[], size: number, seed: number, mix: Record<PlayDifficulty, number> = DIFFICULTY_MIX): string[] {
  const rnd = seededRandom(seed)
  const pool = [...cands]
  const picked: Candidate[] = []
  const lessonCount = new Map<string, number>()
  const want: Record<PlayDifficulty, number> = {
    EASY: Math.round(size * mix.EASY),
    MEDIUM: Math.round(size * mix.MEDIUM),
    HARD: 0
  }
  want.HARD = Math.max(0, size - want.EASY - want.MEDIUM)
  const takeOne = (filter: (c: Candidate) => boolean): boolean => {
    const subset = pool.filter(filter)
    if (subset.length === 0) return false
    // ترجيح معاكس لعدد ما اختير من الدرس نفسه (توزيع على الدروس)
    const weights = subset.map((c) => c.weight / (1 + (lessonCount.get(c.lessonId) ?? 0)))
    const total = weights.reduce((a, b) => a + b, 0)
    let r = rnd() * total
    let chosen = subset[subset.length - 1]!
    for (let i = 0; i < subset.length; i++) {
      r -= weights[i]!
      if (r <= 0) {
        chosen = subset[i]!
        break
      }
    }
    picked.push(chosen)
    lessonCount.set(chosen.lessonId, (lessonCount.get(chosen.lessonId) ?? 0) + 1)
    pool.splice(pool.indexOf(chosen), 1)
    return true
  }
  for (const d of ['EASY', 'MEDIUM', 'HARD'] as PlayDifficulty[]) {
    for (let i = 0; i < want[d]; i++) if (!takeOne((c) => c.difficulty === d)) break
  }
  while (picked.length < size && takeOne(() => true)) {
    /* إكمال من أي صعوبة */
  }
  // ترتيب العرض: سهل → متوسط → صعب مع خلط داخلي خفيف
  const order: Record<PlayDifficulty, number> = { EASY: 0, MEDIUM: 1, HARD: 2 }
  return picked
    .map((c, i) => ({ c, k: order[c.difficulty] + rnd() * 0.5 + i * 0.0001 }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.c.id)
}

export interface StartSessionInput {
  challengeType: PlayChallengeType
  subjectCode?: string | null
  unitCode?: string | null
  lessonId?: string | null
  timed?: boolean
}

export async function startPlaySession(db: Db, actor: Actor, input: StartSessionInput, now: Date = new Date()) {
  const studentId = studentIdOf(actor)
  const profile = await getPlayProfile(db, actor)
  if (!profile.gradeCode) throw new AppError('PLAY_PROFILE_REQUIRED')
  const grade = gradeByCode(profile.gradeCode)
  if (!grade) throw new AppError('PLAY_PROFILE_REQUIRED')
  const streamCode = profile.streamCode
  const rules = await getPlayRules(db)
  const size = CHALLENGE_SIZES[input.challengeType]
  if (input.lessonId) assertUuid(input.lessonId, 'PLAY_LESSON_NOT_FOUND')

  // إغلاق أي جلسة نشطة قديمة للطالب (جلسة واحدة نشطة)
  await db
    .update(playSessions)
    .set({ status: 'ABANDONED' })
    .where(and(eq(playSessions.studentId, studentId), eq(playSessions.status, 'ACTIVE')))

  const conds = [servableFilter(rules), eq(playQuestions.gradeCode, grade.code), questionStreamFilter(streamCode)]
  if (input.challengeType === 'BAC') conds.push(eq(playQuestions.gradeCode, '3AS'))
  if (input.challengeType === 'HARD') conds.push(eq(playQuestions.difficulty, 'HARD'))
  if (input.subjectCode) conds.push(eq(playQuestions.subjectCode, input.subjectCode))
  if (input.unitCode) conds.push(eq(playQuestions.unitCode, input.unitCode))
  if (input.lessonId) conds.push(eq(playQuestions.lessonId, input.lessonId))

  let rows: { id: string; lessonId: string; difficulty: string }[]
  if (input.challengeType === 'MISTAKES') {
    rows = await db
      .select({ id: playQuestions.id, lessonId: playQuestions.lessonId, difficulty: playQuestions.difficulty })
      .from(playQuestionMemory)
      .innerJoin(playQuestions, eq(playQuestions.id, playQuestionMemory.questionId))
      .where(and(eq(playQuestionMemory.studentId, studentId), lte(playQuestionMemory.box, 1), lte(playQuestionMemory.dueAt, now), ...conds))
      .orderBy(asc(playQuestionMemory.dueAt))
      .limit(400)
  } else {
    rows = await db
      .select({ id: playQuestions.id, lessonId: playQuestions.lessonId, difficulty: playQuestions.difficulty })
      .from(playQuestions)
      .where(and(...conds))
      .limit(1500)
  }
  if (rows.length === 0) throw new AppError('PLAY_NO_QUESTIONS')

  const memory = await db
    .select({ questionId: playQuestionMemory.questionId, box: playQuestionMemory.box, dueAt: playQuestionMemory.dueAt, lastResult: playQuestionMemory.lastResult, lastSeenAt: playQuestionMemory.lastSeenAt })
    .from(playQuestionMemory)
    .where(and(eq(playQuestionMemory.studentId, studentId), inArray(playQuestionMemory.questionId, rows.map((r) => r.id))))
  const mem = new Map(memory.map((m) => [m.questionId, m]))
  const dayMs = 86400000
  const cands: Candidate[] = rows.map((r) => {
    const m = mem.get(r.id)
    let w = 1
    if (!m) w = 1.5
    else {
      const due = m.dueAt.getTime() <= now.getTime()
      if (m.lastResult === false && due) w = 2.2
      else if (m.box >= LEITNER_MASTERED_BOX && !due) w = 0.12
      else if (!due) w = 0.4
      if (m.lastSeenAt && now.getTime() - m.lastSeenAt.getTime() < dayMs) w *= 0.3
    }
    return { id: r.id, lessonId: r.lessonId, difficulty: r.difficulty as PlayDifficulty, weight: w }
  })
  const seed = hashToSeed(studentId, String(now.getTime()), input.challengeType)
  const mix = input.challengeType === 'HARD' ? { EASY: 0, MEDIUM: 0, HARD: 1 } : input.challengeType === 'MISTAKES' ? { EASY: 0.33, MEDIUM: 0.34, HARD: 0.33 } : DIFFICULTY_MIX
  const ids = pickBalanced(cands, Math.min(size, cands.length), seed, mix)
  if (ids.length === 0) throw new AppError('PLAY_NO_QUESTIONS')

  const timed = Boolean(input.timed)
  const [session] = await db
    .insert(playSessions)
    .values({
      studentId,
      gradeCode: grade.code,
      streamCode,
      subjectCode: input.subjectCode ?? null,
      unitCode: input.unitCode ?? null,
      lessonId: input.lessonId ?? null,
      challengeType: input.challengeType,
      timed,
      questionIds: ids,
      seed,
      startedAt: now,
      expiresAt: timed ? new Date(now.getTime() + ids.length * TIMED_SECONDS_PER_QUESTION * 1000) : null
    })
    .returning()
  if (!session) throw new AppError('INTERNAL')
  await db.update(playQuestions).set({ timesServed: sql`${playQuestions.timesServed} + 1` }).where(inArray(playQuestions.id, ids))
  return session
}

/* ------------------------------- عرض الجلسة ------------------------------- */

export interface SessionQuestionView {
  id: string
  position: number
  type: string
  difficulty: string
  subjectCode: string
  lessonName: string
  language: string
  questionText: string
  payload: PlayPublicPayload
  /** النتيجة إن كانت مُجابة (لاستئناف الجلسة) */
  answered: { isCorrect: boolean; correctText: string; explanation: string; xp: number } | null
}

export async function getSessionView(db: Db, actor: Actor, sessionId: string) {
  const studentId = studentIdOf(actor)
  assertUuid(sessionId, 'PLAY_SESSION_NOT_FOUND')
  const [session] = await db.select().from(playSessions).where(and(eq(playSessions.id, sessionId), eq(playSessions.studentId, studentId))).limit(1)
  if (!session) throw new AppError('PLAY_SESSION_NOT_FOUND')
  const qs = await db
    .select({
      id: playQuestions.id,
      type: playQuestions.type,
      difficulty: playQuestions.difficulty,
      subjectCode: playQuestions.subjectCode,
      language: playQuestions.language,
      questionText: playQuestions.questionText,
      payload: playQuestions.payload,
      answerKey: playQuestions.answerKey,
      explanation: playQuestions.explanation,
      lessonName: playLessons.lessonName
    })
    .from(playQuestions)
    .innerJoin(playLessons, eq(playLessons.id, playQuestions.lessonId))
    .where(inArray(playQuestions.id, session.questionIds))
  const answers = await db.select().from(playAnswers).where(eq(playAnswers.sessionId, session.id))
  const amap = new Map(answers.map((a) => [a.questionId, a]))
  const byId = new Map(qs.map((q) => [q.id, q]))
  const questions: SessionQuestionView[] = session.questionIds
    .map((id, i) => {
      const q = byId.get(id)
      if (!q) return null
      const payload = shufflePayloadForSession(q.payload, hashToSeed(String(session.seed), q.id))
      const a = amap.get(id)
      return {
        id: q.id,
        position: i,
        type: q.type,
        difficulty: q.difficulty,
        subjectCode: q.subjectCode,
        lessonName: q.lessonName,
        language: q.language,
        questionText: q.questionText,
        payload,
        answered: a ? { isCorrect: a.isCorrect, correctText: correctAnswerText(payload, q.answerKey), explanation: q.explanation, xp: a.xpAwarded } : null
      }
    })
    .filter((x): x is SessionQuestionView => x !== null)
  return {
    session: {
      id: session.id,
      challengeType: session.challengeType,
      status: session.status,
      timed: session.timed,
      expiresAt: session.expiresAt,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      answeredCount: session.answeredCount,
      correctCount: session.correctCount,
      xpEarned: session.xpEarned,
      total: session.questionIds.length,
      subjectCode: session.subjectCode,
      lessonId: session.lessonId
    },
    questions
  }
}

/* -------------------------------- التصحيح -------------------------------- */

export interface SubmitResult {
  isCorrect: boolean
  score: number
  correctText: string
  explanation: string
  xp: number
  sessionCompleted: boolean
  sessionXp: number
  correctCount: number
  answeredCount: number
  total: number
  newBadges: { code: string; nameAr: string; icon: string }[]
  lessonMastered: boolean
  level: ReturnType<typeof levelFor>
  xpTotal: number
}

function todayStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function submitPlayAnswer(db: Db, actor: Actor, sessionId: string, questionId: string, answer: PlayStudentAnswer | null, timeMs: number | null, now: Date = new Date()): Promise<SubmitResult> {
  const studentId = studentIdOf(actor)
  assertUuid(sessionId, 'PLAY_SESSION_NOT_FOUND')
  assertUuid(questionId, 'PLAY_QUESTION_NOT_FOUND')
  const rules = await getPlayRules(db)
  return db.transaction(async (tx) => {
    const [session] = await tx
      .select()
      .from(playSessions)
      .where(and(eq(playSessions.id, sessionId), eq(playSessions.studentId, studentId)))
      .for('update')
      .limit(1)
    if (!session) throw new AppError('PLAY_SESSION_NOT_FOUND')
    if (session.status !== 'ACTIVE') throw new AppError('PLAY_SESSION_CLOSED')
    if (session.expiresAt && session.expiresAt.getTime() < now.getTime()) {
      await tx.update(playSessions).set({ status: 'EXPIRED', completedAt: now }).where(eq(playSessions.id, session.id))
      throw new AppError('PLAY_SESSION_EXPIRED')
    }
    const position = session.questionIds.indexOf(questionId)
    if (position < 0) throw new AppError('PLAY_QUESTION_NOT_FOUND')
    const [existing] = await tx.select({ id: playAnswers.id }).from(playAnswers).where(and(eq(playAnswers.sessionId, session.id), eq(playAnswers.questionId, questionId))).limit(1)
    if (existing) throw new AppError('PLAY_ALREADY_ANSWERED')
    const [q] = await tx.select().from(playQuestions).where(eq(playQuestions.id, questionId)).limit(1)
    if (!q) throw new AppError('PLAY_QUESTION_NOT_FOUND')

    const outcome = gradePlayAnswer(q.answerKey, answer)
    // الذاكرة
    const [memRow] = await tx.select().from(playQuestionMemory).where(and(eq(playQuestionMemory.studentId, studentId), eq(playQuestionMemory.questionId, questionId))).limit(1)
    const wasMastered = !!memRow && memRow.box >= LEITNER_MASTERED_BOX
    let xp = 0
    if (outcome.isCorrect) xp = wasMastered ? rules.xp.repeatMastered : q.difficulty === 'HARD' ? rules.xp.correctHard : rules.xp.correct

    await tx.insert(playAnswers).values({ sessionId: session.id, questionId, studentId, position, answer, isCorrect: outcome.isCorrect, xpAwarded: xp, timeMs, answeredAt: now })

    const newBox = outcome.isCorrect ? Math.min(LEITNER_INTERVALS_DAYS.length - 1, (memRow?.box ?? 0) + 1) : 0
    const dueAt = new Date(now.getTime() + (outcome.isCorrect ? LEITNER_INTERVALS_DAYS[newBox]! : 1) * 86400000)
    if (memRow) {
      await tx
        .update(playQuestionMemory)
        .set({ box: newBox, dueAt, lastResult: outcome.isCorrect, wrongCount: memRow.wrongCount + (outcome.isCorrect ? 0 : 1), correctStreak: outcome.isCorrect ? memRow.correctStreak + 1 : 0, seenCount: memRow.seenCount + 1, lastSeenAt: now })
        .where(eq(playQuestionMemory.id, memRow.id))
    } else {
      await tx.insert(playQuestionMemory).values({ studentId, questionId, lessonId: q.lessonId, box: newBox, dueAt, lastResult: outcome.isCorrect, wrongCount: outcome.isCorrect ? 0 : 1, correctStreak: outcome.isCorrect ? 1 : 0, seenCount: 1, lastSeenAt: now })
    }
    await tx
      .update(playQuestions)
      .set(outcome.isCorrect ? { timesCorrect: sql`${playQuestions.timesCorrect} + 1` } : { timesWrong: sql`${playQuestions.timesWrong} + 1` })
      .where(eq(playQuestions.id, questionId))

    // تقدم الدرس (نافذة آخر 20 إجابة)
    const [lp] = await tx.select().from(playLessonProgress).where(and(eq(playLessonProgress.studentId, studentId), eq(playLessonProgress.lessonId, q.lessonId))).limit(1)
    const recent = ((lp?.recent ?? '') + (outcome.isCorrect ? '1' : '0')).slice(-20)
    const masteryPct = Math.round((recent.split('').filter((c) => c === '1').length / recent.length) * 100)
    const answeredLesson = (lp?.answered ?? 0) + 1
    const nowMastered = !lp?.masteredAt && answeredLesson >= rules.mastery.minAnswered && masteryPct >= rules.mastery.minPct
    if (lp) {
      await tx
        .update(playLessonProgress)
        .set({ answered: answeredLesson, correct: lp.correct + (outcome.isCorrect ? 1 : 0), masteryPct, recent, lastPlayedAt: now, masteredAt: nowMastered ? now : lp.masteredAt })
        .where(eq(playLessonProgress.id, lp.id))
    } else {
      await tx.insert(playLessonProgress).values({ studentId, lessonId: q.lessonId, answered: 1, correct: outcome.isCorrect ? 1 : 0, masteryPct, recent, lastPlayedAt: now, masteredAt: nowMastered ? now : null })
    }
    if (nowMastered) xp += rules.xp.lessonMastery

    // الجلسة
    const answeredCount = session.answeredCount + 1
    const correctCount = session.correctCount + (outcome.isCorrect ? 1 : 0)
    const completed = answeredCount >= session.questionIds.length
    if (completed) xp += rules.xp.sessionComplete
    const sessionXp = session.xpEarned + xp
    await tx
      .update(playSessions)
      .set({ answeredCount, correctCount, xpEarned: sessionXp, status: completed ? 'COMPLETED' : 'ACTIVE', completedAt: completed ? now : null })
      .where(eq(playSessions.id, session.id))

    // إحصاءات الطالب
    const stats = await ensureStats(tx, studentId)
    const today = todayStr(now)
    let streak = stats.streakDays
    if (stats.lastActiveDate !== today) {
      const yesterday = todayStr(new Date(now.getTime() - 86400000))
      streak = stats.lastActiveDate === yesterday ? stats.streakDays + 1 : 1
    }
    const xpTotal = stats.xpTotal + xp
    const lvl = levelFor(rules, xpTotal)
    const lessonsMastered = stats.lessonsMastered + (nowMastered ? 1 : 0)
    const correctTotal = stats.correctTotal + (outcome.isCorrect ? 1 : 0)
    const hardCorrectTotal = stats.hardCorrectTotal + (outcome.isCorrect && q.difficulty === 'HARD' ? 1 : 0)
    const sessionsCompleted = stats.sessionsCompleted + (completed ? 1 : 0)
    await tx
      .update(playStudentStats)
      .set({ xpTotal, levelIndex: lvl.index, streakDays: streak, lastActiveDate: today, answeredTotal: stats.answeredTotal + 1, correctTotal, hardCorrectTotal, lessonsMastered, sessionsCompleted })
      .where(eq(playStudentStats.studentId, studentId))

    // إحصاءات المادة
    const [ss] = await tx
      .select()
      .from(playSubjectStats)
      .where(and(eq(playSubjectStats.studentId, studentId), eq(playSubjectStats.gradeCode, q.gradeCode), eq(playSubjectStats.subjectCode, q.subjectCode)))
      .limit(1)
    const subjCorrect = (ss?.correct ?? 0) + (outcome.isCorrect ? 1 : 0)
    if (ss) await tx.update(playSubjectStats).set({ xp: ss.xp + xp, answered: ss.answered + 1, correct: subjCorrect, lastPlayedAt: now }).where(eq(playSubjectStats.id, ss.id))
    else await tx.insert(playSubjectStats).values({ studentId, gradeCode: q.gradeCode, subjectCode: q.subjectCode, xp, answered: 1, correct: subjCorrect, lastPlayedAt: now })

    // الشارات
    const subjectCorrect = new Map<string, number>()
    const allSubj = await tx.select({ code: playSubjectStats.subjectCode, correct: playSubjectStats.correct }).from(playSubjectStats).where(eq(playSubjectStats.studentId, studentId))
    for (const s of allSubj) subjectCorrect.set(s.code, (subjectCorrect.get(s.code) ?? 0) + s.correct)
    const owned = new Set((await tx.select({ code: playStudentBadges.badgeCode }).from(playStudentBadges).where(eq(playStudentBadges.studentId, studentId))).map((b) => b.code))
    const newBadges: { code: string; nameAr: string; icon: string }[] = []
    for (const b of PLAY_BADGES) {
      if (owned.has(b.code)) continue
      const r = b.rule
      let ok = false
      if (r.kind === 'SESSIONS') ok = sessionsCompleted >= r.count
      else if (r.kind === 'STREAK_DAYS') ok = streak >= r.days
      else if (r.kind === 'TOTAL_CORRECT') ok = correctTotal >= r.count
      else if (r.kind === 'LESSON_MASTERED') ok = lessonsMastered >= r.count
      else if (r.kind === 'HARD_CORRECT') ok = hardCorrectTotal >= r.count
      else if (r.kind === 'SUBJECT_CORRECT') ok = r.subject.split('+').reduce((acc, s) => acc + (subjectCorrect.get(s) ?? 0), 0) >= r.count
      if (ok) {
        await tx.insert(playStudentBadges).values({ studentId, badgeCode: b.code, earnedAt: now }).onConflictDoNothing()
        newBadges.push({ code: b.code, nameAr: b.nameAr, icon: b.icon })
      }
    }

    const payload = shufflePayloadForSession(q.payload, hashToSeed(String(session.seed), q.id))
    return {
      isCorrect: outcome.isCorrect,
      score: outcome.score,
      correctText: correctAnswerText(payload, q.answerKey),
      explanation: q.explanation,
      xp,
      sessionCompleted: completed,
      sessionXp,
      correctCount,
      answeredCount,
      total: session.questionIds.length,
      newBadges,
      lessonMastered: nowMastered,
      level: lvl,
      xpTotal
    }
  })
}

export async function abandonSession(db: Db, actor: Actor, sessionId: string) {
  const studentId = studentIdOf(actor)
  assertUuid(sessionId, 'PLAY_SESSION_NOT_FOUND')
  await db
    .update(playSessions)
    .set({ status: 'ABANDONED', completedAt: new Date() })
    .where(and(eq(playSessions.id, sessionId), eq(playSessions.studentId, studentId), eq(playSessions.status, 'ACTIVE')))
}

/* ------------------------------- لوحة الطالب ------------------------------- */

export async function getPlayDashboard(db: Db, actor: Actor, now: Date = new Date()) {
  const studentId = studentIdOf(actor)
  const profile = await getPlayProfile(db, actor)
  const rules = await getPlayRules(db)
  const level = levelFor(rules, profile.xpTotal)
  const [active] = await db.select().from(playSessions).where(and(eq(playSessions.studentId, studentId), eq(playSessions.status, 'ACTIVE'))).orderBy(desc(playSessions.startedAt)).limit(1)
  const subjects = profile.gradeCode ? await listSubjectsFor(db, profile.gradeCode, profile.streamCode) : []
  const subjStats = await db.select().from(playSubjectStats).where(and(eq(playSubjectStats.studentId, studentId), eq(playSubjectStats.gradeCode, profile.gradeCode ?? '')))
  const smap = new Map(subjStats.map((s) => [s.subjectCode, s]))
  const badges = await db.select().from(playStudentBadges).where(eq(playStudentBadges.studentId, studentId))
  const [dueRow] = await db
    .select({ due: sql<number>`count(*)`.mapWith(Number) })
    .from(playQuestionMemory)
    .where(and(eq(playQuestionMemory.studentId, studentId), lte(playQuestionMemory.box, 1), lte(playQuestionMemory.dueAt, now)))
  const due = dueRow?.due ?? 0
  const mastered = await db
    .select({ lessonName: playLessons.lessonName, subjectCode: playLessons.subjectCode, masteredAt: playLessonProgress.masteredAt })
    .from(playLessonProgress)
    .innerJoin(playLessons, eq(playLessons.id, playLessonProgress.lessonId))
    .where(and(eq(playLessonProgress.studentId, studentId), sql`${playLessonProgress.masteredAt} IS NOT NULL`))
    .orderBy(desc(playLessonProgress.masteredAt))
    .limit(12)
  const today = todayStr(now)
  const [dailyDone] = await db
    .select({ id: playSessions.id })
    .from(playSessions)
    .where(and(eq(playSessions.studentId, studentId), eq(playSessions.challengeType, 'DAILY'), eq(playSessions.status, 'COMPLETED'), sql`${playSessions.completedAt} >= ${today}::date`))
    .limit(1)
  const recentSessions = await db
    .select({ id: playSessions.id, challengeType: playSessions.challengeType, subjectCode: playSessions.subjectCode, correctCount: playSessions.correctCount, total: sql<number>`cardinality(${playSessions.questionIds})`.mapWith(Number), xpEarned: playSessions.xpEarned, completedAt: playSessions.completedAt, status: playSessions.status })
    .from(playSessions)
    .where(and(eq(playSessions.studentId, studentId), inArray(playSessions.status, ['COMPLETED', 'EXPIRED'])))
    .orderBy(desc(playSessions.startedAt))
    .limit(8)
  return {
    profile: { gradeCode: profile.gradeCode, streamCode: profile.streamCode, prefs: profile.prefs },
    grade: profile.gradeCode ? (gradeByCode(profile.gradeCode) ?? null) : null,
    stats: { xpTotal: profile.xpTotal, streakDays: profile.streakDays, answeredTotal: profile.answeredTotal, correctTotal: profile.correctTotal, sessionsCompleted: profile.sessionsCompleted, lessonsMastered: profile.lessonsMastered },
    level,
    activeSession: active ? { id: active.id, challengeType: active.challengeType, answeredCount: active.answeredCount, total: active.questionIds.length, subjectCode: active.subjectCode } : null,
    subjects: subjects.map((s) => ({ ...s, xp: smap.get(s.code)?.xp ?? 0, answered: smap.get(s.code)?.answered ?? 0, correct: smap.get(s.code)?.correct ?? 0 })),
    badges: PLAY_BADGES.map((b) => ({ code: b.code, nameAr: b.nameAr, descriptionAr: b.descriptionAr, icon: b.icon, earnedAt: badges.find((x) => x.badgeCode === b.code)?.earnedAt ?? null })),
    mistakesDue: due,
    masteredLessons: mastered,
    dailyDone: !!dailyDone,
    recentSessions,
    grades: PLAY_GRADES.filter((g) => g.isActive)
  }
}

/** «عالج أخطاءك»: نقاط الضعف حسب المادة والدرس */
export async function getMistakesOverview(db: Db, actor: Actor, now: Date = new Date()) {
  const studentId = studentIdOf(actor)
  const rows = await db
    .select({
      lessonId: playLessons.id,
      lessonName: playLessons.lessonName,
      unitName: playLessons.unitName,
      subjectCode: playLessons.subjectCode,
      subjectName: playSubjects.nameAr,
      wrong: sql<number>`sum(case when ${playQuestionMemory.lastResult} = false then 1 else 0 end)`.mapWith(Number),
      due: sql<number>`sum(case when ${playQuestionMemory.box} <= 1 and ${playQuestionMemory.dueAt} <= ${now} then 1 else 0 end)`.mapWith(Number),
      total: sql<number>`count(*)`.mapWith(Number)
    })
    .from(playQuestionMemory)
    .innerJoin(playLessons, eq(playLessons.id, playQuestionMemory.lessonId))
    .innerJoin(playSubjects, eq(playSubjects.code, playLessons.subjectCode))
    .where(eq(playQuestionMemory.studentId, studentId))
    .groupBy(playLessons.id, playSubjects.nameAr)
    .having(sql`sum(case when ${playQuestionMemory.lastResult} = false then 1 else 0 end) > 0 or sum(case when ${playQuestionMemory.box} <= 1 and ${playQuestionMemory.dueAt} <= ${now} then 1 else 0 end) > 0`)
    .orderBy(desc(sql`sum(case when ${playQuestionMemory.lastResult} = false then 1 else 0 end)`))
    .limit(50)
  const progress = rows.length
    ? await db.select().from(playLessonProgress).where(and(eq(playLessonProgress.studentId, studentId), inArray(playLessonProgress.lessonId, rows.map((r) => r.lessonId))))
    : []
  const pmap = new Map(progress.map((p) => [p.lessonId, p]))
  return rows.map((r) => ({ ...r, masteryPct: pmap.get(r.lessonId)?.masteryPct ?? 0 }))
}

export async function reportQuestion(db: Db, actor: Actor, input: { questionId: string; sessionId?: string | null; reason: PlayReportReason; message?: string | null }) {
  const studentId = studentIdOf(actor)
  assertUuid(input.questionId, 'PLAY_QUESTION_NOT_FOUND')
  const [q] = await db.select({ id: playQuestions.id }).from(playQuestions).where(eq(playQuestions.id, input.questionId)).limit(1)
  if (!q) throw new AppError('PLAY_QUESTION_NOT_FOUND')
  await db.insert(playQuestionReports).values({ questionId: q.id, studentId, sessionId: input.sessionId ?? null, reason: input.reason, message: input.message?.trim().slice(0, 1000) || null })
  await db.update(playQuestions).set({ reportsCount: sql`${playQuestions.reportsCount} + 1` }).where(eq(playQuestions.id, q.id))
}

/** للمشرف: تحديث قواعد XP */
export async function updatePlayRules(db: Db, actor: Actor, patch: Partial<PlayRules>) {
  assertRole(actor, 'SUPER_ADMIN')
  const current = await getPlayRules(db)
  const next: PlayRules = {
    xp: { ...current.xp, ...(patch.xp ?? {}) },
    levels: patch.levels?.length ? patch.levels : current.levels,
    mastery: { ...current.mastery, ...(patch.mastery ?? {}) },
    servableStatuses: patch.servableStatuses?.length ? patch.servableStatuses : current.servableStatuses,
    publicLeaderboard: patch.publicLeaderboard ?? current.publicLeaderboard
  }
  await db
    .insert(appSettings)
    .values({ key: PLAY_SETTINGS_KEY, value: next })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: next, updatedAt: new Date() } })
  return next
}
