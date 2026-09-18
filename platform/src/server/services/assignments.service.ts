import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import {
  assignmentSubmissions,
  assignmentTargets,
  assignments,
  files,
  grades,
  groupStudents,
  groups,
  profiles,
  rubricItems,
  skills,
  students,
  submissionMessages,
  teachers,
  users
} from '@/server/db/schema'
import { qcol } from '@/server/db/sql-helpers'
import { assertRole, studentIdOf, workspaceOf, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { assertGroupAccess } from './groups.service'
import { notify, notifyMany } from './notifications.service'
import { validateBreakdown } from './rubrics.service'
import { recordSkillResult } from './skills.service'
import { addTimeline } from './timeline.service'

export interface AssignmentInput {
  title: string
  description?: string | null
  subject?: string | null
  topic?: string | null
  skillId?: string | null
  startsAt?: Date | null
  dueAt?: Date | null
  maxScore?: number
  attachmentFileId?: string | null
  rubricId?: string | null
  groupIds: string[]
  studentIds: string[]
}

type AssignmentRow = typeof assignments.$inferSelect

async function assertAssignmentAccess(db: Db, actor: Actor, id: string): Promise<AssignmentRow> {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  assertUuid(id, 'ASSIGNMENT_NOT_FOUND')
  const [a] = await db.select().from(assignments).where(and(eq(assignments.id, id), isNull(assignments.deletedAt))).limit(1)
  if (!a) throw new AppError('ASSIGNMENT_NOT_FOUND')
  if (actor.role === 'TEACHER' && a.workspaceId !== actor.workspaceId) throw new AppError('ASSIGNMENT_NOT_FOUND')
  return a
}

/** الطلاب المستهدفون: النشطون في الأفواج المستهدفة ∪ الطلاب المحددون صراحة */
export async function targetedStudentIds(db: Db, assignmentId: string): Promise<string[]> {
  const targets = await db.select().from(assignmentTargets).where(eq(assignmentTargets.assignmentId, assignmentId))
  const groupIds = targets.map((t) => t.groupId).filter((x): x is string => !!x)
  const explicit = targets.map((t) => t.studentId).filter((x): x is string => !!x)
  const set = new Set(explicit)
  if (groupIds.length > 0) {
    const rows = await db
      .select({ studentId: groupStudents.studentId })
      .from(groupStudents)
      .where(and(inArray(groupStudents.groupId, groupIds), eq(groupStudents.status, 'ACTIVE')))
    for (const r of rows) set.add(r.studentId)
  }
  return [...set]
}

async function isTargeted(db: Db, assignmentId: string, studentId: string): Promise<boolean> {
  const ids = await targetedStudentIds(db, assignmentId)
  return ids.includes(studentId)
}

async function validateTargets(db: Db, actor: Actor, workspaceId: string, groupIds: string[], studentIds: string[]) {
  for (const gid of groupIds) await assertGroupAccess(db, actor, gid)
  if (studentIds.length > 0) {
    const rows = await db
      .select({ studentId: groupStudents.studentId })
      .from(groupStudents)
      .where(and(inArray(groupStudents.studentId, studentIds), eq(groupStudents.workspaceId, workspaceId)))
    const allowed = new Set(rows.map((r) => r.studentId))
    for (const sid of studentIds) if (!allowed.has(sid)) throw new AppError('NOT_FOUND')
  }
  if (groupIds.length === 0 && studentIds.length === 0) throw new AppError('VALIDATION', { field: 'targets' })
}

export async function createAssignment(db: Db, actor: Actor, input: AssignmentInput) {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  const workspaceId = workspaceOf(actor, actor.workspaceId)
  const title = input.title.trim()
  if (!title) throw new AppError('VALIDATION', { field: 'title' })
  const maxScore = input.maxScore ?? 20
  if (maxScore <= 0 || maxScore > 1000) throw new AppError('INVALID_SCORE')
  await validateTargets(db, actor, workspaceId, input.groupIds, input.studentIds)

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(assignments)
      .values({
        workspaceId,
        createdByUserId: actor.userId,
        title,
        description: input.description?.trim() || null,
        subject: input.subject?.trim() || null,
        topic: input.topic?.trim() || null,
        skillId: input.skillId ?? null,
        startsAt: input.startsAt ?? null,
        dueAt: input.dueAt ?? null,
        maxScore: String(maxScore),
        attachmentFileId: input.attachmentFileId ?? null,
        rubricId: input.rubricId ?? null
      })
      .returning()
    if (!row) throw new AppError('INTERNAL')
    await tx.insert(assignmentTargets).values([
      ...input.groupIds.map((groupId) => ({ assignmentId: row.id, groupId })),
      ...input.studentIds.map((studentId) => ({ assignmentId: row.id, studentId }))
    ])
    const ids = await targetedStudentIds(tx, row.id)
    if (ids.length > 0) {
      const usersRows = await tx.select({ userId: students.userId }).from(students).where(inArray(students.id, ids))
      await notifyMany(
        tx,
        usersRows.map((u) => ({
          userId: u.userId,
          workspaceId,
          type: 'NEW_ASSIGNMENT' as const,
          title: `واجب جديد: ${title}`,
          body: input.dueAt ? `آخر أجل: ${input.dueAt.toLocaleDateString('ar-DZ')}` : null,
          link: `/student/assignments/${row.id}`
        }))
      )
    }
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId, action: 'assignment.create', entityType: 'assignment', entityId: row.id, newValue: { title, targets: ids.length } })
    return row
  })
}

