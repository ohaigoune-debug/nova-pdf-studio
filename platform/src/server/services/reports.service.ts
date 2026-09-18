import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { assignmentSubmissions, assignments, files, grades, groups, jobs, profiles, quizAttempts, quizzes, skills, studentSkills, students, users } from '@/server/db/schema'
import { enqueueJob } from '@/server/jobs/queue'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { newStorageKey, signFileUrl, storage } from '@/server/lib/storage'
import { attendanceMatrix } from '@/server/queries/teacher-extras.queries'
import { assertGroupAccess } from './groups.service'
import { notify } from './notifications.service'
import { listTeacherStudents } from './students.service'

/**
 * تقارير CSV تُولَّد كمهام خلفية وتُخزَّن كملفات خاصة في مساحة الأستاذ،
 * وتُنزَّل عبر روابط موقّعة فقط. (Excel يفتح CSV بـ BOM بالعربية مباشرة.)
 */
export const REPORT_KINDS = ['GROUP_ATTENDANCE', 'GROUP_GRADES', 'GROUP_SKILLS', 'STUDENTS'] as const
export type ReportKind = (typeof REPORT_KINDS)[number]

export const REPORT_LABELS: Record<ReportKind, string> = {
  GROUP_ATTENDANCE: 'حضور الفوج (حصة × طالب)',
  GROUP_GRADES: 'علامات الفوج (واجبات واختبارات)',
  GROUP_SKILLS: 'خريطة مهارات الفوج',
  STUDENTS: 'قائمة الطلاب وبياناتهم'
}

const STATUS_AR: Record<string, string> = { PRESENT: 'حاضر', LATE: 'متأخر', ABSENT: 'غائب', EXCUSED: 'مبرر', UNEXCUSED: 'غير مبرر' }

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = v instanceof Date ? v.toISOString().slice(0, 16).replace('T', ' ') : String(v)
  // منع حقن الصيغ في Excel
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

export async function requestReport(db: Db, actor: Actor, input: { kind: ReportKind; groupId?: string | null }): Promise<{ jobId: string }> {
  assertRole(actor, 'TEACHER')
  if (!actor.workspaceId) throw new AppError('FORBIDDEN')
  if (!REPORT_KINDS.includes(input.kind)) throw new AppError('VALIDATION', { field: 'kind' })
  let groupName: string | null = null
  if (input.kind !== 'STUDENTS') {
    if (!input.groupId) throw new AppError('VALIDATION', { field: 'groupId' })
    const g = await assertGroupAccess(db, actor, input.groupId)
    groupName = g.name
  }
  const job = await enqueueJob(db, {
    type: 'REPORT_EXPORT',
    payload: { kind: input.kind, groupId: input.groupId ?? null, groupName, workspaceId: actor.workspaceId, userId: actor.userId },
    workspaceId: actor.workspaceId,
    maxAttempts: 2
  })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: actor.workspaceId, action: 'report.request', entityType: 'job', entityId: job.id, newValue: { kind: input.kind, groupId: input.groupId ?? null } })
  return { jobId: job.id }
}

async function buildAttendance(db: Db, actor: Actor, groupId: string) {
  const m = await attendanceMatrix(db, actor, groupId, 200)
  const header = ['الطالب', ...m.sessions.map((s) => `${s.scheduledAt.toISOString().slice(0, 10)} ${s.title ?? ''}`.trim()), 'نسبة الحضور %']
  const rows = m.rows.map((r) => [r.fullName, ...r.cells.map((c) => (c ? (STATUS_AR[c] ?? c) : '')), r.rate ?? ''])
  return { header, rows }
}

