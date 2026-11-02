'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { COURSE_STATUSES, ENROLLMENT_SOURCES } from '@/server/db/schema/enums'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { AppError } from '@/server/lib/errors'
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

/** كتاب اختياري عند إنشاء الدورة (قرار المالك 1 نوفمبر 2026): سعره هو سعر الدورة */
const newBookSchema = z.object({
  bookTitle: z.string().trim().min(2, 'اسم الكتاب').max(200),
  bookStock: z.number().int().min(0, 'المخزون 0 أو أكثر').nullable(),
  priceDzd: z.coerce.number().int().min(1, 'الدورة ذات الكتاب سعرها 1 دج على الأقل').max(1_000_000)
})

async function uploadImage(db: Awaited<ReturnType<typeof getDb>>, actor: Awaited<ReturnType<typeof requireRole>>, file: FormDataEntryValue | null): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null
  if (!file.type.startsWith('image/')) throw new AppError('FILE_TYPE_NOT_ALLOWED')
  const f = await uploadFile(db, actor, { originalName: file.name, mimeType: file.type, bytes: Buffer.from(await file.arrayBuffer()) })
  return f.id
}

/** إنشاء/تعديل دورة من نموذج (مع غلاف اختياري، وكتاب اختياري عند الإنشاء) */
export async function saveCourseAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const id = fd.get('id')
  const isNew = !(typeof id === 'string' && id)
  const parsed = courseSchema.safeParse(fromForm(fd))
  if (!parsed.success) return failValidation(parsed.error)
  const withBook = isNew && fd.get('withBook') === 'on'
  const stockRaw = String(fd.get('bookStock') ?? '').trim()
  const book = withBook ? newBookSchema.safeParse({ bookTitle: fd.get('bookTitle') ?? '', bookStock: stockRaw === '' ? null : Number(stockRaw), priceDzd: fd.get('priceDzd') ?? 0 }) : null
  if (book && !book.success) return failValidation(book.error)
  // النسخة الرقمية اختيارية عند الإنشاء (فارغ = لا نسخة رقمية)
  const digitalRaw = isNew ? String(fd.get('digitalPriceDzd') ?? '').trim() : ''
  const digital = digitalRaw ? z.object({ digitalPriceDzd: z.number().int('السعر عدد صحيح').min(50, 'سعر النسخة الرقمية 50 دج على الأقل').max(1_000_000) }).safeParse({ digitalPriceDzd: Number(digitalRaw) }) : null
  if (digital && !digital.success) return failValidation(digital.error)
  const result = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    const db = await getDb()
    const input: CourseInput = { ...parsed.data }
    const coverId = await uploadImage(db, actor, fd.get('cover'))
    if (coverId) input.coverFileId = coverId
    if (!isNew) return { id: (await updateCourse(db, actor, id as string, input)).id }
    const bookCoverId = book?.success ? await uploadImage(db, actor, fd.get('bookCover')) : null
    const row = await createCourse(db, actor, input)
    if (book?.success) {
      const { setCourseBook } = await import('@/server/services/course-purchase.service')
      await setCourseBook(db, actor, row.id, { title: book.data.bookTitle, priceDzd: book.data.priceDzd, stock: book.data.bookStock, active: true, coverFileId: bookCoverId })
    }
    if (digital?.success) {
      const { setCourseDigitalPrice } = await import('@/server/services/course-purchase.service')
      await setCourseDigitalPrice(db, actor, row.id, digital.data.digitalPriceDzd)
    }
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

/* ───────────── الكتاب المرفق بالدورة ───────────── */

/** المشرف: إنشاء/تعديل الكتاب المرفق بالدورة (سعره = سعر الدورة) من صفحة الدورة، مع صورة غلاف اختيارية */
export async function setCourseBookAction(_prev: ActionResult<{ purchasable: boolean }> | null, fd: FormData): Promise<ActionResult<{ purchasable: boolean }>> {
  const stockRaw = String(fd.get('stock') ?? '').trim()
  const parsed = z
    .object({ courseId: z.string().uuid(), title: z.string().trim().min(2, 'اسم الكتاب').max(200), priceDzd: z.coerce.number().int().min(1, 'السعر 1 دج على الأقل').max(1_000_000), stock: z.number().int().min(0).nullable(), active: z.boolean() })
    .safeParse({ courseId: fd.get('courseId') ?? '', title: fd.get('title') ?? '', priceDzd: fd.get('priceDzd') ?? 0, stock: stockRaw === '' ? null : Number(stockRaw), active: fd.get('active') === 'on' })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const { setCourseBook } = await import('@/server/services/course-purchase.service')
    const actor = await requireRole('SUPER_ADMIN')
    const db = await getDb()
    const coverFileId = await uploadImage(db, actor, fd.get('cover'))
    const s = await setCourseBook(db, actor, parsed.data.courseId, { title: parsed.data.title, priceDzd: parsed.data.priceDzd, stock: parsed.data.stock, active: parsed.data.active, coverFileId })
    return { purchasable: s.purchasable }
  })
  if (result.ok) {
    revalidatePath(`/admin/courses/${parsed.data.courseId}`)
    revalidatePath('/admin/courses')
  }
  return result
}

/** المشرف: سعر النسخة الرقمية للدورة (فارغ = إيقافها). الشراء بالبطاقة فقط، وتُفتح الدورة فور الدفع. */
export async function setCourseDigitalPriceAction(_prev: ActionResult<{ purchasable: boolean; issue: string | null }> | null, fd: FormData): Promise<ActionResult<{ purchasable: boolean; issue: string | null }>> {
  const raw = String(fd.get('digitalPriceDzd') ?? '').trim()
  const parsed = z
    .object({ courseId: z.string().uuid(), digitalPriceDzd: z.number().int('السعر عدد صحيح').min(50, 'السعر 50 دج على الأقل').max(1_000_000).nullable() })
    .safeParse({ courseId: fd.get('courseId') ?? '', digitalPriceDzd: raw === '' ? null : Number(raw) })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const { setCourseDigitalPrice } = await import('@/server/services/course-purchase.service')
    const s = await setCourseDigitalPrice(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data.courseId, parsed.data.digitalPriceDzd)
    return { purchasable: s.purchasable, issue: s.issue }
  })
  if (result.ok) revalidate(parsed.data.courseId)
  return result
}

/** المشرف: اعتماد منتج كتاب مرتبط سابقاً ككتاب الدورة (الدورات القديمة) */
export async function chooseCourseBookAction(courseId: string, productId: string): Promise<ActionResult> {
  const parsed = z.object({ courseId: z.string().uuid(), productId: z.string().uuid() }).safeParse({ courseId, productId })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const { chooseCourseBook } = await import('@/server/services/course-purchase.service')
    await chooseCourseBook(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data.courseId, parsed.data.productId)
    return undefined
  })
  if (result.ok) revalidatePath(`/admin/courses/${courseId}`)
  return result
}

/** المشرف: إزالة الكتاب من الدورة (تصبح بلا كتاب؛ المنتج يُوقف بيعه ولا يُحذف) */
export async function removeCourseBookAction(courseId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(courseId)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const { removeCourseBook } = await import('@/server/services/course-purchase.service')
    await removeCourseBook(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data)
    return undefined
  })
  if (result.ok) {
    revalidatePath(`/admin/courses/${parsed.data}`)
    revalidatePath('/admin/courses')
  }
  return result
}
