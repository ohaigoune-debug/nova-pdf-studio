'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { COURSE_STATUSES, ENROLLMENT_SOURCES } from '@/server/db/schema/enums'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import {
  acceptTerms,
  createCourse,
  enrollStudent,
  endOfDayDz,
  linkProduct,
  revokeEnrollment,
  searchStudents,
  setCourseStatus,
  unlinkProduct,
  updateCourse,
  type CourseInput
} from '@/server/services/courses.service'
import { uploadFile } from '@/server/services/files.service'

const uuid = z.string().uuid()
const optUuid = z.string().uuid().nullish()
const optDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullish()

const courseSchema = z.object({
  title: z.string().min(2).max(200),
  slug: z.string().max(80).nullish(),
  description: z.string().max(4000).nullish(),
  workspaceId: uuid,
  levelId: optUuid,
  streamIds: z.array(uuid).max(20).optional(),
  subjectId: optUuid,
  season: z.string().min(4).max(20),
  plan: z.enum(['ANNUAL', 'TERM']).optional(),
  startsOn: optDate,
  endsOn: optDate,
  accessEndsOn: optDate,
  priceDzd: z.coerce.number().int().min(0).max(1_000_000),
  termsText: z.string().max(20_000).nullish(),
  status: z.enum(COURSE_STATUSES).optional()
})

function revalidate(id?: string) {
  revalidatePath('/admin/courses')
  if (id) revalidatePath(`/admin/courses/${id}`)
  revalidatePath('/student/courses')
}

function fromForm(fd: FormData) {
  const s = (k: string) => {
    const v = fd.get(k)
    return typeof v === 'string' && v.trim() ? v.trim() : null
  }
  return {
    title: s('title') ?? '',
    slug: s('slug'),
    description: s('description'),
    workspaceId: s('workspaceId') ?? '',
    levelId: s('levelId'),
    streamIds: fd.getAll('streamIds').filter((x): x is string => typeof x === 'string' && !!x),
    subjectId: s('subjectId'),
    season: s('season') ?? '',
    plan: s('plan') ?? undefined,
    startsOn: s('startsOn'),
    endsOn: s('endsOn'),
    accessEndsOn: s('accessEndsOn'),
    priceDzd: s('priceDzd') ?? '0',
    termsText: s('termsText'),
    status: s('status') ?? undefined
  }
}

/** إنشاء/تعديل دورة من نموذج (مع غلاف اختياري) */
export async function saveCourseAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const id = fd.get('id')
  const parsed = courseSchema.safeParse(fromForm(fd))
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    const db = await getDb()
    const input: CourseInput = { ...parsed.data }
    const cover = fd.get('cover')
    if (cover instanceof File && cover.size > 0) {
      const f = await uploadFile(db, actor, { originalName: cover.name, mimeType: cover.type || 'application/octet-stream', bytes: Buffer.from(await cover.arrayBuffer()) })
      input.coverFileId = f.id
    }
    const row = typeof id === 'string' && id ? await updateCourse(db, actor, id, input) : await createCourse(db, actor, input)
    return { id: row.id }
  })
  if (result.ok) revalidate(result.data.id)
  return result
}

export async function setCourseStatusAction(id: string, status: string): Promise<ActionResult> {
  const parsed = z.object({ id: uuid, status: z.enum(COURSE_STATUSES) }).safeParse({ id, status })
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    await setCourseStatus(await getDb(), actor, parsed.data.id, parsed.data.status)
    return undefined
  })
  if (r.ok) revalidate(parsed.data.id)
  return r
}

export async function linkCourseProductAction(courseId: string, productId: string): Promise<ActionResult> {
  const parsed = z.object({ courseId: uuid, productId: uuid }).safeParse({ courseId, productId })
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    await linkProduct(await getDb(), actor, parsed.data.courseId, parsed.data.productId)
    return undefined
  })
  if (r.ok) revalidate(parsed.data.courseId)
  return r
}

export async function unlinkCourseProductAction(courseId: string, productId: string): Promise<ActionResult> {
  const parsed = z.object({ courseId: uuid, productId: uuid }).safeParse({ courseId, productId })
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    await unlinkProduct(await getDb(), actor, parsed.data.courseId, parsed.data.productId)
    return undefined
  })
  if (r.ok) revalidate(parsed.data.courseId)
  return r
}

export async function searchStudentsAction(query: string): Promise<ActionResult<{ studentId: string; fullName: string | null; email: string; phone: string | null }[]>> {
  const parsed = z.string().min(2).max(100).safeParse(query)
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    return searchStudents(await getDb(), actor, parsed.data)
  })
}

export async function enrollStudentAction(payload: { courseId: string; studentId: string; source?: string; expiresOn?: string | null }): Promise<ActionResult<{ id: string }>> {
  const parsed = z
    .object({ courseId: uuid, studentId: uuid, source: z.enum(ENROLLMENT_SOURCES).optional(), expiresOn: optDate })
    .safeParse(payload)
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    const row = await enrollStudent(await getDb(), actor, {
      courseId: parsed.data.courseId,
      studentId: parsed.data.studentId,
      source: parsed.data.source ?? 'MANUAL',
      expiresAt: parsed.data.expiresOn ? endOfDayDz(parsed.data.expiresOn) : undefined
    })
    return { id: row.id }
  })
  if (r.ok) revalidate(parsed.data.courseId)
  return r
}

