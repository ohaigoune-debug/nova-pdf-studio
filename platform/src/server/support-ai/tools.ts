/**
 * أدوات مساعد الدعم: كلها مقيَّدة بالتلميذ صاحب التذكرة، ولا تأخذ منه أي معرّف حساب.
 * القراءة: حسابه، دوراته، طلباته وحالة التوصيل، ودروس مستواه وشعبته.
 * الكتابة الوحيدة: تحويل التذكرة إلى موظف مع ملخّص واقتراح (لا تفعيل ولا تغيير شعبة ولا مال — قرار المالك:
 * ما فيه أثر يوافق عليه الموظف). القواعد في الخادم، فلا يفيد إقناع المساعد بشيء خارجها.
 */
import { and, eq } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { levels, profiles, streams, students, users, wilayas } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { listPublicContent } from '@/server/queries/content.queries'
import { myCourses } from '@/server/services/courses.service'
import { myOrdersForApp } from '@/server/services/order-tracking.service'
import { studentScopeOf } from '@/server/services/student-scope.service'
import type { ToolDef } from './client'

export const HANDOFF_REASONS = ['ASKED_FOR_HUMAN', 'NEEDS_ACTION', 'ACCOUNT', 'PAYMENT_OR_ORDER', 'COMPLAINT', 'UNSURE', 'OTHER'] as const
export type HandoffReason = (typeof HANDOFF_REASONS)[number]

export const HANDOFF_REASON_AR: Record<HandoffReason, string> = {
  ASKED_FOR_HUMAN: 'طلب موظفًا',
  NEEDS_ACTION: 'يحتاج إجراءً من الموظف',
  ACCOUNT: 'مشكلة في الحساب',
  PAYMENT_OR_ORDER: 'طلبية أو دفع',
  COMPLAINT: 'شكوى',
  UNSURE: 'المساعد غير متأكد',
  OTHER: 'أخرى'
}

export interface Handoff {
  reason: HandoffReason
  summary: string
  suggestedAction: string | null
}

export interface ToolContext {
  db: Db
  student: Actor
  /** تُملأ إن قرّر المساعد تحويل التذكرة إلى موظف */
  handoff: Handoff | null
}

export const SUPPORT_TOOLS: ToolDef[] = [
  {
    name: 'get_my_account',
    description:
      'يرجع حساب التلميذ صاحب التذكرة: الاسم، المستوى، الشعبة، الولاية، هل هاتفه مؤكَّد، هل له بريد، وتاريخ إنشاء الحساب. ' +
      'استعمله حين يسأل عن حسابه أو التسجيل أو الشعبة أو سبب عدم ظهور دروس. لا يرجع كلمة السر ولا أرقامًا كاملة.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'list_my_courses',
    description:
      'يرجع دورات التلميذ المفعّلة والمنتهية: العنوان، الحالة (ACTIVE أو EXPIRED)، تاريخ نهاية الاشتراك، هل قبل الشروط، الحصة المباشرة القادمة، وعدد الفيديوهات والدروس. ' +
      'استعمله حين يسأل عن دورة أو حصة مباشرة أو فيديو أو تفعيل. إن لم تظهر الدورة هنا فهي غير مفعّلة له: لا تعده بالتفعيل، بل حوّل إلى موظف.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'list_my_orders',
    description:
      'يرجع طلبيات التلميذ: الرقم، الحالة بالعربية، ما فيها، المبلغ عند الاستلام بالدينار، شركة التوصيل ورقم التتبّع، الولاية والبلدية، وآخر مراحل التوصيل. ' +
      'استعمله لكل سؤال عن طلبية أو كتاب أو توصيل. لا تذكر مبلغًا أو موعدًا غير ما يرجعه.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'find_lessons',
    description:
      'يبحث في الدروس المجانية المنشورة لمستوى التلميذ وشعبته بكلمة من العنوان أو الموضوع، ويرجع حتى 8 دروس مع نوعها ورابطها في الموقع. ' +
      'استعمله حين يسأل «أين أجد درس كذا». في التطبيق تُفتح الدروس من «دروسي». إن لم يجد شيئًا فقل ذلك ولا تخترع درسًا.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'كلمة أو كلمتان من عنوان الدرس، مثل «الشعر الحر» أو «الإعراب»' } },
      required: ['query'],
      additionalProperties: false
    }
  },
  {
    name: 'handoff_to_staff',
    description:
      'يحوّل التذكرة إلى موظف الدعم ويوقفك عن الكتابة فيها. استعمله: إن طلب التلميذ موظفًا؛ أو احتاج الحلّ إجراءً لا تملكه ' +
      '(تفعيل دورة، تغيير الشعبة، إلغاء أو تعديل طلبية، استرجاع مال، فك حظر، تغيير رقم الهاتف)؛ أو كانت شكوى؛ أو لم تكن متأكدًا من الجواب. ' +
      'اكتب ملخّصًا قصيرًا للموظف واقتراحك. بعده أخبر التلميذ بلطف أن موظفًا سيتابع تذكرته، دون وعد بنتيجة أو موعد.',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', enum: [...HANDOFF_REASONS] },
        summary: { type: 'string', description: 'ملخّص المشكلة للموظف في سطرين، بما وجدته في المعطيات' },
        suggested_action: { type: 'string', description: 'ما تقترح أن يفعله الموظف (اختياري)' }
      },
      required: ['reason', 'summary'],
      additionalProperties: false
    }
  }
]

