import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { contentTargets, courses } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { reachableGroupIds } from '@/server/lib/course-access'
import { AppError } from '@/server/lib/errors'
import { storage, type StorageAdapter } from '@/server/lib/storage'
import { courseHome } from './courses.service'
import { requireIosLearningStudent } from './ios-learning.service'
import { resolveMediaAccess, stampPdf } from './media.service'

export const IOS_PDF_EXPORT_MAX_BYTES = 25 * 1024 * 1024

/** download = حفظ في الجهاز (يشترط سماح الأستاذ)؛ view = عرض داخل التطبيق دون حفظ (حقوق المشاهدة العادية) */
export type IosPdfMode = 'download' | 'view'

/** Re-check ordinary viewing rights and every relevant course terms gate. */
async function exportAccess(db: Db, actor: Actor | null, contentId: string, mode: IosPdfMode = 'download') {
  const student = await requireIosLearningStudent(db, actor)
  let access
  try { access = await resolveMediaAccess(db, student, contentId) }
  catch (error) { if (error instanceof AppError) throw new AppError('FORBIDDEN'); throw error }
  const file = access.file
  if (!file || file.mimeType !== 'application/pdf' || access.content.type === 'VIDEO' || file.status !== 'READY' || (mode === 'download' && !access.content.allowDownload)) throw new AppError('FORBIDDEN')
  if (!Number.isSafeInteger(file.sizeBytes) || file.sizeBytes <= 0 || file.sizeBytes > IOS_PDF_EXPORT_MAX_BYTES) throw new AppError('FORBIDDEN')
  const groupIds = await reachableGroupIds(db, student.studentId!)
  if (groupIds.length) {
    const linked = await db.select({ slug: courses.slug }).from(contentTargets)
      .innerJoin(courses, eq(courses.groupId, contentTargets.groupId))
      .where(and(eq(contentTargets.contentId, contentId), inArray(contentTargets.groupId, groupIds), isNull(courses.deletedAt)))
    for (const course of linked) {
      try {
        if ((await courseHome(db, student, course.slug)).needsTerms) throw new AppError('FORBIDDEN')
      } catch (error) {
        if (error instanceof AppError) throw new AppError('FORBIDDEN')
        throw error
      }
    }
  }
  return { student, file }
}

/**
 * Export only a teacher-permitted PDF. No marketplace/raw-file grant, no video
 * and no device flag grants access. A bounded range is consumed, not an
 * unbounded storage().get(), even if metadata or the object changes meanwhile.
 */
export async function exportIosPdf(db: Db, actor: Actor | null, contentId: string, adapter: StorageAdapter = storage(), mode: IosPdfMode = 'download') {
  const { student, file } = await exportAccess(db, actor, contentId, mode)
  const range = await adapter.getRange(file.storageKey, 0, IOS_PDF_EXPORT_MAX_BYTES)
  if (range.size <= 0 || range.size > IOS_PDF_EXPORT_MAX_BYTES || range.size !== file.sizeBytes) {
    await range.stream.cancel()
    throw new AppError('FORBIDDEN')
  }
  const reader = range.stream.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > IOS_PDF_EXPORT_MAX_BYTES || length > range.size) throw new AppError('FORBIDDEN')
      chunks.push(value)
    }
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
  const bytes = Buffer.concat(chunks, length)
  if (bytes.length !== range.size || bytes.subarray(0, 5).toString('ascii') !== '%PDF-') throw new AppError('FORBIDDEN')
  // Revalidate after I/O too: an enrollment/permission revoked during the read
  // must not be knowingly exported. This cannot recall files already shared.
  const latest = await exportAccess(db, actor, contentId, mode)
  if (latest.file.id !== file.id || latest.file.storageKey !== file.storageKey || latest.file.checksum !== file.checksum) throw new AppError('FORBIDDEN')
  // ختم كل نسخة تخرج إلى التطبيق بهوية التلميذ (البريد + رمز الحساب + التاريخ) كما في الموقع.
  // خط PDF القياسي لا يرسم العربية، فلا يُكتب إلا ما يقبله؛ وإن تعذّر الختم (ملف غير قياسي) يُسلَّم الأصل.
  const date = new Date().toISOString().slice(0, 10)
  const latin = (v: string) => v.replace(/[^\x20-\x7e]/g, '').trim()
  const lines = [latin(student.email ?? ''), `${date} · ${student.userId.slice(0, 8)}`].filter(Boolean)
  const output = await stampPdf(bytes, lines).catch(() => bytes)
  let filename = file.originalName.replace(/[\x00-\x1f\x7f/\\]/g, '_').slice(0, 190)
  if (!filename.toLowerCase().endsWith('.pdf')) filename += '.pdf'
  return { accountId: student.userId, filename, bytes: output }
}