export async function revokeEnrollmentAction(payload: { courseId: string; enrollmentId: string; reason?: string | null }): Promise<ActionResult> {
  const parsed = z.object({ courseId: uuid, enrollmentId: uuid, reason: z.string().max(500).nullish() }).safeParse(payload)
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    await revokeEnrollment(await getDb(), actor, parsed.data.enrollmentId, parsed.data.reason)
    return undefined
  })
  if (r.ok) revalidate(parsed.data.courseId)
  return r
}

/** الطالب يوافق على النظام الداخلي وشروط الدورة */
export async function acceptCourseTermsAction(payload: { courseId: string; slug: string; accepted: boolean }): Promise<ActionResult> {
  const parsed = z.object({ courseId: uuid, slug: z.string().min(1).max(120), accepted: z.literal(true) }).safeParse(payload)
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    const actor = await requireRole('STUDENT')
    await acceptTerms(await getDb(), actor, parsed.data.courseId)
    return undefined
  })
  if (r.ok) {
    revalidatePath('/student/courses')
    revalidatePath(`/student/courses/${parsed.data.slug}`)
  }
  return r
}

/* ───────────── أكواد تفعيل الدورة ───────────── */

export interface CourseCodesData {
  batchId: string
  courseTitle: string
  codes: string[]
}

/** المشرف: توليد دفعة أكواد لدورة يختارها — الأكواد الصريحة تُعاد مرة واحدة للطباعة/التصدير */
export async function generateCourseCodesAction(_prev: ActionResult<CourseCodesData> | null, fd: FormData): Promise<ActionResult<CourseCodesData>> {
  const parsed = z
    .object({ courseId: z.string().uuid('اختر الدورة'), count: z.coerce.number().int().min(1, 'العدد 1 على الأقل').max(1000, 'الحد الأقصى 1000'), label: z.string().trim().max(80).optional(), expiresOn: z.string().optional() })
    .safeParse({ courseId: fd.get('courseId') ?? '', count: fd.get('count') ?? 0, label: fd.get('label') ?? undefined, expiresOn: fd.get('expiresOn') ?? undefined })
  if (!parsed.success) return failValidation(parsed.error)
  const exp = parsed.data.expiresOn ? new Date(`${parsed.data.expiresOn}T22:59:59Z`) : null
  const result = await runAction(async () => {
    const { generateCourseCodes } = await import('@/server/services/course-codes.service')
    return generateCourseCodes(await getDb(), await requireRole('SUPER_ADMIN'), { courseId: parsed.data.courseId, count: parsed.data.count, label: parsed.data.label || null, expiresAt: exp && !Number.isNaN(exp.getTime()) ? exp : null })
  })
  if (result.ok) revalidatePath('/admin/courses/codes')
  return result
}

export async function disableCourseCodeBatchAction(batchId: string): Promise<ActionResult<{ disabled: number }>> {
  const parsed = z.string().uuid().safeParse(batchId)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const { disableCourseCodeBatch } = await import('@/server/services/course-codes.service')
    return { disabled: await disableCourseCodeBatch(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data) }
  })
  if (result.ok) revalidatePath('/admin/courses/codes')
  return result
}

/** المشرف: البحث عن كود تفعيل (شكوى «الكود مستعمل») */
export async function lookupCourseCodeAction(code: string): Promise<ActionResult<{ status: string; courseTitle: string; batchLabel: string | null; usedAt: string | null; usedBy: { fullName: string; phone: string | null } | null } | null>> {
  const parsed = z.string().trim().min(6).max(30).safeParse(code)
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => {
    const { lookupCourseCode } = await import('@/server/services/course-codes.service')
    const r = await lookupCourseCode(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data)
    return r ? { status: r.status, courseTitle: r.courseTitle, batchLabel: r.batchLabel, usedAt: r.usedAt?.toISOString() ?? null, usedBy: r.usedBy ? { fullName: r.usedBy.fullName, phone: r.usedBy.phone } : null } : null
  })
}

/** المشرف: تحرير كود استُعمل خطأً (مع إلغاء اشتراك من استعمله اختيارياً) */
export async function releaseCourseCodeAction(code: string, revokeEnrollment: boolean): Promise<ActionResult<{ released: boolean }>> {
  const parsed = z.object({ code: z.string().trim().min(6).max(30), revokeEnrollment: z.boolean() }).safeParse({ code, revokeEnrollment })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const { releaseCourseCode } = await import('@/server/services/course-codes.service')
    return { released: await releaseCourseCode(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data.code, { revokeEnrollment: parsed.data.revokeEnrollment }) }
  })
  if (result.ok) revalidatePath('/admin/courses/codes')
  return result
}
