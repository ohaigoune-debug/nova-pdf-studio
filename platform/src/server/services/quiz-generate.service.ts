/**
 * توليد اختبار كامل من مصادر يختارها الأستاذ — ملفاته، روابط Drive، مجلده المربوط — ولا شيء غيرها.
 * النتيجة مسودة غير منشورة يراجعها ثم ينشرها.
 */
import { eq } from 'drizzle-orm'
import { aiFailureReason } from '@/server/ai/failure'
import { getAiProvider } from '@/server/ai/provider'
import type { GeneratedQuestion } from '@/server/ai/types'
import type { Db } from '@/server/db/connect'
import { profiles } from '@/server/db/schema'
import { enqueueJob } from '@/server/jobs/queue'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid, isPermanentJobError, PermanentJobError, type ErrorCode } from '@/server/lib/errors'
import { validateQuestion } from '@/server/lib/quiz-grading'
import { t } from '@/i18n'
import { workspaceSubject } from './ai.service'
import { getDriveSource } from './drive-source.service'
import { assertGroupAccess } from './groups.service'
import { notify } from './notifications.service'
import { createQuiz } from './quizzes.service'
import { assertOwnFiles, passagesFor, resolveSources, validateSourceSpec, type SourceSpec } from './sources.service'

export const QUESTION_TYPES = ['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER', 'FILL_BLANK'] as const

export interface QuizGenerationInput extends SourceSpec {
  title?: string | null
  topic?: string | null
  count: number
  questionTypes: GeneratedQuestion['type'][]
  groupIds: string[]
}

export async function requestQuizGeneration(db: Db, actor: Actor, input: QuizGenerationInput): Promise<{ jobId: string }> {
  assertRole(actor, 'TEACHER')
  if (!actor.workspaceId) throw new AppError('FORBIDDEN')
  validateSourceSpec(input)
  input.fileIds.forEach((id) => assertUuid(id, 'FILE_NOT_FOUND'))
  await assertOwnFiles(db, actor.workspaceId, input.fileIds)
  if (input.useLinkedFolder && !(await getDriveSource(db, actor.workspaceId))) throw new AppError('DRIVE_SOURCE_MISSING')
  if (input.groupIds.length === 0) throw new AppError('VALIDATION', { field: 'groupIds' })
  for (const g of input.groupIds) await assertGroupAccess(db, actor, g)
  const count = Math.max(3, Math.min(20, Math.round(input.count || 10)))
  const questionTypes = input.questionTypes.filter((x) => (QUESTION_TYPES as readonly string[]).includes(x))
  const job = await enqueueJob(db, {
    type: 'AI_GENERATE_QUIZ',
    payload: {
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      title: input.title?.trim() || null,
      topic: input.topic?.trim() || null,
      count,
      questionTypes,
      groupIds: input.groupIds,
      fileIds: input.fileIds,
      driveLinks: input.driveLinks,
      useLinkedFolder: input.useLinkedFolder
    },
    workspaceId: actor.workspaceId,
    maxAttempts: 2
  })
  await writeAudit(db, {
    actorUserId: actor.userId,
    workspaceId: actor.workspaceId,
    action: 'ai.quiz.request',
    entityType: 'job',
    entityId: job.id,
    newValue: { topic: input.topic ?? null, count, files: input.fileIds.length, links: input.driveLinks.length, linkedFolder: input.useLinkedFolder }
  })
  return { jobId: job.id }
}

const strs = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : [])

