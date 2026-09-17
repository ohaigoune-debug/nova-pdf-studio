import { and, count, desc, eq, gte, isNull, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { assignmentSubmissions, assignments, attendanceRecords, classSessions, content, files, groupStudents, groups, profiles, quizzes, users } from '@/server/db/schema'
import { qcol } from '@/server/db/sql-helpers'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'

function ws(actor: Actor): string {
  if (!actor.workspaceId) throw new AppError('FORBIDDEN')
  return actor.workspaceId
}

export async function listWorkspaceAssignments(db: Db, actor: Actor) {
  return db
    .select({
      id: assignments.id,
      title: assignments.title,
      topic: assignments.topic,
      dueAt: assignments.dueAt,
      maxScore: assignments.maxScore,
      submissions: sql<number>`(select count(*)::int from ${assignmentSubmissions} s where s.assignment_id = ${qcol(assignments.id)})`,
      pending: sql<number>`(select count(*)::int from ${assignmentSubmissions} s where s.assignment_id = ${qcol(assignments.id)} and s.status in ('SUBMITTED','AI_EVALUATED'))`
    })
    .from(assignments)
    .where(and(eq(assignments.workspaceId, ws(actor)), isNull(assignments.deletedAt)))
    .orderBy(desc(assignments.createdAt))
}

export async function listWorkspaceQuizzes(db: Db, actor: Actor) {
  return db
    .select({ id: quizzes.id, title: quizzes.title, topic: quizzes.topic, isPublic: quizzes.isPublic, publishedAt: quizzes.publishedAt, createdAt: quizzes.createdAt })
    .from(quizzes)
    .where(and(eq(quizzes.workspaceId, ws(actor)), isNull(quizzes.deletedAt)))
    .orderBy(desc(quizzes.createdAt))
}

export async function listWorkspaceContent(db: Db, actor: Actor) {
  return db
    .select({ id: content.id, title: content.title, type: content.type, visibility: content.visibility, topic: content.topic, publishedAt: content.publishedAt, createdAt: content.createdAt })
    .from(content)
    .where(and(eq(content.workspaceId, ws(actor)), isNull(content.deletedAt)))
    .orderBy(desc(content.createdAt))
}

export async function listWorkspaceFiles(db: Db, actor: Actor) {
  return db
    .select({ id: files.id, originalName: files.originalName, mimeType: files.mimeType, sizeBytes: files.sizeBytes, bucket: files.bucket, createdAt: files.createdAt, ownerName: profiles.fullName })
    .from(files)
    .leftJoin(users, eq(users.id, files.ownerUserId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(files.workspaceId, ws(actor)), isNull(files.deletedAt)))
    .orderBy(desc(files.createdAt))
}

export interface GroupAttendanceOverview {
  groupId: string
  name: string
  active: number
  sessions: number
  present: number
  late: number
  absent: number
  rate: number | null
  unexcused: number
  suspended: number
}

export async function attendanceOverview(db: Db, actor: Actor): Promise<GroupAttendanceOverview[]> {
  const rows = await db
    .select({
      groupId: groups.id,
      name: groups.name,
      active: sql<number>`(select count(*)::int from ${groupStudents} gs where gs.group_id = ${qcol(groups.id)} and gs.status = 'ACTIVE')`,
      suspended: sql<number>`(select count(*)::int from ${groupStudents} gs where gs.group_id = ${qcol(groups.id)} and gs.status = 'SUSPENDED_DUE_TO_ABSENCE')`,
      sessions: sql<number>`(select count(*)::int from ${classSessions} cs where cs.group_id = ${qcol(groups.id)} and cs.status = 'CLOSED')`,
      present: sql<number>`(select count(*)::int from ${attendanceRecords} a join ${classSessions} cs on cs.id = a.class_session_id where cs.group_id = ${qcol(groups.id)} and a.status = 'PRESENT')`,
      late: sql<number>`(select count(*)::int from ${attendanceRecords} a join ${classSessions} cs on cs.id = a.class_session_id where cs.group_id = ${qcol(groups.id)} and a.status = 'LATE')`,
      absent: sql<number>`(select count(*)::int from ${attendanceRecords} a join ${classSessions} cs on cs.id = a.class_session_id where cs.group_id = ${qcol(groups.id)} and a.status in ('ABSENT','UNEXCUSED','EXCUSED'))`,
      unexcused: sql<number>`(select count(*)::int from ${attendanceRecords} a join ${classSessions} cs on cs.id = a.class_session_id where cs.group_id = ${qcol(groups.id)} and a.status = 'UNEXCUSED')`
    })
    .from(groups)
    .where(and(eq(groups.workspaceId, ws(actor)), isNull(groups.deletedAt), eq(groups.status, 'ACTIVE')))
    .orderBy(groups.name)
  return rows.map((r) => {
    const total = r.present + r.late + r.absent
    return { ...r, rate: total > 0 ? Math.round(((r.present + r.late) / total) * 100) : null }
  })
}

/** تحليلات مبنية على بيانات حقيقية فقط (الحضور حالياً؛ المهارات في المرحلة 6) */
export interface DataInsight {
  tone: 'info' | 'warning' | 'success' | 'destructive'
  text: string
  href?: string
}

export async function dataInsights(db: Db, actor: Actor): Promise<DataInsight[]> {
  const w = ws(actor)
  const out: DataInsight[] = []
  const overview = await attendanceOverview(db, actor)
  for (const g of overview) {
    if (g.rate !== null && g.rate < 75 && g.sessions >= 2) out.push({ tone: 'warning', text: `نسبة الحضور في فوج ${g.name} ${g.rate}% خلال ${g.sessions} حصص — أقل من المعدل المقبول.`, href: `/teacher/groups/${g.groupId}` })
    if (g.suspended > 0) out.push({ tone: 'destructive', text: `${g.suspended} طالب معلّق بسبب الغياب في فوج ${g.name}.`, href: `/teacher/groups/${g.groupId}` })
  }
  const twoWeeks = new Date(Date.now() - 14 * 24 * 3600_000)
  const [recent] = await db
    .select({ total: count(), present: sql<number>`sum(case when ${attendanceRecords.status} in ('PRESENT','LATE') then 1 else 0 end)::int` })
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.workspaceId, w), gte(attendanceRecords.recordedAt, twoWeeks)))
  const [older] = await db
    .select({ total: count(), present: sql<number>`sum(case when ${attendanceRecords.status} in ('PRESENT','LATE') then 1 else 0 end)::int` })
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.workspaceId, w), sql`${attendanceRecords.recordedAt} < ${twoWeeks}`))
  if (recent && older && recent.total > 0 && older.total > 0) {
    const r1 = Math.round(((recent.present ?? 0) / recent.total) * 100)
    const r0 = Math.round(((older.present ?? 0) / older.total) * 100)
    if (r1 !== r0) out.push({ tone: r1 > r0 ? 'success' : 'warning', text: `متوسط الحضور ${r1 > r0 ? 'تحسّن' : 'تراجع'} من ${r0}% إلى ${r1}% خلال الأسبوعين الأخيرين.` })
  }
  const atRisk = await db
    .select({ n: count() })
    .from(groupStudents)
    .innerJoin(groups, eq(groups.id, groupStudents.groupId))
    .where(and(eq(groupStudents.workspaceId, w), eq(groupStudents.status, 'ACTIVE'), sql`${groupStudents.unexcusedAbsencesCount} >= ${groups.maxUnexcusedAbsences} - 1`))
  if ((atRisk[0]?.n ?? 0) > 0) out.push({ tone: 'warning', text: `${atRisk[0]!.n} طالب على بُعد غياب واحد من التعليق.`, href: '/teacher/students?status=ACTIVE' })
  const frequentlyLate = await db
    .select({ name: profiles.fullName, n: count() })
    .from(attendanceRecords)
    .innerJoin(groupStudents, eq(groupStudents.id, attendanceRecords.groupStudentId))
    .innerJoin(users, sql`${users.id} = (select user_id from students st where st.id = ${groupStudents.studentId})`)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(attendanceRecords.workspaceId, w), eq(attendanceRecords.status, 'LATE')))
    .groupBy(profiles.fullName)
    .having(sql`count(*) >= 3`)
    .limit(5)
  if (frequentlyLate.length > 0) out.push({ tone: 'info', text: `طلاب يتأخرون باستمرار: ${frequentlyLate.map((f) => `${f.name ?? '—'} (${f.n})`).join('، ')}.` })
  return out
}
