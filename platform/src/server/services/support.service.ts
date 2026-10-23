/**
 * مركز الدعم والشكاوى (M8): تذاكر مرقّمة برسائل، تُفتح من أي مستخدم مسجَّل، ويردّ عليها المشرف العام.
 * الشكوى عن أستاذ حساسة: لا يراها إلا SUPER_ADMIN. الأستاذ ومساعده لا يريان التذاكر أبداً.
 * الملاحظات الداخلية بين موظفي الدعم لا تصل إلى صاحب التذكرة.
 */
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { courses, orders, profiles, supportMessages, supportTickets, users, type SupportTicketRow } from '@/server/db/schema'
import type { SupportKind, SupportStatus } from '@/server/db/schema/enums'
import { SUPPORT_KINDS, SUPPORT_STATUSES } from '@/server/db/schema/enums'
import type { Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { notify } from './notifications.service'

export const SUPPORT_KIND_AR: Record<SupportKind, string> = { ORDER: 'طلب شراء', DELIVERY: 'التوصيل', ACCESS: 'الوصول إلى دورة', CONTENT: 'المحتوى', TEACHER: 'شكوى عن أستاذ', TECHNICAL: 'مشكلة تقنية', OTHER: 'أخرى' }
export const SUPPORT_STATUS_AR: Record<SupportStatus, string> = { OPEN: 'مفتوحة', IN_PROGRESS: 'قيد المعالجة', WAITING_USER: 'بانتظار ردّك', RESOLVED: 'حُلّت', CLOSED: 'مغلقة' }

/** طاقم الدعم = المشرف العام فقط (الأستاذ ومساعده لا يريان التذاكر) */
const isStaff = (actor: Actor) => actor.role === 'SUPER_ADMIN'

function assertSubject(s: string): string {
  const v = s.trim()
  if (v.length < 3 || v.length > 200) throw new AppError('VALIDATION', { field: 'subject' })
  return v
}
function assertBody(b: string): string {
  const v = b.trim()
  if (v.length < 2 || v.length > 5000) throw new AppError('VALIDATION', { field: 'body' })
  return v
}

async function loadTicket(db: Db, id: string): Promise<SupportTicketRow> {
  assertUuid(id, 'TICKET_NOT_FOUND')
  const [t] = await db.select().from(supportTickets).where(eq(supportTickets.id, id)).limit(1)
  if (!t) throw new AppError('TICKET_NOT_FOUND')
  return t
}

/** هل يرى الفاعل هذه التذكرة؟ صاحبها دائماً؛ المشرف العام كل شيء */
function canView(actor: Actor, t: SupportTicketRow): boolean {
  if (t.userId === actor.userId) return true
  return isStaff(actor)
}

async function notifyAdmins(db: Db, title: string, body: string, link: string) {
  const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, 'SUPER_ADMIN'))
  for (const a of admins) await notify(db, { userId: a.id, workspaceId: null, type: 'SYSTEM', title, body, link })
}

export interface OpenTicketInput {
  kind: SupportKind
  subject: string
  body: string
  courseId?: string | null
  orderId?: string | null
  fileId?: string | null
}

export async function openTicket(db: Db, actor: Actor, input: OpenTicketInput): Promise<SupportTicketRow> {
  if (!SUPPORT_KINDS.includes(input.kind)) throw new AppError('VALIDATION', { field: 'kind' })
  const subject = assertSubject(input.subject)
  const body = assertBody(input.body)
  if (input.courseId) assertUuid(input.courseId, 'VALIDATION')
  if (input.orderId) {
    assertUuid(input.orderId, 'VALIDATION')
    const [o] = await db.select({ id: orders.id, userId: orders.userId }).from(orders).where(eq(orders.id, input.orderId)).limit(1)
    if (!o || (o.userId !== actor.userId && !isStaff(actor))) throw new AppError('ORDER_NOT_FOUND')
  }
  const isSensitive = input.kind === 'TEACHER'
  const ticket = await db.transaction(async (tx) => {
    const [t] = await tx.insert(supportTickets).values({ userId: actor.userId, courseId: input.courseId ?? null, orderId: input.orderId ?? null, kind: input.kind, subject, isSensitive, status: 'OPEN' }).returning()
    if (!t) throw new AppError('INTERNAL')
    await tx.insert(supportMessages).values({ ticketId: t.id, authorUserId: actor.userId, body, fileId: input.fileId ?? null, isInternal: false })
    return t
  })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'support.open', entityType: 'support_ticket', entityId: ticket.id, newValue: { number: ticket.number, kind: input.kind, isSensitive } })
  await notifyAdmins(db, `تذكرة جديدة #${ticket.number}${isSensitive ? ' (حساسة)' : ''}`, `${SUPPORT_KIND_AR[input.kind]} · ${subject}`, `/admin/support/${ticket.id}`)
  return ticket
}