export async function updateAssignment(db: Db, actor: Actor, id: string, input: Partial<AssignmentInput>) {
  const a = await assertAssignmentAccess(db, actor, id)
  const patch: Partial<typeof assignments.$inferInsert> = {}
  if (input.title !== undefined) patch.title = input.title.trim()
  if (input.description !== undefined) patch.description = input.description?.trim() || null
  if (input.subject !== undefined) patch.subject = input.subject?.trim() || null
  if (input.topic !== undefined) patch.topic = input.topic?.trim() || null
  if (input.skillId !== undefined) patch.skillId = input.skillId
  if (input.startsAt !== undefined) patch.startsAt = input.startsAt
  if (input.dueAt !== undefined) patch.dueAt = input.dueAt
  if (input.maxScore !== undefined) {
    if (input.maxScore <= 0 || input.maxScore > 1000) throw new AppError('INVALID_SCORE')
    patch.maxScore = String(input.maxScore)
  }
  if (input.attachmentFileId !== undefined) patch.attachmentFileId = input.attachmentFileId
  if (input.rubricId !== undefined) patch.rubricId = input.rubricId
  if (input.groupIds && input.studentIds) await validateTargets(db, actor, a.workspaceId, input.groupIds, input.studentIds)

  return db.transaction(async (tx) => {
    if (Object.keys(patch).length > 0) await tx.update(assignments).set(patch).where(eq(assignments.id, a.id))
    if (input.groupIds && input.studentIds) {
      await tx.delete(assignmentTargets).where(eq(assignmentTargets.assignmentId, a.id))
      await tx.insert(assignmentTargets).values([
        ...input.groupIds.map((groupId) => ({ assignmentId: a.id, groupId })),
        ...input.studentIds.map((studentId) => ({ assignmentId: a.id, studentId }))
      ])
    }
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId: a.workspaceId, action: 'assignment.update', entityType: 'assignment', entityId: a.id, oldValue: { title: a.title }, newValue: patch as Record<string, unknown> })
  })
}

export async function deleteAssignment(db: Db, actor: Actor, id: string) {
  const a = await assertAssignmentAccess(db, actor, id)
  await db.transaction(async (tx) => {
    await tx.update(assignments).set({ deletedAt: new Date() }).where(eq(assignments.id, a.id))
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId: a.workspaceId, action: 'assignment.delete', entityType: 'assignment', entityId: a.id, oldValue: { title: a.title } })
  })
}