export async function runGenerateQuizJob(db: Db, payload: Record<string, unknown>, ctx: { lastAttempt?: boolean } = {}): Promise<Record<string, unknown>> {
  const workspaceId = String(payload.workspaceId ?? '')
  const userId = String(payload.userId ?? '')
  assertUuid(workspaceId, 'NOT_FOUND')
  assertUuid(userId, 'NOT_FOUND')
  const topic = payload.topic ? String(payload.topic) : null
  const label = topic ?? (payload.title ? String(payload.title) : 'اختبار')
  const [p] = await db.select({ fullName: profiles.fullName }).from(profiles).where(eq(profiles.userId, userId)).limit(1)
  const actor: Actor = { userId, role: 'TEACHER', fullName: p?.fullName ?? '', email: '', workspaceId, teacherId: null, studentId: null }

  // سبب يخصّ المصادر لا يُصلحه التكرار: يُبلَّغ الأستاذ وتنتهي المهمة
  const stop = async (code: ErrorCode): Promise<never> => {
    await notify(db, { userId, workspaceId, type: 'SYSTEM', title: `لم يُولَّد الاختبار: ${label}`, body: t(`errors.${code}` as never), link: '/teacher/quizzes/generate' })
    throw new PermanentJobError(code)
  }
  const spec: SourceSpec = { fileIds: strs(payload.fileIds), driveLinks: strs(payload.driveLinks), useLinkedFolder: payload.useLinkedFolder === true }
  let docs: Awaited<ReturnType<typeof resolveSources>>
  try {
    docs = await resolveSources(db, workspaceId, spec)
  } catch (e) {
    if (e instanceof AppError && e.code !== 'INTERNAL') return stop(e.code)
    throw e
  }
  const sources = passagesFor(docs, topic)
  if (!sources) return stop(docs.length ? 'SOURCES_NO_MATCH' : 'DRIVE_EMPTY')

  const provider = getAiProvider()
  let out: Awaited<ReturnType<typeof provider.generateExercises>>
  try {
    out = await provider.generateExercises({
      subject: await workspaceSubject(db, workspaceId),
      skillName: topic ?? 'مضمون المصادر المرفقة',
      skillCategory: null,
      levelName: null,
      count: Number(payload.count ?? 10),
      sources,
      questionTypes: strs(payload.questionTypes) as GeneratedQuestion['type'][]
    })
  } catch (e) {
    // فشل نهائي (أو آخر محاولة): الأستاذ يعرف السبب بدل انتظار بلا نهاية
    if (isPermanentJobError(e) || ctx.lastAttempt !== false)
      await notify(db, { userId, workspaceId, type: 'SYSTEM', title: `لم يُولَّد الاختبار: ${label}`, body: aiFailureReason(e), link: '/teacher/quizzes/generate' })
    throw e
  }
  const allowed = strs(payload.questionTypes)
  const questions = out.questions
    .filter((q) => allowed.length === 0 || allowed.includes(q.type))
    .map((q) => ({ type: q.type, prompt: q.prompt.trim(), points: 1, answerKey: q.answerKey, options: q.type === 'MCQ' ? (q.options ?? []) : [] }))
    .filter((q) => validateQuestion(q) === null)
  if (questions.length === 0) return stop('SOURCES_NO_MATCH')

  const from = `المصادر: ${sources.map((s) => `«${s.title}»`).join('، ')}.`
  const quiz = await createQuiz(db, actor, {
    title: (payload.title ? String(payload.title) : out.title || `اختبار: ${label}`).slice(0, 200),
    description: `${out.description ? `${out.description}\n\n` : ''}${from}\n(مولَّد بمساعدة الذكاء الاصطناعي من مصادرك وحدها — راجعه قبل النشر)`.slice(0, 2000),
    topic,
    isPublic: false,
    publish: false,
    maxAttempts: 1,
    groupIds: strs(payload.groupIds),
    studentIds: [],
    questions
  })
  await notify(db, { userId, workspaceId, type: 'SYSTEM', title: `مسودة اختبار جاهزة: ${label}`, body: `${questions.length} سؤالاً من مصادرك — راجعها وانشرها.`, link: `/teacher/quizzes/${quiz.id}/edit` })
  return { quizId: quiz.id, questions: questions.length, dropped: out.questions.length - questions.length, provider: provider.name, sources: sources.map((s) => s.title) }
}