const USER_PORTAL: Partial<Record<string, string>> = { STUDENT: '/student/support', TEACHER: '/teacher/support', PARENT: '/support', PUBLIC: '/support' }

async function ownerLink(db: Db, ticket: SupportTicketRow): Promise<string> {
  const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, ticket.userId)).limit(1)
  return `${USER_PORTAL[u?.role ?? 'STUDENT'] ?? '/student/support'}/${ticket.id}`
}

export async function replyTicket(db: Db, actor: Actor, ticketId: string, body: string, opts: { internal?: boolean; fileId?: string | null } = {}): Promise<{ id: string }> {
  const t = await loadTicket(db, ticketId)
  if (!canView(actor, t)) throw new AppError('TICKET_NOT_FOUND')
  const text = assertBody(body)
  const staff = isStaff(actor)
  const internal = Boolean(opts.internal)
  if (internal && !staff) throw new AppError('FORBIDDEN')
  if (t.status === 'CLOSED' && !staff) throw new AppError('TICKET_CLOSED')
  const now = new Date()
  const [m] = await db.insert(supportMessages).values({ ticketId: t.id, authorUserId: actor.userId, body: text, fileId: opts.fileId ?? null, isInternal: internal }).returning({ id: supportMessages.id })
  if (!m) throw new AppError('INTERNAL')
  // ردّ الموظف يضع التذكرة «بانتظار المستخدم»، وردّ صاحبها يعيدها إلى «مفتوحة» — الملاحظة الداخلية لا تغيّر شيئاً
  const cur = t.status as SupportStatus
  const nextStatus: SupportStatus | null = internal ? null : staff ? (cur === 'RESOLVED' || cur === 'CLOSED' ? cur : 'WAITING_USER') : cur === 'WAITING_USER' || cur === 'RESOLVED' ? 'OPEN' : cur
  await db
    .update(supportTickets)
    .set({ lastMessageAt: internal ? t.lastMessageAt : now, status: nextStatus ?? t.status, updatedAt: now })
    .where(eq(supportTickets.id, t.id))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'support.reply', entityType: 'support_ticket', entityId: t.id, newValue: { number: t.number, internal } })
  if (!internal) {
    if (staff && t.userId !== actor.userId) await notify(db, { userId: t.userId, workspaceId: null, type: 'SYSTEM', title: `ردّ على تذكرتك #${t.number}`, body: text.slice(0, 160), link: await ownerLink(db, t) })
    else if (!staff) await notifyAdmins(db, `ردّ جديد على التذكرة #${t.number}`, text.slice(0, 160), `/admin/support/${t.id}`)
  }
  return { id: m.id }
}

export async function setTicketStatus(db: Db, actor: Actor, ticketId: string, status: SupportStatus): Promise<void> {
  const t = await loadTicket(db, ticketId)
  if (!SUPPORT_STATUSES.includes(status)) throw new AppError('VALIDATION', { field: 'status' })
  const staff = isStaff(actor)
  // صاحب التذكرة يستطيع إغلاقها أو إعادة فتحها فقط
  if (!staff) {
    if (t.userId !== actor.userId) throw new AppError('TICKET_NOT_FOUND')
    if (status !== 'CLOSED' && status !== 'OPEN') throw new AppError('FORBIDDEN')
  }
  const now = new Date()
  await db
    .update(supportTickets)
    .set({ status, closedAt: status === 'CLOSED' || status === 'RESOLVED' ? now : null, updatedAt: now })
    .where(eq(supportTickets.id, t.id))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'support.status', entityType: 'support_ticket', entityId: t.id, oldValue: { status: t.status }, newValue: { status } })
  if (staff && t.userId !== actor.userId && status !== t.status) await notify(db, { userId: t.userId, workspaceId: null, type: 'SYSTEM', title: `تذكرتك #${t.number}: ${SUPPORT_STATUS_AR[status]}`, body: t.subject, link: await ownerLink(db, t) })
}