export interface TeacherAssignmentDetail {
  assignment: AssignmentRow & { skillName: string | null; attachmentName: string | null }
  targets: { groups: { id: string; name: string }[]; students: { id: string; fullName: string }[] }
  eligible: number
  submissions: {
    submissionId: string | null
    studentId: string
    fullName: string
    status: string | null
    submittedAt: Date | null
    score: string | null
    maxScore: string | null
    lastMessageAt: Date | null
  }[]
}

export async function getAssignmentForTeacher(db: Db, actor: Actor, id: string): Promise<TeacherAssignmentDetail> {
  const a = await assertAssignmentAccess(db, actor, id)
  const [meta] = await db
    .select({ skillName: skills.nameAr, attachmentName: files.originalName })
    .from(assignments)
    .leftJoin(skills, eq(skills.id, assignments.skillId))
    .leftJoin(files, eq(files.id, assignments.attachmentFileId))
    .where(eq(assignments.id, a.id))
  const targets = await db.select().from(assignmentTargets).where(eq(assignmentTargets.assignmentId, a.id))
  const groupIds = targets.map((t) => t.groupId).filter((x): x is string => !!x)
  const studentIdsExplicit = targets.map((t) => t.studentId).filter((x): x is string => !!x)
  const groupRows = groupIds.length ? await db.select({ id: groups.id, name: groups.name }).from(groups).where(inArray(groups.id, groupIds)) : []
  const ids = await targetedStudentIds(db, a.id)
  const people = ids.length
    ? await db
        .select({
          studentId: students.id,
          fullName: profiles.fullName,
          email: users.email,
          submissionId: assignmentSubmissions.id,
          status: assignmentSubmissions.status,
          submittedAt: assignmentSubmissions.submittedAt,
          score: grades.score,
          maxScore: grades.maxScore,
          lastMessageAt: sql<Date | null>`(select max(m.created_at) from ${submissionMessages} m where m.submission_id = ${qcol(assignmentSubmissions.id)})`
        })
        .from(students)
        .innerJoin(users, eq(users.id, students.userId))
        .leftJoin(profiles, eq(profiles.userId, users.id))
        .leftJoin(assignmentSubmissions, and(eq(assignmentSubmissions.assignmentId, a.id), eq(assignmentSubmissions.studentId, students.id)))
        .leftJoin(grades, and(eq(grades.submissionId, assignmentSubmissions.id), eq(grades.visibleToStudent, true)))
        .where(inArray(students.id, ids))
        .orderBy(asc(profiles.fullName))
    : []
  return {
    assignment: { ...a, skillName: meta?.skillName ?? null, attachmentName: meta?.attachmentName ?? null },
    targets: {
      groups: groupRows,
      students: people.filter((p) => studentIdsExplicit.includes(p.studentId)).map((p) => ({ id: p.studentId, fullName: p.fullName ?? p.email }))
    },
    eligible: ids.length,
    submissions: people.map((p) => ({
      submissionId: p.submissionId,
      studentId: p.studentId,
      fullName: p.fullName ?? p.email,
      status: p.status,
      submittedAt: p.submittedAt,
      score: p.score,
      maxScore: p.maxScore,
      lastMessageAt: p.lastMessageAt
    }))
  }
}

/* ----------------------------- Student side ------------------------------ */

export interface ThreadMessage {
  id: string
  kind: string
  body: string
  createdAt: Date
  authorName: string
  authorRole: string
  mine: boolean
}

export interface StudentAssignmentDetail {
  assignment: AssignmentRow & { attachmentName: string | null; teacherName: string | null }
  submission: (typeof assignmentSubmissions.$inferSelect) | null
  messages: ThreadMessage[]
  grade: { score: string; maxScore: string; strengths: string[]; improvements: string[]; notes: string | null } | null
}

