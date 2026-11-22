/**
 * الحصص المباشرة (Zoom/Meet/YouTube) داخل الدورات المدفوعة:
 * - رابط الانضمام مختوم في القاعدة ولا يُفتح إلا للمشترك النشط الذي قبل الشروط، داخل نافذة الحصة
 *   (من 15 دقيقة قبل الموعد إلى 30 دقيقة بعد نهايتها). كل فتح يُسجَّل في التدقيق `live.join` = حضور البث.
 * - تذكير قبل 30 دقيقة (مهمة LIVE_REMINDERS كل 10 دقائق): إشعار داخلي + Web Push إن كان مضبوطاً.
 */
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { auditLogs, content, courseEnrollments, courses, jobs, liveSessions, students } from '@/server/db/schema'
import type { LiveProvider, LiveSessionStatus } from '@/server/db/schema/enums'
import { LIVE_PROVIDERS, LIVE_SESSION_STATUSES } from '@/server/db/schema/enums'
import { enqueueJob } from '@/server/jobs/queue'
import { assertRole, studentIdOf, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { seal, unseal } from '@/server/lib/secret-box'
import { zoomMeetingNumber, zoomSdkKeys, zoomSdkSignature } from '@/server/lib/zoom-sdk'
import { notifyMany } from './notifications.service'
import { createZoomMeeting, deleteZoomMeeting, updateZoomMeeting, zoomHostZak } from './zoom-oauth.service'

const PURPOSE = 'live'
export const JOIN_OPENS_BEFORE_MS = 15 * 60_000
export const JOIN_CLOSES_AFTER_MS = 30 * 60_000
export const REMINDER_WINDOW_MIN_MS = 30 * 60_000
export const REMINDER_WINDOW_MAX_MS = 40 * 60_000
export const LIVE_REMINDERS_INTERVAL_MS = 10 * 60_000
const UPCOMING_DAYS = 14

export const LIVE_PROVIDER_AR: Record<LiveProvider, string> = { ZOOM: 'Zoom', MEET: 'Google Meet', YOUTUBE: 'بث يوتيوب', OTHER: 'آخر' }
export const LIVE_STATUS_AR: Record<LiveSessionStatus, string> = { SCHEDULED: 'مجدولة', LIVE: 'على الهواء', ENDED: 'انتهت', CANCELLED: 'ملغاة' }

export interface LiveSessionInput {
  courseId: string
  title: string
  description?: string | null
  startsAt: Date
  durationMinutes?: number
  provider?: LiveProvider
  joinUrl?: string | null
  providerMeetingId?: string | null
  /** رمز اجتماع Zoom (Passcode) لدخول الحصة داخل المنصة؛ يُحفظ مشفّرًا. undefined = لا تغيير */
  meetingPasscode?: string | null
  /** إنشاء: تُنشئ المنصة اجتماع Zoom في الحساب المربوط (لا رابط ولا رمز يُلصق) */
  autoZoom?: boolean
}

type ZoomOpts = { fetchImpl?: typeof fetch }

export type LiveSessionView = Omit<typeof liveSessions.$inferSelect, 'joinUrlSealed' | 'meetingPasscodeSealed'> & { hasJoinUrl: boolean; hasPasscode: boolean; courseTitle: string }

function strip(row: typeof liveSessions.$inferSelect, courseTitle: string): LiveSessionView {
  const { joinUrlSealed, meetingPasscodeSealed, ...rest } = row
  return { ...rest, hasJoinUrl: !!joinUrlSealed, hasPasscode: !!meetingPasscodeSealed, courseTitle }
}

function sealPasscode(v: string | null | undefined): string | null {
  const p = v?.trim()
  if (!p) return null
  if (p.length > 40) throw new AppError('VALIDATION', { field: 'meetingPasscode' })
  return seal(p, PURPOSE)
}

/** المشرف: كل الدورات. الأستاذ: دورات مساحته فقط. */
async function assertCourseAccess(db: Db, actor: Actor, courseId: string) {
  assertRole(actor, 'SUPER_ADMIN', 'TEACHER')
  assertUuid(courseId, 'NOT_FOUND')
  const [c] = await db.select().from(courses).where(and(eq(courses.id, courseId), isNull(courses.deletedAt))).limit(1)
  if (!c) throw new AppError('NOT_FOUND')
  if (actor.role === 'TEACHER' && c.workspaceId !== actor.workspaceId) throw new AppError('FORBIDDEN')
  return c
}

async function loadSession(db: Db, id: string) {
  assertUuid(id, 'LIVE_NOT_FOUND')
  const [row] = await db
    .select({ s: liveSessions, courseTitle: courses.title, workspaceId: courses.workspaceId })
    .from(liveSessions)
    .innerJoin(courses, eq(courses.id, liveSessions.courseId))
    .where(eq(liveSessions.id, id))
    .limit(1)
  if (!row) throw new AppError('LIVE_NOT_FOUND')
  return row
}

function validateUrl(url: string | null | undefined): string | null {
  const v = url?.trim()
  if (!v) return null
  let u: URL
  try {
    u = new URL(v)
  } catch {
    throw new AppError('VALIDATION', { field: 'joinUrl' })
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new AppError('VALIDATION', { field: 'joinUrl' })
  return u.toString()
}

export async function createLiveSession(db: Db, actor: Actor, input: LiveSessionInput, opts: ZoomOpts = {}): Promise<LiveSessionView> {
  const course = await assertCourseAccess(db, actor, input.courseId)
  const title = input.title.trim()
  if (!title) throw new AppError('VALIDATION', { field: 'title' })
  if (!(input.startsAt instanceof Date) || Number.isNaN(input.startsAt.getTime())) throw new AppError('VALIDATION', { field: 'startsAt' })
  const duration = Math.max(10, Math.min(600, Math.floor(input.durationMinutes ?? 90)))
  const provider = input.provider ?? 'ZOOM'
  if (!LIVE_PROVIDERS.includes(provider)) throw new AppError('VALIDATION', { field: 'provider' })
  let url = validateUrl(input.joinUrl)
  let providerMeetingId = input.providerMeetingId?.trim() || null
  let passcode = input.meetingPasscode
  let zoomAuto = false
  // اجتماع Zoom تُنشئه المنصة نفسها (22 نوفمبر 2026): قبل الحفظ، ويُحذف إن فشل الحفظ
  if (input.autoZoom && provider === 'ZOOM' && !url) {
    const m = await createZoomMeeting(db, { topic: `${course.title} — ${title}`, startsAt: input.startsAt, durationMinutes: duration }, opts)
    url = validateUrl(m.joinUrl)
    providerMeetingId = m.meetingId
    passcode = m.passcode || null
    zoomAuto = true
  }
  const insertSession = () =>
    db.transaction(async (tx) => {
      const [row] = await tx
        .insert(liveSessions)
        .values({
          courseId: course.id,
          title,
          description: input.description?.trim() || null,
          startsAt: input.startsAt,
          durationMinutes: duration,
          provider,
          joinUrlSealed: url ? seal(url, PURPOSE) : null,
          providerMeetingId,
          meetingPasscodeSealed: sealPasscode(passcode),
          zoomAuto
        })
        .returning()
      if (!row) throw new AppError('INTERNAL')
      await writeAudit(tx, { actorUserId: actor.userId, workspaceId: course.workspaceId, action: 'live.create', entityType: 'live_session', entityId: row.id, newValue: { courseId: course.id, title, startsAt: input.startsAt.toISOString(), provider, zoomAuto } })
      return strip(row, course.title)
    })
  try {
    return await insertSession()
  } catch (e) {
    if (zoomAuto && providerMeetingId) await deleteZoomMeeting(db, providerMeetingId, opts).catch(() => undefined)
    throw e
  }
}

export async function updateLiveSession(db: Db, actor: Actor, id: string, input: Partial<LiveSessionInput>, opts: ZoomOpts = {}): Promise<LiveSessionView> {
  const { s, courseTitle, workspaceId } = await loadSession(db, id)
  await assertCourseAccess(db, actor, s.courseId)
  const patch: Partial<typeof liveSessions.$inferInsert> = { updatedAt: new Date() }
  if (input.courseId !== undefined && input.courseId !== s.courseId) {
    await assertCourseAccess(db, actor, input.courseId)
    patch.courseId = input.courseId
  }
  if (input.title !== undefined) {
    const t = input.title.trim()
    if (!t) throw new AppError('VALIDATION', { field: 'title' })
    patch.title = t
  }
  if (input.description !== undefined) patch.description = input.description?.trim() || null
  if (input.startsAt !== undefined) {
    if (!(input.startsAt instanceof Date) || Number.isNaN(input.startsAt.getTime())) throw new AppError('VALIDATION', { field: 'startsAt' })
    patch.startsAt = input.startsAt
    // موعد جديد ⇒ تذكير جديد
    if (input.startsAt.getTime() !== s.startsAt.getTime()) patch.reminderSentAt = null
  }
  if (input.durationMinutes !== undefined) patch.durationMinutes = Math.max(10, Math.min(600, Math.floor(input.durationMinutes)))
  if (input.provider !== undefined) {
    if (!LIVE_PROVIDERS.includes(input.provider)) throw new AppError('VALIDATION', { field: 'provider' })
    patch.provider = input.provider
  }
  if (input.joinUrl !== undefined) {
    const url = validateUrl(input.joinUrl)
    patch.joinUrlSealed = url ? seal(url, PURPOSE) : null
    // رابط ملصوق يدويًا مكان اجتماع المنصة: لم تعد المنصة تدير الاجتماع
    if (s.zoomAuto) patch.zoomAuto = false
  }
  if (input.providerMeetingId !== undefined) patch.providerMeetingId = input.providerMeetingId?.trim() || null
  if (input.meetingPasscode !== undefined) patch.meetingPasscodeSealed = sealPasscode(input.meetingPasscode)
  const view = await db.transaction(async (tx) => {
    const [row] = await tx.update(liveSessions).set(patch).where(eq(liveSessions.id, s.id)).returning()
    if (!row) throw new AppError('INTERNAL')
    const { joinUrlSealed: _omit, meetingPasscodeSealed: _omit2, ...safePatch } = patch
    void _omit
    void _omit2
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId, action: 'live.update', entityType: 'live_session', entityId: s.id, oldValue: { title: s.title, startsAt: s.startsAt.toISOString() }, newValue: { ...safePatch, joinUrlChanged: input.joinUrl !== undefined, passcodeChanged: input.meetingPasscode !== undefined } as Record<string, unknown> })
    return strip(row, courseTitle)
  })
  // اجتماع أنشأته المنصة: العنوان والموعد والمدة تُحدَّث في Zoom أيضًا (أفضل جهد: Zoom يسمح ببدء الاجتماع في أي وقت)
  const changed = view.title !== s.title || view.startsAt.getTime() !== s.startsAt.getTime() || view.durationMinutes !== s.durationMinutes
  if (view.zoomAuto && view.providerMeetingId && changed) {
    await updateZoomMeeting(db, view.providerMeetingId, { topic: `${courseTitle} — ${view.title}`, startsAt: view.startsAt, durationMinutes: view.durationMinutes }, opts).catch((e) => {
      if (process.env.NODE_ENV !== 'test') console.error('[live] zoom update failed', e instanceof Error ? e.message : e)
    })
  }
  return view
}