export async function assignTicket(db: Db, actor: Actor, ticketId: string, assigneeUserId: string | null): Promise<void> {
  if (!isStaff(actor)) throw new AppError('FORBIDDEN')
  const t = await loadTicket(db, ticketId)
  if (assigneeUserId) {
    assertUuid(assigneeUserId, 'VALIDATION')
    const [u] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, assigneeUserId)).limit(1)
    if (!u || u.role !== 'SUPER_ADMIN') throw new AppError('VALIDATION', { field: 'assigneeUserId' })
  }
  await db
    .update(supportTickets)
    .set({ assignedToUserId: assigneeUserId, status: t.status === 'OPEN' && assigneeUserId ? 'IN_PROGRESS' : t.status, updatedAt: new Date() })
    .where(eq(supportTickets.id, t.id))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'support.assign', entityType: 'support_ticket', entityId: t.id, newValue: { assigneeUserId } })
}

export interface TicketListRow {
  id: string
  number: number
  kind: SupportKind
  subject: string
  status: SupportStatus
  isSensitive: boolean
  lastMessageAt: Date
  createdAt: Date
  messages: number
}

export async function myTickets(db: Db, actor: Actor): Promise<TicketListRow[]> {
  const rows = await db
    .select({ id: supportTickets.id, number: supportTickets.number, kind: supportTickets.kind, subject: supportTickets.subject, status: supportTickets.status, isSensitive: supportTickets.isSensitive, lastMessageAt: supportTickets.lastMessageAt, createdAt: supportTickets.createdAt, messages: sql<number>`(select count(*)::int from support_messages m where m.ticket_id = support_tickets.id and m.is_internal = false)` })
    .from(supportTickets)
    .where(eq(supportTickets.userId, actor.userId))
    .orderBy(desc(supportTickets.lastMessageAt))
    .limit(200)
  return rows as TicketListRow[]
}

export interface TicketView {
  ticket: SupportTicketRow & { ownerName: string; ownerEmail: string; ownerRole: string; assigneeName: string | null; courseTitle: string | null; orderNumber: string | null }
  messages: { id: string; authorUserId: string; authorName: string; isStaff: boolean; isInternal: boolean; body: string; fileId: string | null; createdAt: Date }[]
  /** هل الفاعل من طاقم الدعم (يرى الداخلي ويغيّر الحالة) */
  staff: boolean
}

