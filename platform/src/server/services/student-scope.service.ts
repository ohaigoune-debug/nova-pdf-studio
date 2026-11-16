/**
 * نطاق التلميذ (قرار المالك 15 نوفمبر 2026): التلميذ المسجَّل يرى دروس مستواه وشعبته فقط، مع الدروس المشتركة
 * بين كل شعب مستواه (درس بلا شعبة)، والدروس القديمة غير المصنّفة (بلا مستوى). لا مرشّح في الصفحة ولا رابط يغيّره:
 * يختار التلميذ مستواه وشعبته مرة واحدة، وبعدها يغيّرهما بطلب من «حسابي» يراجعه عون التأكيد (16 نوفمبر 2026).
 *
 * الشرط نفسه يُطبَّق في القوائم وفي فتح الدرس (الخادم)، فتغيير الرابط لا يفتح درسًا من مستوى أو شعبة أخرى.
 * المحتوى الموجَّه لأفواج التلميذ أو له شخصيًا (محتوى دوراته) يبقى خارج هذا الشرط: حقّ الوصول إليه من الاشتراك.
 */
import { and, asc, desc, eq, inArray, isNull, or, sql, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { Db } from '@/server/db/connect'
import { content, levels, profiles, scopeChangeRequests, streams, students, users, type ScopeChangeRequestRow, type ScopeRequestStatus } from '@/server/db/schema'
import { CHANGE_SCOPE_HREF } from '@/lib/student-scope'
import { writeAudit } from '@/server/lib/audit'
import { assertRole, studentIdOf, type Actor } from '@/server/lib/actor'
import { AppError, assertUuid } from '@/server/lib/errors'
import { streamFamily } from './stream-family'
import { notify, notifyMany } from './notifications.service'
import { listLevels, listStreams, streamFitsLevel, streamsByLevel } from './reference.service'

export interface StudentScope {
  levelId: string | null
  levelCode: string | null
  /** اسم المستوى بلا ما بين القوسين: «السنة الثالثة ثانوي» */
  levelName: string | null
  streamId: string | null
  streamName: string | null
  /** مستوى ثانوي: الشعبة إلزامية (نفس قاعدة التسجيل) */
  needsStream: boolean
  /** المستوى، والشعبة حين تلزم، محفوظان في الحساب: لا مرشّحات للتلميذ */
  complete: boolean
  /** الشعبة وأمّها («تقني رياضي — هندسة مدنية» يرى ما صُنّف لـ«تقني رياضي») */
  streamFamily: string[]
  /** السطر الصغير أعلى القائمة: «السنة الثالثة ثانوي · آداب وفلسفة» */
  label: string | null
}

const isSecondary = (code: string | null | undefined) => Boolean(code && /AS$/i.test(code))
const shortLevelName = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, '').trim()

export async function studentScope(db: Db, studentId: string): Promise<StudentScope> {
  const [row] = await db
    .select({ levelId: students.levelId, streamId: students.streamId, levelCode: levels.code, levelName: levels.nameAr, streamName: streams.nameAr })
    .from(students)
    .leftJoin(levels, eq(levels.id, students.levelId))
    .leftJoin(streams, eq(streams.id, students.streamId))
    .where(eq(students.id, studentId))
    .limit(1)
  const levelId = row?.levelId ?? null
  const needsStream = isSecondary(row?.levelCode)
  // شعبة محفوظة لمستوى لا شعب له (متوسط) لا تُستعمل في التصفية
  const streamId = needsStream ? (row?.streamId ?? null) : null
  const levelName = row?.levelName ? shortLevelName(row.levelName) : null
  const streamName = streamId ? (row?.streamName ?? null) : null
  return {
    levelId,
    levelCode: row?.levelCode ?? null,
    levelName,
    streamId,
    streamName,
    needsStream,
    complete: Boolean(levelId) && (!needsStream || Boolean(streamId)),
    streamFamily: await streamFamily(db, streamId),
    label: levelName ? [levelName, streamName].filter(Boolean).join(' · ') : null
  }
}

/** نطاق صاحب الطلب إن كان تلميذًا، وإلا null (الزائر والمشرف والأستاذ: لا قيد ولا تغيير في مرشّحاتهم) */
export async function studentScopeOf(db: Db, actor: Actor | null | undefined): Promise<StudentScope | null> {
  if (actor?.role !== 'STUDENT' || !actor.studentId) return null
  return studentScope(db, actor.studentId)
}