export async function setLiveStatus(db: Db, actor: Actor, id: string, status: LiveSessionStatus, opts: ZoomOpts = {}): Promise<LiveSessionView> {
  if (!LIVE_SESSION_STATUSES.includes(status)) throw new AppError('VALIDATION', { field: 'status' })
  const { s, courseTitle, workspaceId } = await loadSession(db, id)
  await assertCourseAccess(db, actor, s.courseId)
  return db.transaction(async (tx) => {
    const [row] = await tx.update(liveSessions).set({ status, updatedAt: new Date() }).where(eq(liveSessions.id, s.id)).returning()
    if (!row) throw new AppError('INTERNAL')
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId, action: 'live.status', entityType: 'live_session', entityId: s.id, oldValue: { status: s.status }, newValue: { status } })
    return strip(row, courseTitle)
  }).then(async (view) => {
    // إلغاء حصة أنشأت المنصة اجتماعها ⇒ حذفه من Zoom (أفضل جهد)
    if (status === 'CANCELLED' && s.status !== 'CANCELLED' && s.zoomAuto && s.providerMeetingId) {
      await deleteZoomMeeting(db, s.providerMeetingId, opts).catch((e) => {
        if (process.env.NODE_ENV !== 'test') console.error('[live] zoom delete failed', e instanceof Error ? e.message : e)
      })
    }
    return view
  })
}

