/**
 * «حسابي» في تطبيق الآيفون (Build 15، 3 نوفمبر 2026): تتبّع الطلبات، والدعم والشكاوى.
 *
 * الطلبات للتتبّع فقط (قرار المالك وقواعد Apple): حالة الطلب ومراحله ورقم التتبّع لدى شركة التوصيل،
 * دون أي سعر أو طريقة دفع أو إيصال أو زرّ إلغاء أو إعادة طلب — لا شيء يدعو إلى الشراء داخل التطبيق.
 * الدعم: تذاكر التلميذ نفسها التي تصل إلى لوحة الإدارة (support.service)، بلا الملاحظات الداخلية للفريق.
 */
import type { Db } from '@/server/db/connect'
import type { SupportKind } from '@/server/db/schema/enums'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { myOrdersForApp } from './order-tracking.service'
import { getTicket, myTickets, openTicket, replyTicket, setTicketStatus } from './support.service'

const PROVIDER_AR: Record<string, string> = { ecotrack: 'EcoTrack', yalidine: 'Yalidine', generic: 'شركة التوصيل' }

/** حالات لوحة الإدارة بصيغة يفهمها التلميذ («لا يردّ» و«اتصل لاحقًا» تخصّ فريق التأكيد) */
const APP_STATUS_AR: Partial<Record<string, string>> = { PENDING: 'بانتظار التأكيد', NO_ANSWER: 'بانتظار التأكيد', CALL_LATER: 'بانتظار التأكيد' }

/** أنواع التذاكر في التطبيق: كل ما في الموقع إلا «طلب شراء» (لا ذكر للشراء في التطبيق) */
export const IOS_SUPPORT_KINDS = ['DELIVERY', 'ACCESS', 'CONTENT', 'TECHNICAL', 'TEACHER', 'OTHER'] as const satisfies readonly SupportKind[]

function requireStudent(actor: Actor | null): Actor {
  if (!actor) throw new AppError('AUTH_REQUIRED')
  if (actor.role !== 'STUDENT') throw new AppError('FORBIDDEN')
  return actor
}

/** المبالغ والدفع والإيصال والإلغاء لا تصل إلى التطبيق أبدًا */
export async function iosOrders(db: Db, actor: Actor | null) {
  const student = requireStudent(actor)
  const rows = await myOrdersForApp(db, student)
  return {
    orders: rows.map((o) => ({
      id: o.id,
      number: o.number,
      status: o.status,
      statusText: APP_STATUS_AR[o.status] ?? o.statusAr,
      createdAt: o.createdAt.toISOString(),
      items: o.itemsText,
      deliveryProvider: o.deliveryProvider ? (PROVIDER_AR[o.deliveryProvider] ?? o.deliveryProvider) : null,
      trackingId: o.trackingId,
      timeline: o.timeline.map((t) => ({ label: t.label, at: t.at.toISOString(), tone: t.tone }))
    }))
  }
}

export async function iosTickets(db: Db, actor: Actor | null) {
  const student = requireStudent(actor)
  const rows = await myTickets(db, student)
  return {
    tickets: rows.map((t) => ({ id: t.id, number: t.number, kind: t.kind, subject: t.subject, status: t.status, lastMessageAt: t.lastMessageAt.toISOString(), messages: t.messages }))
  }
}

export async function iosTicket(db: Db, actor: Actor | null, id: string) {
  const student = requireStudent(actor)
  const view = await getTicket(db, student, id)
  const t = view.ticket
  return {
    id: t.id,
    number: t.number,
    kind: t.kind,
    subject: t.subject,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
    orderNumber: t.orderNumber,
    courseTitle: t.courseTitle,
    // الملاحظات الداخلية لا تصل أصلًا لغير الطاقم (getTicket)؛ اسم الموظف لا يُعرض: «فريق مدرسة»
    messages: view.messages
      .filter((m) => !m.isInternal)
      .map((m) => ({ id: m.id, mine: m.authorUserId === student.userId, staff: m.isStaff, author: m.isStaff ? null : m.authorName, body: m.body, createdAt: m.createdAt.toISOString() }))
  }
}

export async function iosOpenTicket(db: Db, actor: Actor | null, input: { kind: (typeof IOS_SUPPORT_KINDS)[number]; subject: string; body: string; orderId?: string | null }) {
  const student = requireStudent(actor)
  if (!(IOS_SUPPORT_KINDS as readonly string[]).includes(input.kind)) throw new AppError('VALIDATION', { field: 'kind' })
  const t = await openTicket(db, student, { kind: input.kind, subject: input.subject, body: input.body, orderId: input.orderId ?? null })
  return { id: t.id, number: t.number }
}

export async function iosReplyTicket(db: Db, actor: Actor | null, id: string, body: string) {
  const student = requireStudent(actor)
  return replyTicket(db, student, id, body)
}

export async function iosCloseTicket(db: Db, actor: Actor | null, id: string) {
  const student = requireStudent(actor)
  await setTicketStatus(db, student, id, 'CLOSED')
  return { closed: true }
}
