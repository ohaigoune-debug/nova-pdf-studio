import { and, desc, eq, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import {
  assignmentSubmissions,
  assignmentTargets,
  assignments,
  content,
  contentTargets,
  files,
  grades,
  groupStudents,
  levels,
  profiles,
  quizzes,
  skills,
  studentSkills,
  users
} from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { studentIdOf } from '@/server/lib/actor'
import type { ContentCard } from './content.queries'

async function myGroupIds(db: Db, studentId: string): Promise<string[]> {
  const rows = await db
    .select({ groupId: groupStudents.groupId })
    .from(groupStudents)
    .where(and(eq(groupStudents.studentId, studentId), inArray(groupStudents.status, ['ACTIVE', 'SUSPENDED', 'SUSPENDED_DUE_TO_ABSENCE'])))
  return rows.map((r) => r.groupId)
}

/** المحتوى المتاح للطالب: عام + للطلاب + الموجّه لأفواجه أو له شخصياً */
export async function listStudentContent(db: Db, actor: Actor, opts: { types?: string[]; limit?: number } = {}): Promise<ContentCard[]> {
  const studentId = studentIdOf(actor)
  const gids = await myGroupIds(db, studentId)
  const targeted = db
    .select({ id: contentTargets.contentId })
    .from(contentTargets)
    .where(or(gids.length ? inArray(contentTargets.groupId, gids) : sql`false`, eq(contentTargets.studentId, studentId)))
  return db
    .select({
      id: content.id,
      slug: content.slug,
      type: content.type,
      title: content.title,
      summary: content.summary,
      topic: content.topic,
      levelName: levels.nameAr,
      authorName: profiles.fullName,
      publishedAt: content.publishedAt,
      externalUrl: content.externalUrl
    })
    .from(content)
    .leftJoin(levels, eq(levels.id, content.levelId))
    .leftJoin(users, eq(users.id, content.authorUserId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(
      and(
        isNotNull(content.publishedAt),
        isNull(content.deletedAt),
        opts.types?.length ? inArray(content.type, opts.types) : undefined,
        or(inArray(content.visibility, ['PUBLIC', 'STUDENTS_ONLY']), inArray(content.id, targeted))
      )
    )
    .orderBy(desc(content.publishedAt))
    .limit(opts.limit ?? 60)
}

export async function listStudentAssignments(db: Db, actor: Actor) {
  const studentId = studentIdOf(actor)
  const gids = await myGroupIds(db, studentId)
  const targeted = db
    .select({ id: assignmentTargets.assignmentId })
    .from(assignmentTargets)
    .where(or(gids.length ? inArray(assignmentTargets.groupId, gids) : sql`false`, eq(assignmentTargets.studentId, studentId)))
  return db
    .select({
      id: assignments.id,
      title: assignments.title,
      description: assignments.description,
      topic: assignments.topic,
      dueAt: assignments.dueAt,
      maxScore: assignments.maxScore,
      submissionStatus: assignmentSubmissions.status,
      submittedAt: assignmentSubmissions.submittedAt
    })
    .from(assignments)
    .leftJoin(assignmentSubmissions, and(eq(assignmentSubmissions.assignmentId, assignments.id), eq(assignmentSubmissions.studentId, studentId)))
    .where(and(inArray(assignments.id, targeted), isNull(assignments.deletedAt)))
    .orderBy(desc(assignments.dueAt))
}

export async function listStudentGrades(db: Db, actor: Actor) {
  const studentId = studentIdOf(actor)
  return db
    .select({
      id: grades.id,
      score: grades.score,
      maxScore: grades.maxScore,
      approvedAt: grades.approvedAt,
      feedbackStrengths: grades.feedbackStrengths,
      feedbackImprovements: grades.feedbackImprovements,
      teacherNotes: grades.teacherNotes,
      assignmentTitle: assignments.title,
      createdAt: grades.createdAt
    })
    .from(grades)
    .leftJoin(assignmentSubmissions, eq(assignmentSubmissions.id, grades.submissionId))
    .leftJoin(assignments, eq(assignments.id, assignmentSubmissions.assignmentId))
    .where(and(eq(grades.studentId, studentId), eq(grades.visibleToStudent, true)))
    .orderBy(desc(grades.createdAt))
}

export async function listStudentSkills(db: Db, actor: Actor) {
  const studentId = studentIdOf(actor)
  return db
    .select({ code: skills.code, name: skills.nameAr, category: skills.category, score: studentSkills.score, confidence: studentSkills.confidence, attempts: studentSkills.attempts, lastUpdated: studentSkills.lastUpdated })
    .from(studentSkills)
    .innerJoin(skills, eq(skills.id, studentSkills.skillId))
    .where(eq(studentSkills.studentId, studentId))
    .orderBy(desc(studentSkills.score))
}

export async function listStudentFiles(db: Db, actor: Actor) {
  const studentId = studentIdOf(actor)
  const gids = await myGroupIds(db, studentId)
  const targeted = db
    .select({ id: contentTargets.contentId })
    .from(contentTargets)
    .where(or(gids.length ? inArray(contentTargets.groupId, gids) : sql`false`, eq(contentTargets.studentId, studentId)))
  return db
    .select({ id: content.id, title: content.title, type: content.type, publishedAt: content.publishedAt, fileName: files.originalName, size: files.sizeBytes, mime: files.mimeType })
    .from(content)
    .innerJoin(files, eq(files.id, content.fileId))
    .where(and(isNull(content.deletedAt), isNotNull(content.publishedAt), or(inArray(content.visibility, ['PUBLIC', 'STUDENTS_ONLY']), inArray(content.id, targeted))))
    .orderBy(desc(content.publishedAt))
}

export async function listPublicQuizzes(db: Db) {
  return db
    .select({ id: quizzes.id, title: quizzes.title, description: quizzes.description, topic: quizzes.topic, timeLimitMinutes: quizzes.timeLimitMinutes, maxScore: quizzes.maxScore })
    .from(quizzes)
    .where(and(eq(quizzes.isPublic, true), isNotNull(quizzes.publishedAt), isNull(quizzes.deletedAt)))
    .orderBy(desc(quizzes.publishedAt))
}