/**
 * شرط SQL على جدول content: درس من مستوى التلميذ أو بلا مستوى، ومن شعبته (أو أمّها) أو بلا شعبة (مشترك).
 * بلا مستوى في الحساب: لا قيد (لا نعرف ما ليس له؛ تطلب الصفحة اختياره أولًا).
 */
export function contentScopeClause(scope: StudentScope | null): SQL | undefined {
  if (!scope?.levelId) return undefined
  return and(
    or(isNull(content.levelId), eq(content.levelId, scope.levelId)),
    scope.streamFamily.length ? or(isNull(content.streamId), inArray(content.streamId, scope.streamFamily)) : undefined
  )
}

/** الشرط نفسه على صفّ محمَّل (لصفحة الدرس العامة) */
export function contentInScope(scope: StudentScope | null, row: { levelId: string | null; streamId: string | null }): boolean {
  if (!scope?.levelId) return true
  if (row.levelId && row.levelId !== scope.levelId) return false
  if (row.streamId && scope.streamFamily.length && !scope.streamFamily.includes(row.streamId)) return false
  return true
}

/** يتحقق من المستوى والشعبة بقواعد التسجيل: الشعبة إلزامية للثانوي ومن شعب سنته؛ المتوسط بلا شعبة */
async function validLevelStream(db: Db, input: { levelId: string; streamId?: string | null }): Promise<{ levelId: string; streamId: string | null }> {
  if (!input.levelId || !UUID_RE.test(input.levelId)) throw new AppError('VALIDATION', { field: 'levelId' })
  const [lv] = await db.select({ id: levels.id, code: levels.code }).from(levels).where(eq(levels.id, input.levelId)).limit(1)
  if (!lv) throw new AppError('VALIDATION', { field: 'levelId' })
  if (!isSecondary(lv.code)) return { levelId: lv.id, streamId: null }
  if (!input.streamId || !UUID_RE.test(input.streamId)) throw new AppError('VALIDATION', { field: 'streamId' })
  const [st] = await db.select({ id: streams.id }).from(streams).where(eq(streams.id, input.streamId)).limit(1)
  if (!st || !(await streamFitsLevel(db, lv.id, st.id))) throw new AppError('VALIDATION', { field: 'streamId' })
  return { levelId: lv.id, streamId: st.id }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * الاختيار الأول فقط (قرار المالك 16 نوفمبر 2026): التلميذ الذي لا مستوى له (أو ثانوي بلا شعبة) يختارهما مرة واحدة.
 * بعدها لا يغيّرهما بنفسه: يرسل طلبًا (requestScopeChange) يراجعه عون التأكيد.
 */
export async function saveStudentLevelStream(db: Db, actor: Actor, input: { levelId: string; streamId?: string | null }): Promise<StudentScope> {
  assertRole(actor, 'STUDENT')
  const studentId = studentIdOf(actor)
  if ((await studentScope(db, studentId)).complete) throw new AppError('FORBIDDEN', { reason: 'SCOPE_CHANGE_NEEDS_REQUEST' })
  const v = await validLevelStream(db, input)
  const updated = await db.update(students).set({ levelId: v.levelId, streamId: v.streamId }).where(and(eq(students.id, studentId), eq(students.userId, actor.userId))).returning({ id: students.id })
  if (!updated.length) throw new AppError('FORBIDDEN')
  return studentScope(db, studentId)
}

/* ------------------------- طلب تغيير المستوى/الشعبة ------------------------- */

export interface ScopeRequestView {
  id: string
  status: ScopeRequestStatus
  fromLabel: string | null
  toLabel: string
  reason: string | null
  decisionNote: string | null
  createdAt: Date
  decidedAt: Date | null
}

async function scopeLabel(db: Db, levelId: string | null, streamId: string | null): Promise<string | null> {
  if (!levelId) return null
  const [lv] = await db.select({ name: levels.nameAr }).from(levels).where(eq(levels.id, levelId)).limit(1)
  const [st] = streamId ? await db.select({ name: streams.nameAr }).from(streams).where(eq(streams.id, streamId)).limit(1) : []
  return [lv ? shortLevelName(lv.name) : null, st?.name ?? null].filter(Boolean).join(' · ') || null
}

async function toView(db: Db, r: ScopeChangeRequestRow): Promise<ScopeRequestView> {
  return {
    id: r.id,
    status: r.status as ScopeRequestStatus,
    fromLabel: await scopeLabel(db, r.fromLevelId, r.fromStreamId),
    toLabel: (await scopeLabel(db, r.toLevelId, r.toStreamId)) ?? '—',
    reason: r.reason,
    decisionNote: r.decisionNote,
    createdAt: r.createdAt,
    decidedAt: r.decidedAt
  }
}

/** آخر طلب للتلميذ (المعلَّق، أو آخر قرار) — يُعرض في «حسابي» */
export async function myLatestScopeRequest(db: Db, actor: Actor): Promise<ScopeRequestView | null> {
  const studentId = studentIdOf(actor)
  const [r] = await db.select().from(scopeChangeRequests).where(eq(scopeChangeRequests.studentId, studentId)).orderBy(desc(scopeChangeRequests.createdAt)).limit(1)
  return r ? toView(db, r) : null
}

/** التلميذ يطلب تغيير مستواه/شعبته: طلب واحد معلَّق على الأكثر، ولا طلب لنفس ما هو عليه */
export async function requestScopeChange(db: Db, actor: Actor, input: { levelId: string; streamId?: string | null; reason?: string | null }): Promise<ScopeRequestView> {
  assertRole(actor, 'STUDENT')
  const studentId = studentIdOf(actor)
  const v = await validLevelStream(db, input)
  const cur = await studentScope(db, studentId)
  if (cur.levelId === v.levelId && (cur.streamId ?? null) === v.streamId) throw new AppError('VALIDATION', { field: 'streamId', reason: 'SAME_SCOPE' })
  const [pending] = await db.select({ id: scopeChangeRequests.id }).from(scopeChangeRequests).where(and(eq(scopeChangeRequests.studentId, studentId), eq(scopeChangeRequests.status, 'PENDING'))).limit(1)
  if (pending) throw new AppError('VALIDATION', { field: 'pending', reason: 'ALREADY_PENDING' })
  const [row] = await db
    .insert(scopeChangeRequests)
    .values({ studentId, fromLevelId: cur.levelId, fromStreamId: cur.streamId, toLevelId: v.levelId, toStreamId: v.streamId, reason: input.reason?.trim().slice(0, 300) || null })
    .returning()
  const view = await toView(db, row!)
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'student.scope_request', entityType: 'scope_change_request', entityId: row!.id, newValue: { from: view.fromLabel, to: view.toLabel } })
  const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, 'SUPER_ADMIN'))
  await notifyMany(db, admins.map((a) => ({ userId: a.id, workspaceId: null, type: 'SYSTEM' as const, title: `طلب تغيير شعبة: ${actor.fullName}`, body: `${view.fromLabel ?? '—'} ← ${view.toLabel}`, link: '/admin/scope-requests' })))
  return view
}