export async function getAssignmentForStudent(db: Db, actor: Actor, id: string): Promise<StudentAssignmentDetail> {
  const studentId = studentIdOf(actor)
  assertUuid(id, 'ASSIGNMENT_NOT_FOUND')
  const [a] = await db.select().from(assignments).where(and(eq(assignments.id, id), isNull(assignments.deletedAt))).limit(1)
  if (!a) throw new AppError('ASSIGNMENT_NOT_FOUND')
  if (!(await isTargeted(db, a.id, studentId))) throw new AppError('NOT_TARGETED')
  const [meta] = await db
    .select({ attachmentName: files.originalName, teacherName: profiles.fullName })
    .from(assignments)
    .leftJoin(files, eq(files.id, assignments.attachmentFileId))
    .leftJoin(profiles, eq(profiles.userId, assignments.createdByUserId))
    .where(eq(assignments.id, a.id))
  const [submission] = await db
    .select()
    .from(assignmentSubmissions)
    .where(and(eq(assignmentSubmissions.assignmentId, a.id), eq(assignmentSubmissions.studentId, studentId)))
    .limit(1)
  const messages = submission ? await loadThread(db, submission.id, actor.userId) : []
  const grade = submission ? await visibleGrade(db, submission.id) : null
  return { assignment: { ...a, attachmentName: meta?.attachmentName ?? null, teacherName: meta?.teacherName ?? null }, submission: submission ?? null, messages, grade }
}

async function visibleGrade(db: Db, submissionId: string) {
  const [g] = await db
    .select({ score: grades.score, maxScore: grades.maxScore, strengths: grades.feedbackStrengths, improvements: grades.feedbackImprovements, notes: grades.teacherNotes, rubricBreakdown: grades.rubricBreakdown })
    .from(grades)
    .where(and(eq(grades.submissionId, submissionId), eq(grades.visibleToStudent, true)))
    .limit(1)
  return g ?? null
}

async function loadThread(db: Db, submissionId: string, viewerUserId: string): Promise<ThreadMessage[]> {
  const rows = await db
    .select({ id: submissionMessages.id, kind: submissionMessages.kind, body: submissionMessages.body, createdAt: submissionMessages.createdAt, authorId: submissionMessages.authorUserId, authorName: profiles.fullName, authorRole: users.role })
    .from(submissionMessages)
    .innerJoin(users, eq(users.id, submissionMessages.authorUserId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(submissionMessages.submissionId, submissionId))
    .orderBy(asc(submissionMessages.createdAt))
  return rows.map((r) => ({ id: r.id, kind: r.kind, body: r.body, createdAt: r.createdAt, authorName: r.authorName ?? '—', authorRole: r.authorRole, mine: r.authorId === viewerUserId }))
}

async function upsertDraft(tx: Db, a: AssignmentRow, studentId: string, text: string) {
  const [existing] = await tx
    .select()
    .from(assignmentSubmissions)
    .where(and(eq(assignmentSubmissions.assignmentId, a.id), eq(assignmentSubmissions.studentId, studentId)))
    .for('update')
    .limit(1)
  if (existing && existing.status !== 'DRAFT') throw new AppError('SUBMISSION_LOCKED')
  if (existing) {
    await tx.update(assignmentSubmissions).set({ answerText: text }).where(eq(assignmentSubmissions.id, existing.id))
    return existing.id
  }
  const [row] = await tx
    .insert(assignmentSubmissions)
    .values({ workspaceId: a.workspaceId, assignmentId: a.id, studentId, answerText: text, status: 'DRAFT' })
    .returning({ id: assignmentSubmissions.id })
  if (!row) throw new AppError('INTERNAL')
  return row.id
}

/** حفظ مسودة الإجابة (تلقائي أثناء الكتابة) */
export async function saveDraft(db: Db, actor: Actor, assignmentId: string, text: string) {
  const studentId = studentIdOf(actor)
  const [a] = await db.select().from(assignments).where(and(eq(assignments.id, assignmentId), isNull(assignments.deletedAt))).limit(1)
  if (!a) throw new AppError('ASSIGNMENT_NOT_FOUND')
  if (!(await isTargeted(db, a.id, studentId))) throw new AppError('NOT_TARGETED')
  return db.transaction(async (tx) => ({ submissionId: await upsertDraft(tx, a, studentId, text) }))
}

/** إرسال الإجابة نصاً كرسالة — نهائي، لا يُعدَّل بعده */
export async function submitAnswer(db: Db, actor: Actor, assignmentId: string, text: string, now: Date = new Date()) {
  const studentId = studentIdOf(actor)
  const body = text.trim()
  if (body.length < 3) throw new AppError('EMPTY_ANSWER')
  const [a] = await db.select().from(assignments).where(and(eq(assignments.id, assignmentId), isNull(assignments.deletedAt))).limit(1)
  if (!a) throw new AppError('ASSIGNMENT_NOT_FOUND')
  if (!(await isTargeted(db, a.id, studentId))) throw new AppError('NOT_TARGETED')

  return db.transaction(async (tx) => {
    const submissionId = await upsertDraft(tx, a, studentId, body)
    await tx.update(assignmentSubmissions).set({ status: 'SUBMITTED', submittedAt: now, answerText: body }).where(eq(assignmentSubmissions.id, submissionId))
    await tx.insert(submissionMessages).values({ submissionId, authorUserId: actor.userId, kind: 'ANSWER', body })
    await addTimeline(tx, { studentId, workspaceId: a.workspaceId, type: 'ASSIGNMENT_SUBMITTED', title: `أرسل إجابة واجب: ${a.title}`, meta: { assignmentId: a.id }, occurredAt: now })
    await notify(tx, {
      userId: a.createdByUserId,
      workspaceId: a.workspaceId,
      type: 'SYSTEM',
      title: `${actor.fullName} أرسل إجابة واجب "${a.title}"`,
      link: `/teacher/assignments/${a.id}/submissions/${submissionId}`
    })
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId: a.workspaceId, action: 'submission.submit', entityType: 'assignment_submission', entityId: submissionId, newValue: { assignmentId: a.id, late: a.dueAt ? now > a.dueAt : false } })
    return { submissionId, late: a.dueAt ? now > a.dueAt : false }
  })
}