async function buildGrades(db: Db, workspaceId: string, groupId: string) {
  const members = await db
    .select({ studentId: students.id, fullName: profiles.fullName, email: users.email })
    .from(sql`group_students gs`)
    .innerJoin(students, sql`${students.id} = gs.student_id`)
    .innerJoin(users, eq(users.id, students.userId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(sql`gs.group_id = ${groupId} and gs.workspace_id = ${workspaceId}`)
  const ids = members.map((m) => m.studentId)
  const rows = ids.length
    ? await db
        .select({
          studentId: grades.studentId,
          score: grades.score,
          maxScore: grades.maxScore,
          source: grades.source,
          approvedAt: grades.approvedAt,
          assignmentTitle: assignments.title,
          quizTitle: quizzes.title
        })
        .from(grades)
        .leftJoin(assignmentSubmissions, eq(assignmentSubmissions.id, grades.submissionId))
        .leftJoin(assignments, eq(assignments.id, assignmentSubmissions.assignmentId))
        .leftJoin(quizAttempts, eq(quizAttempts.id, grades.quizAttemptId))
        .leftJoin(quizzes, eq(quizzes.id, quizAttempts.quizId))
        .where(and(inArray(grades.studentId, ids), eq(grades.workspaceId, workspaceId), eq(grades.visibleToStudent, true)))
        .orderBy(desc(grades.createdAt))
    : []
  const nameOf = new Map(members.map((m) => [m.studentId, m.fullName ?? m.email]))
  const header = ['الطالب', 'النوع', 'العنوان', 'العلامة', 'من', 'النسبة %', 'المصدر', 'تاريخ الاعتماد']
  const out = rows.map((r) => [
    nameOf.get(r.studentId) ?? '',
    r.assignmentTitle ? 'واجب' : 'اختبار',
    r.assignmentTitle ?? r.quizTitle ?? '',
    Number(r.score),
    Number(r.maxScore),
    Number(r.maxScore) > 0 ? Math.round((Number(r.score) / Number(r.maxScore)) * 100) : '',
    r.source === 'TEACHER' ? 'الأستاذ' : 'آلي',
    r.approvedAt
  ])
  return { header, rows: out }
}

async function buildSkills(db: Db, workspaceId: string, groupId: string) {
  const rows = await db
    .select({ fullName: profiles.fullName, email: users.email, skill: skills.nameAr, category: skills.category, score: studentSkills.score, confidence: studentSkills.confidence, attempts: studentSkills.attempts })
    .from(sql`group_students gs`)
    .innerJoin(studentSkills, sql`${studentSkills.studentId} = gs.student_id`)
    .innerJoin(skills, eq(skills.id, studentSkills.skillId))
    .innerJoin(students, sql`${students.id} = gs.student_id`)
    .innerJoin(users, eq(users.id, students.userId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(sql`gs.group_id = ${groupId} and gs.workspace_id = ${workspaceId}`)
    .orderBy(profiles.fullName, skills.category)
  const header = ['الطالب', 'المهارة', 'الفئة', 'المستوى %', 'الثقة', 'عدد التقييمات']
  return { header, rows: rows.map((r) => [r.fullName ?? r.email, r.skill, r.category, Number(r.score), Number(r.confidence), r.attempts]) }
}

async function buildStudents(db: Db, actor: Actor) {
  const list = await listTeacherStudents(db, actor)
  const header = ['الاسم الكامل', 'البريد', 'الهاتف', 'النوع', 'المستوى', 'الشعبة', 'الأفواج', 'الحالة', 'غيابات غير مبررة']
  const rows = list.map((s) => [s.fullName, s.email, s.phone, s.studentType, s.levelName, s.streamName, s.groups.map((g) => g.groupName).join(' | '), s.groups.map((g) => g.status).join(' | '), s.groups.reduce((n, g) => n + g.unexcused, 0)])
  return { header, rows }
}

/** معالج المهمة: يبني CSV ويخزّنه كملف خاص في مساحة الأستاذ ويُشعره */
export async function runReportJob(db: Db, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const kind = String(payload.kind) as ReportKind
  const workspaceId = String(payload.workspaceId ?? '')
  const userId = String(payload.userId ?? '')
  const groupId = payload.groupId ? String(payload.groupId) : null
  assertUuid(workspaceId, 'NOT_FOUND')
  assertUuid(userId, 'NOT_FOUND')
  if (!REPORT_KINDS.includes(kind)) throw new AppError('VALIDATION')
  const [p] = await db.select({ fullName: profiles.fullName, email: users.email }).from(users).leftJoin(profiles, eq(profiles.userId, users.id)).where(eq(users.id, userId)).limit(1)
  const actor: Actor = { userId, role: 'TEACHER', fullName: p?.fullName ?? '', email: p?.email ?? '', workspaceId, teacherId: null, studentId: null }

  let built: { header: string[]; rows: unknown[][] }
  let label = REPORT_LABELS[kind]
  if (kind === 'STUDENTS') built = await buildStudents(db, actor)
  else {
    assertUuid(groupId, 'NOT_FOUND')
    const [g] = await db.select({ name: groups.name }).from(groups).where(and(eq(groups.id, groupId), eq(groups.workspaceId, workspaceId))).limit(1)
    if (!g) throw new AppError('NOT_FOUND')
    label = `${label} — ${g.name}`
    built = kind === 'GROUP_ATTENDANCE' ? await buildAttendance(db, actor, groupId) : kind === 'GROUP_GRADES' ? await buildGrades(db, workspaceId, groupId) : await buildSkills(db, workspaceId, groupId)
  }
  const csv = Buffer.from(toCsv(built.header, built.rows), 'utf8')
  const key = newStorageKey(workspaceId, 'csv')
  await storage().put(key, csv)
  const name = `${label.replace(/[\\/:*?"<>|]/g, ' ')} ${new Date().toISOString().slice(0, 10)}.csv`
  const [file] = await db
    .insert(files)
    .values({ workspaceId, ownerUserId: userId, bucket: 'private', storageKey: key, originalName: name.slice(0, 200), mimeType: 'text/csv', sizeBytes: csv.length, checksum: null })
    .returning({ id: files.id })
  if (!file) throw new AppError('INTERNAL')
  await notify(db, { userId, workspaceId, type: 'SYSTEM', title: `التقرير جاهز: ${label}`, body: `${built.rows.length} صف`, link: '/teacher/reports' })
  return { fileId: file.id, name, rows: built.rows.length, kind, label }
}

export interface ReportListItem {
  jobId: string
  kind: string
  label: string
  status: string
  createdAt: Date
  finishedAt: Date | null
  rows: number | null
  downloadUrl: string | null
}

/** التقارير المطلوبة في مساحة الأستاذ مع روابط تنزيل موقّعة قصيرة العمر */
export async function listReports(db: Db, actor: Actor, limit = 20): Promise<ReportListItem[]> {
  assertRole(actor, 'TEACHER')
  if (!actor.workspaceId) return []
  const rows = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.type, 'REPORT_EXPORT'), eq(jobs.workspaceId, actor.workspaceId)))
    .orderBy(desc(jobs.createdAt))
    .limit(limit)
  return rows.map((j) => {
    const r = (j.result ?? {}) as { fileId?: string; rows?: number; label?: string }
    const kind = String(j.payload.kind ?? '')
    const groupName = j.payload.groupName ? ` — ${String(j.payload.groupName)}` : ''
    return {
      jobId: j.id,
      kind,
      label: r.label ?? `${REPORT_LABELS[kind as ReportKind] ?? kind}${groupName}`,
      status: j.status,
      createdAt: j.createdAt,
      finishedAt: j.finishedAt,
      rows: r.rows ?? null,
      downloadUrl: j.status === 'COMPLETED' && r.fileId ? signFileUrl(r.fileId, 3600) : null
    }
  })
}
