/**
 * MADRASA PLAY — لعبة البطاقات في تطبيق الهاتف (3 نوفمبر 2026).
 *
 * الموقع يلعب البطاقات بجلسة على الخادم (سؤال ← تصحيح فوري). التطبيق يلعبها دون إنترنت:
 *  1. lessonCards: دروس المادة بوحداتها وتقدّم التلميذ (نفس listLessonsFor).
 *  2. lessonPack: كل أسئلة الدرس الصالحة لشعبة التلميذ مع مفاتيحها وشروحها، للتخزين والتصحيح على الهاتف.
 *     الصلاحية نفسها كبدء جولة في الموقع (beginPlayAccess: الاشتراك أو التجربة).
 *  3. syncCardRound: الجولة المنجزة تُرفع، فتُنشأ لها جلسة LESSON_MASTERY ويُرسل كل جواب عبر submitPlayAnswer
 *     نفسها — الخادم يعيد التصحيح بمفاتيحه، ويحسب XP والإتقان والذاكرة والشارات كما في الموقع تمامًا.
 */
import { and, asc, eq, inArray } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { playLessons, playQuestions, playSessions, playSubjects } from '@/server/db/schema'
import { studentIdOf, type Actor } from '@/server/lib/actor'
import { AppError, assertUuid } from '@/server/lib/errors'
import { CHALLENGE_SIZES, PLAY_SUBJECTS } from '@/server/play/constants'
import { correctAnswerText, hashToSeed } from '@/server/play/engine'
import type { PlayAnswerKey, PlayPublicPayload, PlayStudentAnswer } from '@/server/play/question-types'
import { beginPlayAccess } from './play-access.service'
import { getPlayProfile, getPlayRules, levelFor, listLessonsFor, questionStreamFilter, servableFilter, streamFilter, submitPlayAnswer } from './play.service'

/** أقصى عدد أسئلة في حزمة درس، وفي جولة مرفوعة */
export const CARD_PACK_MAX = 300
export const CARD_ROUND_MAX = 40

async function profileOrThrow(db: Db, actor: Actor) {
  studentIdOf(actor)
  const profile = await getPlayProfile(db, actor)
  if (!profile.gradeCode) throw new AppError('PLAY_PROFILE_REQUIRED')
  return profile
}

/** دروس مادة بوحداتها، مع تقدّم التلميذ ونقاطه ومستواه */
export async function lessonCards(db: Db, actor: Actor, subjectCode: string) {
  const profile = await profileOrThrow(db, actor)
  const studentId = studentIdOf(actor)
  const [subject] = await db.select({ code: playSubjects.code, nameAr: playSubjects.nameAr, color: playSubjects.color, icon: playSubjects.icon, language: playSubjects.language }).from(playSubjects).where(eq(playSubjects.code, subjectCode)).limit(1)
  if (!subject) throw new AppError('PLAY_LESSON_NOT_FOUND')
  const units = await listLessonsFor(db, profile.gradeCode!, profile.streamCode, subjectCode, studentId)
  const rules = await getPlayRules(db)
  return {
    subject,
    units: units.map((u) => ({
      unitCode: u.unitCode,
      unitName: u.unitName,
      lessons: u.lessons.map((l) => ({ id: l.id, lessonName: l.lessonName, objective: l.objective, questions: l.questions, masteryPct: l.masteryPct, mastered: l.mastered, answered: l.answered }))
    })),
    stats: { xpTotal: profile.xpTotal, streakDays: profile.streakDays, level: levelFor(rules, profile.xpTotal) }
  }
}

export interface CardQuestion {
  id: string
  type: string
  difficulty: string
  language: string
  questionText: string
  payload: PlayPublicPayload
  answerKey: PlayAnswerKey
  explanation: string
  correctText: string
}