/* ------------------------------ Thread & review --------------------------- */

interface SubmissionCtx {
  submission: typeof assignmentSubmissions.$inferSelect
  assignment: AssignmentRow
  studentUserId: string
}

async function loadSubmissionCtx(db: Db, actor: Actor, submissionId: string): Promise<SubmissionCtx> {
  assertUuid(submissionId, 'SUBMISSION_NOT_FOUND')
  const [row] = await db
    .select({ submission: assignmentSubmissions, assignment: assignments, studentUserId: students.userId })
    .from(assignmentSubmissions)
    .innerJoin(assignments, eq(assignments.id, assignmentSubmissions.assignmentId))
    .innerJoin(students, eq(students.id, assignmentSubmissions.studentId))
    .where(eq(assignmentSubmissions.id, submissionId))
    .limit(1)
  if (!row) throw new AppError('SUBMISSION_NOT_FOUND')
  if (actor.role === 'STUDENT') {
    if (row.submission.studentId !== actor.studentId) throw new AppError('FORBIDDEN')
  } else if (actor.role === 'TEACHER') {
    if (row.submission.workspaceId !== actor.workspaceId) throw new AppError('SUBMISSION_NOT_FOUND')
  } else {
    assertRole(actor, 'SUPER_ADMIN')
  }
  return row
}

export async function addThreadMessage(db: Db, actor: Actor, submissionId: string, text: string) {
  const body = text.trim()
  if (!body) throw new AppError('VALIDATION', { field: 'body' })
  const ctx = await loadSubmissionCtx(db, actor, submissionId)
  if (ctx.submission.status === 'DRAFT') throw new AppError('SUBMISSION_NOT_SUBMITTED')
  const kind = actor.role === 'STUDENT' ? 'REPLY' : 'FEEDBACK'
  return db.transaction(async (tx) => {
    const [m] = await tx.insert(submissionMessages).values({ submissionId, authorUserId: actor.userId, kind, body }).returning()
    if (actor.role === 'STUDENT') {
      await notify(tx, { userId: ctx.assignment.createdByUserId, workspaceId: ctx.submission.workspaceId, type: 'SYSTEM', title: `ردّ ${actor.fullName} على "${ctx.assignment.title}"`, body: body.slice(0, 120), link: `/teacher/assignments/${ctx.assignment.id}/submissions/${submissionId}` })
    } else {
      await notify(tx, { userId: ctx.studentUserId, workspaceId: ctx.submission.workspaceId, type: 'GRADED', title: `ملاحظة من الأستاذ على "${ctx.assignment.title}"`, body: body.slice(0, 120), link: `/student/assignments/${ctx.assignment.id}` })
    }
    return m
  })
}