const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null)

async function getMyAccount(ctx: ToolContext) {
  const [row] = await ctx.db
    .select({ fullName: profiles.fullName, phone: profiles.phone, phoneVerifiedAt: profiles.phoneVerifiedAt, email: users.email, createdAt: users.createdAt, level: levels.nameAr, stream: streams.nameAr, wilaya: wilayas.nameAr })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .leftJoin(students, eq(students.userId, users.id))
    .leftJoin(levels, eq(levels.id, students.levelId))
    .leftJoin(streams, eq(streams.id, students.streamId))
    .leftJoin(wilayas, eq(wilayas.id, students.wilayaId))
    .where(and(eq(users.id, ctx.student.userId)))
    .limit(1)
  if (!row) return { found: false }
  return {
    fullName: row.fullName,
    level: row.level,
    stream: row.stream,
    wilaya: row.wilaya,
    // آخر رقمين فقط: يكفي للتأكد مع التلميذ دون نشر رقمه في سجلّ النموذج
    phoneEnding: row.phone ? row.phone.slice(-2) : null,
    phoneVerified: Boolean(row.phoneVerifiedAt),
    hasEmail: Boolean(row.email),
    accountCreated: day(row.createdAt)
  }
}

async function listCourses(ctx: ToolContext) {
  const rows = await myCourses(ctx.db, ctx.student)
  return {
    courses: rows.map((c) => ({
      title: c.title,
      season: c.season,
      teacher: c.teacherName,
      status: c.status,
      accessEndsOn: c.accessEndsOn,
      termsAccepted: c.termsAccepted,
      nextLive: c.nextLive ? { title: c.nextLive.title, startsAt: c.nextLive.startsAt.toISOString() } : null,
      videos: c.videos,
      lessons: c.lessons,
      path: c.href
    }))
  }
}

async function listOrders(ctx: ToolContext) {
  const rows = await myOrdersForApp(ctx.db, ctx.student)
  return {
    orders: rows.slice(0, 10).map((o) => ({
      number: o.number,
      status: o.statusAr,
      createdAt: day(o.createdAt),
      items: o.itemsText,
      amountDzd: o.totalDzd,
      deliveryCompany: o.deliveryProvider,
      trackingId: o.trackingId,
      wilaya: o.wilayaName,
      commune: o.commune,
      lastSteps: o.timeline.slice(-4).map((t) => ({ label: t.label, at: t.at.toISOString() }))
    }))
  }
}

async function findLessons(ctx: ToolContext, input: Record<string, unknown>) {
  const query = String(input.query ?? '').trim().slice(0, 60)
  if (query.length < 2) return { lessons: [], note: 'اكتب كلمة من عنوان الدرس' }
  const scope = await studentScopeOf(ctx.db, ctx.student)
  const rows = await listPublicContent(ctx.db, { search: query, levelId: scope?.levelId ?? null, streamIds: scope?.streamFamily ?? [], limit: 8 })
  return { lessons: rows.map((r) => ({ title: r.title, type: r.type, topic: r.topic, path: `/student/lessons/${r.slug}` })) }
}

function handoff(ctx: ToolContext, input: Record<string, unknown>) {
  const reason = (HANDOFF_REASONS as readonly string[]).includes(String(input.reason)) ? (input.reason as HandoffReason) : 'OTHER'
  const summary = String(input.summary ?? '').trim().slice(0, 1200) || '—'
  const suggested = String(input.suggested_action ?? '').trim().slice(0, 600) || null
  ctx.handoff = { reason, summary, suggestedAction: suggested }
  return { ok: true, note: 'سُجّل التحويل. أخبر التلميذ أن موظفًا سيتابع تذكرته، دون وعد بنتيجة أو موعد.' }
}

/** ينفّذ أداة ويرجع نتيجتها نصًّا (JSON مقصوص) — الخطأ يُرجع للنموذج ولا يوقف المحادثة */
export async function runSupportTool(ctx: ToolContext, name: string, input: Record<string, unknown>): Promise<{ content: string; isError: boolean }> {
  try {
    let out: unknown
    switch (name) {
      case 'get_my_account':
        out = await getMyAccount(ctx)
        break
      case 'list_my_courses':
        out = await listCourses(ctx)
        break
      case 'list_my_orders':
        out = await listOrders(ctx)
        break
      case 'find_lessons':
        out = await findLessons(ctx, input)
        break
      case 'handoff_to_staff':
        out = handoff(ctx, input)
        break
      default:
        return { content: `أداة غير معروفة: ${name}`, isError: true }
    }
    return { content: JSON.stringify(out).slice(0, 12_000), isError: false }
  } catch (err) {
    console.error('[support-ai] tool failed', name, err)
    return { content: 'تعذّر جلب هذه المعلومة الآن. لا تخمّن: حوّل التذكرة إلى موظف إن كانت ضرورية للجواب.', isError: true }
  }
}