/** التلميذ يسحب طلبه المعلَّق */
export async function cancelMyScopeRequest(db: Db, actor: Actor): Promise<void> {
  assertRole(actor, 'STUDENT')
  const studentId = studentIdOf(actor)
  await db.update(scopeChangeRequests).set({ status: 'CANCELLED', decidedAt: new Date(), updatedAt: new Date() }).where(and(eq(scopeChangeRequests.studentId, studentId), eq(scopeChangeRequests.status, 'PENDING')))
}

export interface ScopeRequestRow extends ScopeRequestView {
  studentName: string
  phone: string | null
  decidedBy: string | null
}

/** طابور عون التأكيد (والمشرف): المعلَّقة أولًا بالأقدم، ثم آخر القرارات */
export async function listScopeRequests(db: Db, actor: Actor, status: 'PENDING' | 'DECIDED' = 'PENDING'): Promise<ScopeRequestRow[]> {
  assertRole(actor, 'CONFIRMER', 'SUPER_ADMIN')
  const decider = alias(profiles, 'decider')
  const rows = await db
    .select({ r: scopeChangeRequests, name: profiles.fullName, phone: profiles.phone, decidedBy: decider.fullName })
    .from(scopeChangeRequests)
    .innerJoin(students, eq(students.id, scopeChangeRequests.studentId))
    .leftJoin(profiles, eq(profiles.userId, students.userId))
    .leftJoin(decider, eq(decider.userId, scopeChangeRequests.decidedByUserId))
    .where(status === 'PENDING' ? eq(scopeChangeRequests.status, 'PENDING') : inArray(scopeChangeRequests.status, ['APPROVED', 'REJECTED']))
    .orderBy(status === 'PENDING' ? asc(scopeChangeRequests.createdAt) : desc(scopeChangeRequests.decidedAt))
    .limit(status === 'PENDING' ? 200 : 50)
  return Promise.all(rows.map(async (x) => ({ ...(await toView(db, x.r)), studentName: x.name ?? '—', phone: x.phone, decidedBy: x.decidedBy })))
}