export interface ReviewInput {
  score: number
  strengths: string[]
  improvements: string[]
  notes?: string | null
  /** نقاط كل بند من شبكة التقييم المرتبطة بالواجب؛ إن وُجدت فالمجموع هو العلامة */
  rubricBreakdown?: Record<string, number> | null
}

/** اعتماد تصحيح الأستاذ: العلامة (أو مجموع بنود الـRubric) + ما أحسن فيه + ما يحتاج تحسينه، تصل الطالب كرسالة تصحيح وتُحدّث خريطة المهارات */
export async function reviewSubmission(db: Db, actor: Actor, submissionId: string, input: ReviewInput) {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  const ctx = await loadSubmissionCtx(db, actor, submissionId)
  if (ctx.submission.status === 'DRAFT') throw new AppError('SUBMISSION_NOT_SUBMITTED')
  const max = Number(ctx.assignment.maxScore)
  let score = input.score
  let items: { id: string; maxPoints: string; skillId: string | null }[] = []
  if (ctx.assignment.rubricId && input.rubricBreakdown) {
    items = await db.select({ id: rubricItems.id, maxPoints: rubricItems.maxPoints, skillId: rubricItems.skillId }).from(rubricItems).where(eq(rubricItems.rubricId, ctx.assignment.rubricId))
    score = validateBreakdown(items, input.rubricBreakdown)
  }
  if (!Number.isFinite(score) || score < 0 || score > max) throw new AppError('INVALID_SCORE')
  const strengths = input.strengths.map((s) => s.trim()).filter(Boolean)
  const improvements = input.improvements.map((s) => s.trim()).filter(Boolean)
  const notes = input.notes?.trim() || null

  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(grades).where(eq(grades.submissionId, submissionId)).limit(1)
    const values = {
      score: String(score),
      maxScore: String(max),
      source: 'TEACHER' as const,
      approvedByUserId: actor.userId,
      approvedAt: new Date(),
      feedbackStrengths: strengths,
      feedbackImprovements: improvements,
      teacherNotes: notes,
      rubricBreakdown: input.rubricBreakdown ?? null,
      visibleToStudent: true
    }
    let gradeId: string
    if (existing) {
      await tx.update(grades).set(values).where(eq(grades.id, existing.id))
      gradeId = existing.id
    } else {
      const [g] = await tx.insert(grades).values({ workspaceId: ctx.submission.workspaceId, studentId: ctx.submission.studentId, submissionId, ...values }).returning({ id: grades.id })
      if (!g) throw new AppError('INTERNAL')
      gradeId = g.id
    }
    await tx.update(assignmentSubmissions).set({ status: 'REVIEWED' }).where(eq(assignmentSubmissions.id, submissionId))

    // محرّك المهارات: المهارة العامة للواجب + مهارات بنود الشبكة
    if (max > 0 && ctx.assignment.skillId) {
      await recordSkillResult(tx, { studentId: ctx.submission.studentId, skillId: ctx.assignment.skillId, percent: (score / max) * 100, sourceType: 'ASSIGNMENT', sourceId: submissionId })
    }
    for (const it of items) {
      const pts = input.rubricBreakdown?.[it.id]
      if (it.skillId && pts !== undefined && Number(it.maxPoints) > 0 && it.skillId !== ctx.assignment.skillId) {
        await recordSkillResult(tx, { studentId: ctx.submission.studentId, skillId: it.skillId, percent: (pts / Number(it.maxPoints)) * 100, sourceType: 'ASSIGNMENT', sourceId: submissionId })
      }
    }

    const lines = [`نقطتك: ${score}/${max}`]
    if (strengths.length) lines.push('', 'أحسنت في:', ...strengths.map((s) => `• ${s}`))
    if (improvements.length) lines.push('', 'تحتاج إلى تحسين:', ...improvements.map((s) => `• ${s}`))
    if (notes) lines.push('', notes)
    await tx.insert(submissionMessages).values({ submissionId, authorUserId: actor.userId, kind: 'FEEDBACK', body: lines.join('\n') })

    await notify(tx, { userId: ctx.studentUserId, workspaceId: ctx.submission.workspaceId, type: 'NEW_GRADE', title: `تم تصحيح "${ctx.assignment.title}": ${score}/${max}`, link: `/student/assignments/${ctx.assignment.id}` })
    await addTimeline(tx, { studentId: ctx.submission.studentId, workspaceId: ctx.submission.workspaceId, type: 'GRADED', title: `حصل على ${score}/${max} في "${ctx.assignment.title}"`, meta: { assignmentId: ctx.assignment.id, gradeId } })
    await writeAudit(tx, {
      actorUserId: actor.userId,
      workspaceId: ctx.submission.workspaceId,
      action: 'grade.set',
      entityType: 'grade',
      entityId: gradeId,
      oldValue: existing ? { score: existing.score } : null,
      newValue: { score, maxScore: max }
    })
    return { gradeId }
  })
}