export async function getTicket(db: Db, actor: Actor, ticketId: string): Promise<TicketView> {
  const t = await loadTicket(db, ticketId)
  if (!canView(actor, t)) throw new AppError('TICKET_NOT_FOUND')
  const staff = isStaff(actor)
  const [owner] = await db.select({ name: profiles.fullName, email: users.email, role: users.role }).from(users).leftJoin(profiles, eq(profiles.userId, users.id)).where(eq(users.id, t.userId)).limit(1)
  const assignee = t.assignedToUserId ? (await db.select({ name: profiles.fullName }).from(profiles).where(eq(profiles.userId, t.assignedToUserId)).limit(1))[0] : null
  const course = t.courseId ? (await db.select({ title: courses.title }).from(courses).where(eq(courses.id, t.courseId)).limit(1))[0] : null
  const order = t.orderId ? (await db.select({ number: orders.number }).from(orders).where(eq(orders.id, t.orderId)).limit(1))[0] : null
  const msgs = await db
    .select({ id: supportMessages.id, authorUserId: supportMessages.authorUserId, authorName: profiles.fullName, authorRole: users.role, isInternal: supportMessages.isInternal, body: supportMessages.body, fileId: supportMessages.fileId, createdAt: supportMessages.createdAt })
    .from(supportMessages)
    .innerJoin(users, eq(users.id, supportMessages.authorUserId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(staff ? eq(supportMessages.ticketId, t.id) : and(eq(supportMessages.ticketId, t.id), eq(supportMessages.isInternal, false)))
    .orderBy(supportMessages.createdAt)
  return {
    ticket: { ...t, ownerName: owner?.name ?? '—', ownerEmail: owner?.email ?? '', ownerRole: owner?.role ?? 'STUDENT', assigneeName: assignee?.name ?? null, courseTitle: course?.title ?? null, orderNumber: order?.number ?? null },
    messages: msgs.map((m) => ({ id: m.id, authorUserId: m.authorUserId, authorName: m.authorName ?? (m.authorRole === 'SUPER_ADMIN' ? 'فريق الدعم' : '—'), isStaff: m.authorRole === 'SUPER_ADMIN', isInternal: m.isInternal, body: m.body, fileId: m.fileId, createdAt: m.createdAt })),
    staff
  }
}

export interface AdminTicketRow extends TicketListRow {
  ownerName: string
  ownerEmail: string
  assignedToUserId: string | null
  assigneeName: string | null
}

export async function listTicketsAdmin(db: Db, actor: Actor, f: { status?: SupportStatus | null; kind?: SupportKind | null; assignedToUserId?: string | null; q?: string | null } = {}): Promise<AdminTicketRow[]> {
  if (!isStaff(actor)) throw new AppError('FORBIDDEN')
  const conds = []
  if (f.status) conds.push(eq(supportTickets.status, f.status))
  if (f.kind) conds.push(eq(supportTickets.kind, f.kind))
  if (f.assignedToUserId) conds.push(eq(supportTickets.assignedToUserId, f.assignedToUserId))
  if (f.q?.trim()) conds.push(sql`(${supportTickets.subject} ilike ${'%' + f.q.trim() + '%'} or ${supportTickets.number}::text = ${f.q.trim()})`)
  const rows = await db
    .select({ id: supportTickets.id, number: supportTickets.number, kind: supportTickets.kind, subject: supportTickets.subject, status: supportTickets.status, isSensitive: supportTickets.isSensitive, lastMessageAt: supportTickets.lastMessageAt, createdAt: supportTickets.createdAt, assignedToUserId: supportTickets.assignedToUserId, ownerName: profiles.fullName, ownerEmail: users.email, messages: sql<number>`(select count(*)::int from support_messages m where m.ticket_id = support_tickets.id)` })
    .from(supportTickets)
    .innerJoin(users, eq(users.id, supportTickets.userId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(supportTickets.lastMessageAt))
    .limit(300)
  const assigneeIds = [...new Set(rows.map((r) => r.assignedToUserId).filter((x): x is string => !!x))]
  const names = assigneeIds.length ? await db.select({ userId: profiles.userId, name: profiles.fullName }).from(profiles).where(inArray(profiles.userId, assigneeIds)) : []
  const nameOf = new Map(names.map((n) => [n.userId, n.name]))
  return rows.map((r) => ({ ...(r as unknown as TicketListRow), ownerName: r.ownerName ?? '—', ownerEmail: r.ownerEmail, assignedToUserId: r.assignedToUserId, assigneeName: r.assignedToUserId ? (nameOf.get(r.assignedToUserId) ?? null) : null }))
}

export async function supportStats(db: Db, actor: Actor) {
  if (!isStaff(actor)) throw new AppError('FORBIDDEN')
  const [r] = await db
    .select({
      open: sql<number>`count(*) filter (where ${supportTickets.status} = 'OPEN')::int`,
      inProgress: sql<number>`count(*) filter (where ${supportTickets.status} = 'IN_PROGRESS')::int`,
      waiting: sql<number>`count(*) filter (where ${supportTickets.status} = 'WAITING_USER')::int`,
      sensitive: sql<number>`count(*) filter (where ${supportTickets.isSensitive} and ${supportTickets.status} not in ('RESOLVED','CLOSED'))::int`,
      total: sql<number>`count(*)::int`
    })
    .from(supportTickets)
  return { open: r?.open ?? 0, inProgress: r?.inProgress ?? 0, waiting: r?.waiting ?? 0, sensitive: r?.sensitive ?? 0, total: r?.total ?? 0 }
}

/** المشرفون (للإسناد) */
export async function supportAgents(db: Db, actor: Actor): Promise<{ id: string; name: string }[]> {
  if (!isStaff(actor)) throw new AppError('FORBIDDEN')
  const rows = await db.select({ id: users.id, name: profiles.fullName }).from(users).leftJoin(profiles, eq(profiles.userId, users.id)).where(and(eq(users.role, 'SUPER_ADMIN'), eq(users.status, 'ACTIVE')))
  return rows.map((r) => ({ id: r.id, name: r.name ?? 'مشرف' }))
}