/** ربط تسجيل الحصة: محتوى فيديو موجّه لفوج الدورة (أو عام) */
export async function attachRecording(db: Db, actor: Actor, id: string, recordingContentId: string | null): Promise<LiveSessionView> {
  const { s, courseTitle, workspaceId } = await loadSession(db, id)
  const course = await assertCourseAccess(db, actor, s.courseId)
  if (recordingContentId) {
    assertUuid(recordingContentId, 'CONTENT_NOT_FOUND')
    const [c] = await db
      .select({ id: content.id, type: content.type, workspaceId: content.workspaceId })
      .from(content)
      .where(and(eq(content.id, recordingContentId), isNull(content.deletedAt)))
      .limit(1)
    if (!c || c.type !== 'VIDEO') throw new AppError('CONTENT_NOT_FOUND')
    if (c.workspaceId && c.workspaceId !== course.workspaceId) throw new AppError('CONTENT_NOT_FOUND')
  }
  return db.transaction(async (tx) => {
    const [row] = await tx.update(liveSessions).set({ recordingContentId, updatedAt: new Date() }).where(eq(liveSessions.id, s.id)).returning()
    if (!row) throw new AppError('INTERNAL')
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId, action: 'live.update', entityType: 'live_session', entityId: s.id, oldValue: { recordingContentId: s.recordingContentId }, newValue: { recordingContentId } })
    return strip(row, courseTitle)
  })
}