export interface TeacherSubmissionView {
  submission: typeof assignmentSubmissions.$inferSelect
  assignment: AssignmentRow
  student: { id: string; fullName: string; email: string }
  messages: ThreadMessage[]
  grade: { score: string; maxScore: string; strengths: string[]; improvements: string[]; notes: string | null } | null
}

export async function getSubmissionForTeacher(db: Db, actor: Actor, submissionId: string): Promise<TeacherSubmissionView> {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  const ctx = await loadSubmissionCtx(db, actor, submissionId)
  const [st] = await db
    .select({ id: students.id, fullName: profiles.fullName, email: users.email })
    .from(students)
    .innerJoin(users, eq(users.id, students.userId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(students.id, ctx.submission.studentId))
  return {
    submission: ctx.submission,
    assignment: ctx.assignment,
    student: { id: st?.id ?? ctx.submission.studentId, fullName: st?.fullName ?? st?.email ?? '—', email: st?.email ?? '' },
    messages: await loadThread(db, submissionId, actor.userId),
    grade: await visibleGrade(db, submissionId)
  }
}

/** قائمة الواجبات للطالب مع الحالة والعلامة */
export async function listAssignmentsForStudent(db: Db, actor: Actor) {
  const studentId = studentIdOf(actor)
  const gids = (
    await db
      .select({ groupId: groupStudents.groupId })
      .from(groupStudents)
      .where(and(eq(groupStudents.studentId, studentId), eq(groupStudents.status, 'ACTIVE')))
  ).map((r) => r.groupId)
  const targeted = db
    .select({ id: assignmentTargets.assignmentId })
    .from(assignmentTargets)
    .where(or(gids.length ? inArray(assignmentTargets.groupId, gids) : sql`false`, eq(assignmentTargets.studentId, studentId)))
  return db
    .select({
      id: assignments.id,
      title: assignments.title,
      topic: assignments.topic,
      subject: assignments.subject,
      dueAt: assignments.dueAt,
      maxScore: assignments.maxScore,
      teacherName: teachers.displayName,
      status: assignmentSubmissions.status,
      submittedAt: assignmentSubmissions.submittedAt,
      score: grades.score
    })
    .from(assignments)
    .leftJoin(teachers, eq(teachers.userId, assignments.createdByUserId))
    .leftJoin(assignmentSubmissions, and(eq(assignmentSubmissions.assignmentId, assignments.id), eq(assignmentSubmissions.studentId, studentId)))
    .leftJoin(grades, and(eq(grades.submissionId, assignmentSubmissions.id), eq(grades.visibleToStudent, true)))
    .where(and(inArray(assignments.id, targeted), isNull(assignments.deletedAt)))
    .orderBy(desc(assignments.createdAt))
}