/** حزمة الدرس كاملة للتخزين في الهاتف. المفاتيح تصل إلى الجهاز عمدًا: الخادم يعيد التصحيح عند الرفع. */
export async function lessonPack(db: Db, actor: Actor, lessonId: string, now: Date = new Date()) {
  assertUuid(lessonId, 'PLAY_LESSON_NOT_FOUND')
  const profile = await profileOrThrow(db, actor)
  const [lesson] = await db
    .select({ id: playLessons.id, subjectCode: playLessons.subjectCode, unitCode: playLessons.unitCode, unitName: playLessons.unitName, lessonName: playLessons.lessonName, objective: playLessons.objective })
    .from(playLessons)
    .where(and(eq(playLessons.id, lessonId), eq(playLessons.gradeCode, profile.gradeCode!), eq(playLessons.isActive, true), streamFilter(profile.streamCode)))
    .limit(1)
  if (!lesson) throw new AppError('PLAY_LESSON_NOT_FOUND')
  const rules = await getPlayRules(db)
  const rows = await db
    .select({ id: playQuestions.id, type: playQuestions.type, difficulty: playQuestions.difficulty, language: playQuestions.language, questionText: playQuestions.questionText, payload: playQuestions.payload, answerKey: playQuestions.answerKey, explanation: playQuestions.explanation })
    .from(playQuestions)
    .where(and(eq(playQuestions.lessonId, lesson.id), servableFilter(rules), questionStreamFilter(profile.streamCode)))
    .orderBy(asc(playQuestions.key))
    .limit(CARD_PACK_MAX)
  if (rows.length === 0) throw new AppError('PLAY_NO_QUESTIONS')
  // نفس صلاحية بدء جولة في الموقع: المشترك يمرّ، وإلا تبدأ التجربة مرة واحدة، والمنتهية تُرفض
  await beginPlayAccess(db, actor, { gradeCode: profile.gradeCode!, streamCode: profile.streamCode, subjectCode: lesson.subjectCode }, now)
  const questions: CardQuestion[] = rows.map((q) => ({ ...q, correctText: correctAnswerText(q.payload, q.answerKey) }))
  const language = PLAY_SUBJECTS.find((s) => s.code === lesson.subjectCode)?.language ?? 'ar'
  return {
    lesson: { ...lesson, language },
    // بصمة المحتوى: تتغيّر إن عُدّلت أسئلة الدرس، فيحدّث التطبيق نسخته
    checksum: String(hashToSeed(...rows.map((q) => q.id + ':' + q.questionText.length + ':' + q.explanation.length))),
    roundSize: CHALLENGE_SIZES.LESSON_MASTERY,
    xp: rules.xp,
    questions
  }
}

/**
 * جولة بطاقات أُنجزت في التطبيق (ربما دون إنترنت): جلسة LESSON_MASTERY بأسئلة الجولة، ثم كل جواب عبر submitPlayAnswer
 * — الطريق نفسه للموقع، فلا يُحتسب إلا تصحيح الخادم. سؤال حُذف أو لم يعد صالحًا يُتجاهل، ولا يُفشل الجولة.
 */
export async function syncCardRound(db: Db, actor: Actor, input: { lessonId: string; answers: { questionId: string; answer: PlayStudentAnswer; timeMs: number | null }[] }, now: Date = new Date()) {
  assertUuid(input.lessonId, 'PLAY_LESSON_NOT_FOUND')
  const profile = await profileOrThrow(db, actor)
  const studentId = studentIdOf(actor)
  const [lesson] = await db
    .select({ id: playLessons.id, subjectCode: playLessons.subjectCode, unitCode: playLessons.unitCode })
    .from(playLessons)
    .where(and(eq(playLessons.id, input.lessonId), eq(playLessons.gradeCode, profile.gradeCode!), streamFilter(profile.streamCode)))
    .limit(1)
  if (!lesson) throw new AppError('PLAY_LESSON_NOT_FOUND')
  const wanted = [...new Map(input.answers.slice(0, CARD_ROUND_MAX).map((a) => [a.questionId, a])).values()].filter((a) => /^[0-9a-f-]{36}$/i.test(a.questionId))
  if (wanted.length === 0) throw new AppError('VALIDATION')
  const rules = await getPlayRules(db)
  const valid = new Set(
    (
      await db
        .select({ id: playQuestions.id })
        .from(playQuestions)
        .where(and(inArray(playQuestions.id, wanted.map((a) => a.questionId)), eq(playQuestions.lessonId, lesson.id), servableFilter(rules), questionStreamFilter(profile.streamCode)))
    ).map((r) => r.id)
  )
  const answers = wanted.filter((a) => valid.has(a.questionId))
  if (answers.length === 0) return { sessionId: null, accepted: 0, correctCount: 0, total: 0, xpEarned: 0, xpTotal: profile.xpTotal, level: levelFor(rules, profile.xpTotal), newBadges: [], lessonMastered: false }
  const [session] = await db
    .insert(playSessions)
    .values({
      studentId,
      gradeCode: profile.gradeCode!,
      streamCode: profile.streamCode,
      subjectCode: lesson.subjectCode,
      unitCode: lesson.unitCode,
      lessonId: lesson.id,
      challengeType: 'LESSON_MASTERY',
      timed: false,
      questionIds: answers.map((a) => a.questionId),
      seed: hashToSeed(studentId, String(now.getTime()), 'ios-cards'),
      startedAt: now,
      expiresAt: null
    })
    .returning({ id: playSessions.id })
  if (!session) throw new AppError('INTERNAL')
  let last: Awaited<ReturnType<typeof submitPlayAnswer>> | null = null
  const newBadges: { code: string; nameAr: string; icon: string }[] = []
  let lessonMastered = false
  for (const a of answers) {
    last = await submitPlayAnswer(db, actor, session.id, a.questionId, a.answer, a.timeMs, now)
    newBadges.push(...last.newBadges)
    lessonMastered ||= last.lessonMastered
  }
  return {
    sessionId: session.id,
    accepted: answers.length,
    correctCount: last?.correctCount ?? 0,
    total: answers.length,
    xpEarned: last?.sessionXp ?? 0,
    xpTotal: last?.xpTotal ?? profile.xpTotal,
    level: last?.level ?? levelFor(rules, profile.xpTotal),
    newBadges,
    lessonMastered
  }
}