/** فيديوهات الدورة الصالحة كتسجيل (نفس مساحة الدورة أو عامة) */
export async function recordingCandidates(db: Db, actor: Actor, courseId: string): Promise<{ id: string; title: string }[]> {
  const course = await assertCourseAccess(db, actor, courseId)
  return db
    .select({ id: content.id, title: content.title })
    .from(content)
    .where(and(eq(content.type, 'VIDEO'), isNull(content.deletedAt), course.workspaceId ? sql`(${content.workspaceId} = ${course.workspaceId} or ${content.workspaceId} is null)` : sql`true`))
    .orderBy(desc(content.createdAt))
    .limit(200)
}

export async function listLiveAdmin(db: Db, actor: Actor, filter: { courseId?: string | null; from?: Date | null } = {}): Promise<LiveSessionView[]> {
  assertRole(actor, 'SUPER_ADMIN', 'TEACHER')
  const conds = []
  if (filter.courseId) {
    assertUuid(filter.courseId, 'NOT_FOUND')
    conds.push(eq(liveSessions.courseId, filter.courseId))
  }
  if (filter.from) conds.push(gte(liveSessions.startsAt, filter.from))
  if (actor.role === 'TEACHER') conds.push(eq(courses.workspaceId, actor.workspaceId ?? ''))
  const rows = await db
    .select({ s: liveSessions, courseTitle: courses.title })
    .from(liveSessions)
    .innerJoin(courses, eq(courses.id, liveSessions.courseId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(liveSessions.startsAt))
    .limit(300)
  return rows.map((r) => strip(r.s, r.courseTitle))
}

export async function getLiveAdmin(db: Db, actor: Actor, id: string): Promise<LiveSessionView & { joinUrl: string | null }> {
  const { s, courseTitle } = await loadSession(db, id)
  await assertCourseAccess(db, actor, s.courseId)
  return { ...strip(s, courseTitle), joinUrl: s.joinUrlSealed ? unseal(s.joinUrlSealed, PURPOSE) : null }
}

/** الدورات المتاحة للاختيار في نموذج الإدارة (المشرف: الكل؛ الأستاذ: مساحته) */
export async function coursesForLiveForm(db: Db, actor: Actor): Promise<{ id: string; title: string; season: string }[]> {
  assertRole(actor, 'SUPER_ADMIN', 'TEACHER')
  return db
    .select({ id: courses.id, title: courses.title, season: courses.season })
    .from(courses)
    .where(and(isNull(courses.deletedAt), actor.role === 'TEACHER' ? eq(courses.workspaceId, actor.workspaceId ?? '') : undefined))
    .orderBy(asc(courses.title))
}

export interface UpcomingLive {
  id: string
  courseId: string
  courseTitle: string
  title: string
  description: string | null
  startsAt: Date
  durationMinutes: number
  provider: LiveProvider
  status: LiveSessionStatus
  recordingContentId: string | null
  /** هل قبل التلميذ الشروط (شرط للانضمام) */
  termsAccepted: boolean
}

/** حصص الأيام الـ14 القادمة لدورات التلميذ النشطة (SCHEDULED/LIVE) */
export async function upcomingForStudent(db: Db, actor: Actor, now: Date = new Date()): Promise<UpcomingLive[]> {
  const studentId = studentIdOf(actor)
  const horizon = new Date(now.getTime() + UPCOMING_DAYS * 86_400_000)
  const rows = await db
    .select({ s: liveSessions, courseTitle: courses.title, acceptedTermsAt: courseEnrollments.acceptedTermsAt })
    .from(liveSessions)
    .innerJoin(courses, eq(courses.id, liveSessions.courseId))
    .innerJoin(courseEnrollments, and(eq(courseEnrollments.courseId, liveSessions.courseId), eq(courseEnrollments.studentId, studentId), eq(courseEnrollments.status, 'ACTIVE')))
    .where(
      and(
        inArray(liveSessions.status, ['SCHEDULED', 'LIVE']),
        lte(liveSessions.startsAt, horizon),
        // ما زالت نافذة الانضمام مفتوحة أو لم تبدأ بعد
        sql`${liveSessions.startsAt} + make_interval(mins => ${liveSessions.durationMinutes} + 30) >= ${now}`
      )
    )
    .orderBy(asc(liveSessions.startsAt))
    .limit(20)
  return rows.map((r) => ({
    id: r.s.id,
    courseId: r.s.courseId,
    courseTitle: r.courseTitle,
    title: r.s.title,
    description: r.s.description,
    startsAt: r.s.startsAt,
    durationMinutes: r.s.durationMinutes,
    provider: r.s.provider as LiveProvider,
    status: r.s.status as LiveSessionStatus,
    recordingContentId: r.s.recordingContentId,
    termsAccepted: !!r.acceptedTermsAt
  }))
}

export function joinWindow(startsAt: Date, durationMinutes: number): { opensAt: Date; closesAt: Date } {
  return { opensAt: new Date(startsAt.getTime() - JOIN_OPENS_BEFORE_MS), closesAt: new Date(startsAt.getTime() + durationMinutes * 60_000 + JOIN_CLOSES_AFTER_MS) }
}

/**
 * رابط الانضمام للتلميذ: مشترك نشط + قبل الشروط + داخل النافذة. يُسجَّل `live.join` (حضور البث).
 */
export async function joinInfo(db: Db, actor: Actor, sessionId: string, now: Date = new Date()): Promise<{ url: string; provider: LiveProvider; title: string }> {
  const studentId = studentIdOf(actor)
  const { s, workspaceId } = await loadSession(db, sessionId)
  const [enr] = await db
    .select({ status: courseEnrollments.status, acceptedTermsAt: courseEnrollments.acceptedTermsAt, expiresAt: courseEnrollments.expiresAt })
    .from(courseEnrollments)
    .where(and(eq(courseEnrollments.courseId, s.courseId), eq(courseEnrollments.studentId, studentId)))
    .limit(1)
  if (!enr || enr.status !== 'ACTIVE' || (enr.expiresAt && enr.expiresAt < now)) throw new AppError('COURSE_NOT_ENROLLED')
  if (!enr.acceptedTermsAt) throw new AppError('LIVE_NOT_OPEN')
  if (s.status === 'CANCELLED' || s.status === 'ENDED') throw new AppError('LIVE_NOT_OPEN')
  const { opensAt, closesAt } = joinWindow(s.startsAt, s.durationMinutes)
  if (now < opensAt || now > closesAt) throw new AppError('LIVE_NOT_OPEN')
  const url = s.joinUrlSealed ? unseal(s.joinUrlSealed, PURPOSE) : null
  if (!url) throw new AppError('LIVE_NOT_OPEN')
  await writeAudit(db, { actorUserId: actor.userId, workspaceId, action: 'live.join', entityType: 'live_session', entityId: s.id, newValue: { studentId, sessionId: s.id, at: now.toISOString() } })
  return { url, provider: s.provider as LiveProvider, title: s.title }
}

/** هل تُفتح هذه الحصة داخل المنصة بـ Zoom Meeting SDK؟ (المفتاحان على الخادم + Zoom + رقم اجتماع مقروء) */
export function liveEmbeddable(provider: string, joinUrl: string | null, providerMeetingId?: string | null): boolean {
  return provider === 'ZOOM' && zoomSdkKeys() !== null && zoomMeetingNumber(joinUrl, providerMeetingId) !== null
}

/** انضمام التلميذ من الموقع: كـ joinInfo، ومعه مسار الدخول داخل المنصة إن أمكن (وإلا يُفتح الرابط كما كان) */
export async function joinLiveWeb(db: Db, actor: Actor, sessionId: string, now: Date = new Date()): Promise<{ url: string; provider: LiveProvider; title: string; embedPath: string | null }> {
  const info = await joinInfo(db, actor, sessionId, now)
  const { s } = await loadSession(db, sessionId)
  return { ...info, embedPath: liveEmbeddable(info.provider, info.url, s.providerMeetingId) ? `/live/${s.id}` : null }
}

/**
 * رابط تطبيق Zoom على آيفون (zoomus://) باسم التلميذ في حسابه ورمز الاجتماع، فيدخل مباشرة دون كتابة شيء.
 * لا بريد ولا هاتف. null إن لم يكن رقم الاجتماع مقروءًا (رابط غير Zoom).
 */
export function zoomIosAppUrl(meetingNumber: string | null, passcode: string | null, userName: string): string | null {
  if (!meetingNumber) return null
  const q = new URLSearchParams({ action: 'join', confno: meetingNumber })
  if (passcode) q.set('pwd', passcode)
  const name = userName.trim().slice(0, 60)
  if (name) q.set('uname', name)
  return `zoomus://zoom.us/join?${q.toString()}`
}

/**
 * انضمام التلميذ من تطبيق آيفون (Build 18): كـ joinInfo (الاشتراك، الشروط، النافذة، الحضور)،
 * ومعه appUrl لتطبيق Zoom باسمه؛ والرابط العادي احتياطًا إن لم يكن تطبيق Zoom مثبّتًا.
 */
export async function joinLiveIos(db: Db, actor: Actor, sessionId: string, now: Date = new Date()): Promise<{ url: string; provider: LiveProvider; title: string; appUrl: string | null }> {
  const info = await joinInfo(db, actor, sessionId, now)
  if (info.provider !== 'ZOOM') return { ...info, appUrl: null }
  const { s } = await loadSession(db, sessionId)
  const passcode = s.meetingPasscodeSealed ? unseal(s.meetingPasscodeSealed, PURPOSE) : null
  return { ...info, appUrl: zoomIosAppUrl(zoomMeetingNumber(info.url, s.providerMeetingId), passcode, actor.fullName || '') }
}

export interface ZoomEmbedJoin {
  signature: string
  sdkKey: string
  meetingNumber: string
  passcode: string
  userName: string
  title: string
  /** الرابط الأصلي: «افتح في تطبيق Zoom» إن تعذّر الدخول داخل المنصة */
  fallbackUrl: string
  /** صفحة الدورة: يعود إليها التلميذ حين يغادر الحصة */
  leaveUrl: string
  /** مفتاح المضيف (ZAK): للمشرف وحده حين يبدأ الحصة من المنصة */
  zak?: string
}

/**
 * دخول الحصة داخل المنصة (Zoom Meeting SDK، 22 نوفمبر 2026): نفس شروط joinInfo (الاشتراك، الشروط،
 * نافذة الانضمام) ويُسجَّل الحضور، ثم توقيع دخول صالح ساعتين باسم التلميذ في حسابه (لا بريد ولا هاتف).
 */
export async function zoomEmbedJoin(db: Db, actor: Actor, sessionId: string, now: Date = new Date()): Promise<ZoomEmbedJoin> {
  const keys = zoomSdkKeys()
  if (!keys) throw new AppError('LIVE_EMBED_UNAVAILABLE')
  const info = await joinInfo(db, actor, sessionId, now)
  const { s } = await loadSession(db, sessionId)
  const meetingNumber = info.provider === 'ZOOM' ? zoomMeetingNumber(info.url, s.providerMeetingId) : null
  if (!meetingNumber) throw new AppError('LIVE_EMBED_UNAVAILABLE')
  const [c] = await db.select({ slug: courses.slug }).from(courses).where(eq(courses.id, s.courseId)).limit(1)
  return {
    signature: zoomSdkSignature(keys, meetingNumber, 0, now),
    sdkKey: keys.clientId,
    meetingNumber,
    passcode: (s.meetingPasscodeSealed ? unseal(s.meetingPasscodeSealed, PURPOSE) : null) ?? '',
    userName: actor.fullName.trim().slice(0, 60) || 'تلميذ',
    title: info.title,
    fallbackUrl: info.url,
    leaveUrl: c ? `/student/courses/${encodeURIComponent(c.slug)}` : '/student/courses'
  }
}

/**
 * بدء الحصة كمضيف من المنصة (المرحلة الثانية، 22 نوفمبر 2026): للمشرف وحده، بحساب Zoom المربوط («ربط Zoom»).
 * توقيع role=1 ومفتاح المضيف (ZAK) يُطلب الآن من Zoom (صلاحيته دقائق). الاجتماع يجب أن يكون في الحساب المربوط.
 */
export async function zoomHostJoin(db: Db, actor: Actor, sessionId: string, opts: { now?: Date; fetchImpl?: typeof fetch } = {}): Promise<ZoomEmbedJoin> {
  assertRole(actor, 'SUPER_ADMIN')
  const now = opts.now ?? new Date()
  const keys = zoomSdkKeys()
  if (!keys) throw new AppError('LIVE_EMBED_UNAVAILABLE')
  const { s, workspaceId } = await loadSession(db, sessionId)
  if (s.status === 'CANCELLED') throw new AppError('LIVE_NOT_OPEN')
  const url = s.joinUrlSealed ? unseal(s.joinUrlSealed, PURPOSE) : null
  const meetingNumber = s.provider === 'ZOOM' ? zoomMeetingNumber(url, s.providerMeetingId) : null
  if (!meetingNumber || !url) throw new AppError('LIVE_EMBED_UNAVAILABLE')
  const zak = await zoomHostZak(db, { now, fetchImpl: opts.fetchImpl })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId, action: 'live.host_start', entityType: 'live_session', entityId: s.id })
  return {
    signature: zoomSdkSignature(keys, meetingNumber, 1, now),
    sdkKey: keys.clientId,
    meetingNumber,
    passcode: (s.meetingPasscodeSealed ? unseal(s.meetingPasscodeSealed, PURPOSE) : null) ?? '',
    userName: actor.fullName.trim().slice(0, 60) || 'الأستاذ',
    title: s.title,
    fallbackUrl: url,
    leaveUrl: `/admin/live/${s.id}`,
    zak
  }
}