export async function pendingScopeRequestsCount(db: Db): Promise<number> {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(scopeChangeRequests).where(eq(scopeChangeRequests.status, 'PENDING'))
  return Number(r?.n ?? 0)
}

/**
 * عون التأكيد يقبل الطلب (يُطبَّق المستوى والشعبة على الحساب فورًا) أو يرفضه (بسبب إلزامي).
 * طلب غير معلَّق (قُرّر أو سُحب) لا يتغيّر.
 */
export async function decideScopeRequest(db: Db, actor: Actor, id: string, decision: { approve: boolean; note?: string | null }): Promise<ScopeRequestView> {
  assertRole(actor, 'CONFIRMER', 'SUPER_ADMIN')
  assertUuid(id, 'NOT_FOUND')
  const note = decision.note?.trim().slice(0, 300) || null
  if (!decision.approve && !note) throw new AppError('VALIDATION', { field: 'note' })
  const result = await db.transaction(async (tx) => {
    const [r] = await tx.select().from(scopeChangeRequests).where(eq(scopeChangeRequests.id, id)).for('update').limit(1)
    if (!r) throw new AppError('NOT_FOUND')
    if (r.status !== 'PENDING') throw new AppError('VALIDATION', { field: 'status', reason: 'NOT_PENDING' })
    if (decision.approve) {
      // يُعاد التحقق: قد تتغيّر شعب السنة بين الطلب والقرار
      const v = await validLevelStream(tx, { levelId: r.toLevelId, streamId: r.toStreamId })
      await tx.update(students).set({ levelId: v.levelId, streamId: v.streamId }).where(eq(students.id, r.studentId))
    }
    const [u] = await tx
      .update(scopeChangeRequests)
      .set({ status: decision.approve ? 'APPROVED' : 'REJECTED', decidedByUserId: actor.userId, decidedAt: new Date(), decisionNote: note, updatedAt: new Date() })
      .where(eq(scopeChangeRequests.id, id))
      .returning()
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId: null, action: 'student.scope_decide', entityType: 'scope_change_request', entityId: id, newValue: { approve: decision.approve, note } })
    return u!
  })
  const view = await toView(db, result)
  const [st] = await db.select({ userId: students.userId }).from(students).where(eq(students.id, result.studentId)).limit(1)
  if (st) {
    await notify(db, {
      userId: st.userId,
      workspaceId: null,
      type: 'SYSTEM',
      title: decision.approve ? `قُبل طلب تغيير شعبتك: ${view.toLabel}` : 'لم يُقبل طلب تغيير شعبتك',
      body: decision.approve ? 'تظهر لك الآن دروس مستواك وشعبتك الجديدين في «دروسي».' : note,
      link: CHANGE_SCOPE_HREF
    })
  }
  return view
}

/** خيارات نموذج المستوى والشعبة: نفس قوائم التسجيل (شعب كل سنة من grade_streams) */
export async function levelStreamOptions(db: Db) {
  const [lv, st, byLevel] = await Promise.all([listLevels(db), listStreams(db), streamsByLevel(db)])
  return {
    levels: lv.map((l) => ({ id: l.id, name: l.nameAr, secondary: isSecondary(l.code), streamIds: byLevel.get(l.id) ?? [] })),
    streams: st.map((s) => ({ id: s.id, name: s.nameAr }))
  }
}