/** سجل حضور البث: من فتح الرابط (من التدقيق) — للمشرف/الأستاذ */
export async function liveAttendance(db: Db, actor: Actor, sessionId: string): Promise<{ studentId: string; userId: string | null; at: Date }[]> {
  const { s } = await loadSession(db, sessionId)
  await assertCourseAccess(db, actor, s.courseId)
  const rows = await db
    .select({ actorUserId: auditLogs.actorUserId, newValue: auditLogs.newValue, createdAt: auditLogs.createdAt })
    .from(auditLogs)
    .where(and(eq(auditLogs.action, 'live.join'), eq(auditLogs.entityId, s.id)))
    .orderBy(asc(auditLogs.createdAt))
  const seen = new Map<string, { studentId: string; userId: string | null; at: Date }>()
  for (const r of rows) {
    const sid = (r.newValue as { studentId?: string } | null)?.studentId
    if (sid && !seen.has(sid)) seen.set(sid, { studentId: sid, userId: r.actorUserId, at: new Date(r.createdAt) })
  }
  return [...seen.values()]
}

/* ------------------------------ التذكير ------------------------------ */

/** مهمة LIVE_REMINDERS: الحصص المجدولة التي تبدأ خلال 30–40 دقيقة ولم يُرسل تذكيرها */
export async function runLiveRemindersJob(db: Db, now: Date = new Date()): Promise<{ sessions: number; notified: number }> {
  const due = await db
    .select({ s: liveSessions, courseTitle: courses.title, workspaceId: courses.workspaceId })
    .from(liveSessions)
    .innerJoin(courses, eq(courses.id, liveSessions.courseId))
    .where(
      and(
        eq(liveSessions.status, 'SCHEDULED'),
        isNull(liveSessions.reminderSentAt),
        gte(liveSessions.startsAt, new Date(now.getTime() + REMINDER_WINDOW_MIN_MS)),
        lte(liveSessions.startsAt, new Date(now.getTime() + REMINDER_WINDOW_MAX_MS))
      )
    )
  let notified = 0
  for (const { s, courseTitle, workspaceId } of due) {
    // يُعلَّم أولاً كي لا تُكرَّر الرسالة إن تزامن عاملان
    const marked = await db
      .update(liveSessions)
      .set({ reminderSentAt: now })
      .where(and(eq(liveSessions.id, s.id), isNull(liveSessions.reminderSentAt)))
      .returning({ id: liveSessions.id })
    if (marked.length === 0) continue
    const enrolled = await db
      .select({ userId: students.userId })
      .from(courseEnrollments)
      .innerJoin(students, eq(students.id, courseEnrollments.studentId))
      .where(and(eq(courseEnrollments.courseId, s.courseId), eq(courseEnrollments.status, 'ACTIVE')))
    await notifyMany(
      db,
      enrolled.map((e) => ({
        userId: e.userId,
        workspaceId,
        type: 'SESSION_REMINDER' as const,
        title: `تبدأ حصة ${s.title} خلال 30 دقيقة`,
        body: `${courseTitle} · البث يفتح قبل الموعد بـ15 دقيقة.`,
        link: '/student',
        meta: { liveSessionId: s.id }
      }))
    )
    notified += enrolled.length
    await writeAudit(db, { actorUserId: null, workspaceId, action: 'live.reminders', entityType: 'live_session', entityId: s.id, newValue: { notified: enrolled.length } })
  }
  return { sessions: due.length, notified }
}

/** يُدرج مهمة LIVE_REMINDERS إن لم تُنفَّذ خلال آخر 10 دقائق ولم تكن في الطابور (تُستدعى مع ensureMaintenanceJobs) */
export async function ensureLiveRemindersScheduled(db: Db, now: Date = new Date()): Promise<boolean> {
  const [recent] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.type, 'LIVE_REMINDERS'), sql`(${jobs.status} in ('QUEUED','PROCESSING') or ${jobs.createdAt} > ${new Date(now.getTime() - LIVE_REMINDERS_INTERVAL_MS)})`))
    .limit(1)
  if (recent) return false
  await enqueueJob(db, { type: 'LIVE_REMINDERS', payload: {}, maxAttempts: 1, runAfter: now })
  return true
}
