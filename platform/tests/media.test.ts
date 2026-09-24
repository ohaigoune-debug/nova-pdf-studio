import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import type { DatabaseHandle } from '@/server/db/connect'
import { files, mediaViews, studentTimeline } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { storage } from '@/server/lib/storage'
import { parseYoutubeId, youtubeEmbedUrl } from '@/server/lib/youtube'
import { createContent, getContentForStudent, updateContent } from '@/server/services/content.service'
import { generateCodes } from '@/server/services/enrollment-codes.service'
import { redeemEnrollmentCode } from '@/server/services/enrollment.service'
import { completeUpload, createUploadTicket, receiveUploadStream, uploadFile, verifyUploadSignature } from '@/server/services/files.service'
import { createGroup } from '@/server/services/groups.service'
import { listContentViews, recordMediaHeartbeat, resolveMediaAccess, signMediaUrl, stampPdf, verifyMediaSignature } from '@/server/services/media.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb } from './helpers'

let h: DatabaseHandle
let admin: Actor
let teacher: Actor
let teacherB: Actor
let student: Actor
let outsider: Actor
let group: { id: string }
let pdfFileId: string
let videoFileId: string

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

async function tinyPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create()
  doc.addPage([400, 500]).drawText('Lesson', { x: 40, y: 450, size: 20 })
  doc.addPage([400, 500])
  return Buffer.from(await doc.save())
}

beforeAll(async () => {
  process.env.UPLOADS_DIR = `data/test-uploads-media-${Date.now()}`
  process.env.MEDIA_MAX_DEVICES = '2'
  h = await setupDb()
  admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin, 'أستاذ الوسائط')
  teacherB = await makeTeacher(h.db, admin, 'أستاذ آخر')
  student = await makeStudent(h.db, 'طالب الوسائط')
  outsider = await makeStudent(h.db, 'طالب خارجي')
  group = await createGroup(h.db, teacher, { name: 'فوج الوسائط' })
  const codes = await generateCodes(h.db, teacher, { groupId: group.id, count: 1 })
  await redeemEnrollmentCode(h.db, student, codes.codes[0]!.code)
  const pdf = await uploadFile(h.db, teacher, { originalName: 'lesson.pdf', mimeType: 'application/pdf', bytes: await tinyPdf() })
  pdfFileId = pdf.id
  const video = await uploadFile(h.db, teacher, { originalName: 'clip.mp4', mimeType: 'video/mp4', bytes: Buffer.alloc(200_000, 7) })
  videoFileId = video.id
})

afterAll(async () => {
  await h.close()
})

describe('يوتيوب: تحليل الروابط والتضمين', () => {
  it('يستخرج المعرّف من كل الصيغ ويرفض غيرها', () => {
    for (const u of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://youtube.com/shorts/dQw4w9WgXcQ?feature=share',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      'https://m.youtube.com/watch?feature=x&v=dQw4w9WgXcQ',
      'youtube.com/live/dQw4w9WgXcQ',
      'dQw4w9WgXcQ'
    ])
      expect(parseYoutubeId(u)).toBe('dQw4w9WgXcQ')
    for (const u of ['https://vimeo.com/123', 'https://example.com/watch?v=dQw4w9WgXcQ', 'https://youtube.com/watch?v=short', '', 'javascript:alert(1)']) expect(parseYoutubeId(u)).toBeNull()
    expect(youtubeEmbedUrl('dQw4w9WgXcQ')).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/)
    expect(youtubeEmbedUrl('dQw4w9WgXcQ')).toContain('rel=0')
  })

  it('محتوى فيديو يوتيوب يُحفظ بمعرّف مُتحقَّق منه ورابط قياسي؛ رابط غير صحيح يُرفض', async () => {
    await expectCode(() => createContent(h.db, teacher, { type: 'VIDEO', title: 'فيديو خاطئ', visibility: 'PUBLIC', videoProvider: 'YOUTUBE', externalUrl: 'https://vimeo.com/1', publish: true }), 'INVALID_YOUTUBE_URL')
    const c = await createContent(h.db, teacher, { type: 'VIDEO', title: 'درس البلاغة (يوتيوب)', visibility: 'PUBLIC', videoProvider: 'YOUTUBE', externalUrl: 'https://youtu.be/dQw4w9WgXcQ?t=5', publish: true })
    expect(c.videoProvider).toBe('YOUTUBE')
    expect(c.youtubeId).toBe('dQw4w9WgXcQ')
    expect(c.externalUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(c.fileId).toBeNull()
    const view = await getContentForStudent(h.db, student, c.slug)
    expect(view.youtubeId).toBe('dQw4w9WgXcQ')
    // لا يحتاج ملفاً ولا رابط بث
    await expectCode(() => createContent(h.db, teacher, { type: 'VIDEO', title: 'بلا ملف', visibility: 'PUBLIC', videoProvider: 'UPLOAD', publish: true }), 'VALIDATION')
  })
})

describe('الوسائط الخاصة: روابط موقّعة بهوية المشاهد، صلاحيات، ختم PDF', () => {
  let contentId: string
  let pdfContentId: string

  it('الرابط الموقّع لا يعمل إلا لنفس المشاهد ونفس المحتوى وقبل الانتهاء', async () => {
    const c = await createContent(h.db, teacher, { type: 'VIDEO', title: 'فيديو خاص للفوج', visibility: 'GROUP_ONLY', groupIds: [group.id], videoProvider: 'UPLOAD', fileId: videoFileId, publish: true })
    contentId = c.id
    const url = new URL(signMediaUrl(videoFileId, c.id, student.userId), 'http://x')
    const exp = url.searchParams.get('exp')
    const sig = url.searchParams.get('sig')
    expect(verifyMediaSignature(videoFileId, c.id, student.userId, exp, sig)).toBe(true)
    expect(verifyMediaSignature(videoFileId, c.id, outsider.userId, exp, sig)).toBe(false)
    expect(verifyMediaSignature(videoFileId, 'other-content', student.userId, exp, sig)).toBe(false)
    expect(verifyMediaSignature(pdfFileId, c.id, student.userId, exp, sig)).toBe(false)
    expect(verifyMediaSignature(videoFileId, c.id, student.userId, exp, sig, Date.now() + 5 * 3600_000)).toBe(false)
    expect(verifyMediaSignature(videoFileId, c.id, student.userId, exp, 'x'.repeat(43))).toBe(false)
  })

  it('الصلاحيات: الطالب المستهدف نعم، طالب خارجي لا، الأستاذ صاحب المساحة نعم، أستاذ آخر لا، الزائر لا', async () => {
    const a = await resolveMediaAccess(h.db, student, contentId)
    expect(a.file?.id).toBe(videoFileId)
    expect(a.watermark[0]).toBe(student.email)
    await expectCode(() => resolveMediaAccess(h.db, outsider, contentId), 'CONTENT_NOT_FOUND')
    await expectCode(() => resolveMediaAccess(h.db, null, contentId), 'CONTENT_NOT_FOUND')
    await expectCode(() => resolveMediaAccess(h.db, teacherB, contentId), 'CONTENT_NOT_FOUND')
    expect((await resolveMediaAccess(h.db, teacher, contentId)).viewerId).toBe(teacher.userId)
    expect((await resolveMediaAccess(h.db, admin, contentId)).viewerId).toBe(admin.userId)
    // غير منشور ⇒ لا وصول حتى للمستهدف
    await updateContent(h.db, teacher, contentId, { publish: false })
    await expectCode(() => resolveMediaAccess(h.db, student, contentId), 'CONTENT_NOT_FOUND')
    await updateContent(h.db, teacher, contentId, { publish: true })
    // محتوى عام ⇒ الزائر يصل بهوية anon
    const pub = await createContent(h.db, teacher, { type: 'PDF', title: 'ملف عام', visibility: 'PUBLIC', fileId: pdfFileId, publish: true })
    expect((await resolveMediaAccess(h.db, null, pub.id)).viewerId).toBe('anon')
  })

  it('ختم PDF: كل صفحة تحمل بريد الطالب، والأصل لا يتغيّر، والناتج PDF صالح', async () => {
    const c = await createContent(h.db, teacher, { type: 'PDF', title: 'ملخص الدرس', visibility: 'STUDENTS_ONLY', fileId: pdfFileId, publish: true })
    pdfContentId = c.id
    expect(c.allowDownload).toBe(false)
    const access = await resolveMediaAccess(h.db, student, c.id)
    const original = await storage().get(access.file!.storageKey)
    const stamped = await stampPdf(original, access.watermark)
    expect(stamped.length).toBeGreaterThan(original.length)
    expect(stamped.equals(original)).toBe(false)
    const doc = await PDFDocument.load(stamped)
    expect(doc.getPageCount()).toBe(2)
    // تيارات المحتوى مضغوطة، لكن قاموس الخط المضاف (Helvetica-Bold) ظاهر — والأصل لا يحويه
    expect(stamped.toString('latin1')).toContain('Helvetica-Bold')
    expect(original.toString('latin1')).not.toContain('Helvetica-Bold')
    // الأصل في التخزين لم يُمس
    expect((await storage().get(access.file!.storageKey)).equals(original)).toBe(true)
    // السماح بالتنزيل يُحفظ كإعداد
    await updateContent(h.db, teacher, c.id, { allowDownload: true })
    expect((await resolveMediaAccess(h.db, student, c.id)).content.allowDownload).toBe(true)
    await updateContent(h.db, teacher, c.id, { allowDownload: false })
  })

  it('نبضات المشاهدة: سجل لكل جهاز، الخط الزمني مرة واحدة، وحدّ الأجهزة المتزامنة', async () => {
    const t0 = new Date('2026-10-01T10:00:00Z')
    const r1 = await recordMediaHeartbeat(h.db, student, { contentId, viewerKey: 'device-a-000001', position: 0, delta: 0, ip: '10.0.0.1', now: t0 })
    expect(r1.first).toBe(true)
    await recordMediaHeartbeat(h.db, student, { contentId, viewerKey: 'device-a-000001', position: 30, delta: 15, ip: '10.0.0.1', now: new Date(t0.getTime() + 15_000) })
    await recordMediaHeartbeat(h.db, student, { contentId, viewerKey: 'device-a-000001', position: 45, delta: 15, ip: '10.0.0.1', now: new Date(t0.getTime() + 30_000) })
    // جهاز ثانٍ بعنوان آخر: مسموح (الحد 2)
    await recordMediaHeartbeat(h.db, student, { contentId, viewerKey: 'device-b-000002', position: 5, delta: 5, ip: '10.0.0.2', now: new Date(t0.getTime() + 40_000) })
    // جهاز ثالث بعنوان ثالث خلال النافذة: مرفوض
    await expectCode(() => recordMediaHeartbeat(h.db, student, { contentId, viewerKey: 'device-c-000003', position: 0, delta: 0, ip: '10.0.0.3', now: new Date(t0.getTime() + 50_000) }), 'MEDIA_TOO_MANY_DEVICES')
    // نفس العنوان لجهاز ثالث (نفس الشبكة): مسموح
    await recordMediaHeartbeat(h.db, student, { contentId, viewerKey: 'device-d-000004', position: 0, delta: 0, ip: '10.0.0.1', now: new Date(t0.getTime() + 55_000) })
    // بعد انقضاء النافذة يُقبل عنوان جديد
    await recordMediaHeartbeat(h.db, student, { contentId, viewerKey: 'device-c-000003', position: 0, delta: 0, ip: '10.0.0.3', now: new Date(t0.getTime() + 20 * 60_000) })
    // الدلتا محدودة بـ 120 ثانية
    await recordMediaHeartbeat(h.db, student, { contentId, viewerKey: 'device-a-000001', position: 600, delta: 9999, ip: '10.0.0.1', completed: true, now: new Date(t0.getTime() + 21 * 60_000) })
    const rows = await h.db.select().from(mediaViews).where(eq(mediaViews.userId, student.userId))
    const a = rows.find((r) => r.viewerKey === 'device-a-000001')!
    expect(a.secondsWatched).toBe(15 + 15 + 120)
    expect(a.maxPosition).toBe(600)
    expect(a.completed).toBe(true)
    expect(a.studentId).toBe(student.studentId)
    const tl = await h.db.select().from(studentTimeline).where(eq(studentTimeline.studentId, student.studentId!))
    expect(tl.filter((x) => x.type === 'LESSON_VIEWED')).toHaveLength(1)
    // طالب خارجي لا يستطيع إرسال نبضة
    await expectCode(() => recordMediaHeartbeat(h.db, outsider, { contentId, viewerKey: 'device-x-000009', position: 0, delta: 0 }), 'CONTENT_NOT_FOUND')

    // تقرير الأستاذ: مجمّع لكل طالب مع اشتباه المشاركة (3 عناوين مختلفة)
    const report = await listContentViews(h.db, teacher, contentId)
    expect(report.title).toBe('فيديو خاص للفوج')
    expect(report.rows).toHaveLength(1)
    expect(report.rows[0]?.sessions).toBe(4)
    expect(report.rows[0]?.distinctIps).toBe(3)
    expect(report.rows[0]?.completed).toBe(true)
    await expectCode(() => listContentViews(h.db, teacherB, contentId), 'CONTENT_NOT_FOUND')
    await expectCode(() => listContentViews(h.db, student, contentId), 'FORBIDDEN')
    // مشاهدة PDF تُسجَّل أيضاً
    await recordMediaHeartbeat(h.db, student, { contentId: pdfContentId, viewerKey: 'device-a-000001', position: 0, delta: 0, ip: '10.0.0.1' })
    expect((await listContentViews(h.db, teacher, pdfContentId)).rows).toHaveLength(1)
  })
})

describe('رفع مباشر: تذكرة → تيار → إكمال', () => {
  it('الأستاذ فقط، النوع والحجم مضبوطان، الملف PENDING حتى الإكمال، والتوقيع مرتبط بالمالك', async () => {
    await expectCode(() => createUploadTicket(h.db, student, { originalName: 'x.mp4', mimeType: 'video/mp4', sizeBytes: 10 }), 'FORBIDDEN')
    await expectCode(() => createUploadTicket(h.db, teacher, { originalName: 'x.exe', mimeType: 'application/x-msdownload', sizeBytes: 10 }), 'FILE_TYPE_NOT_ALLOWED')
    await expectCode(() => createUploadTicket(h.db, teacher, { originalName: 'big.mp4', mimeType: 'video/mp4', sizeBytes: 600 * 1024 * 1024 }), 'FILE_TOO_LARGE')
    await expectCode(() => createUploadTicket(h.db, teacher, { originalName: 'big.pdf', mimeType: 'application/pdf', sizeBytes: 41 * 1024 * 1024 }), 'FILE_TOO_LARGE')

    const ticket = await createUploadTicket(h.db, teacher, { originalName: 'lecture.mp4', mimeType: 'video/mp4', sizeBytes: 1000 })
    expect(ticket.direct).toBe(false)
    expect(ticket.url).toMatch(new RegExp(`^/api/v1/files/${ticket.fileId}/upload\\?exp=\\d+&sig=`))
    const [pending] = await h.db.select().from(files).where(eq(files.id, ticket.fileId))
    expect(pending?.status).toBe('PENDING')
    const u = new URL(ticket.url, 'http://x')
    expect(verifyUploadSignature(ticket.fileId, teacher.userId, u.searchParams.get('exp'), u.searchParams.get('sig'))).toBe(true)
    expect(verifyUploadSignature(ticket.fileId, teacherB.userId, u.searchParams.get('exp'), u.searchParams.get('sig'))).toBe(false)

    // الإكمال قبل الرفع ⇒ مرفوض
    await expectCode(() => completeUpload(h.db, teacher, ticket.fileId), 'UPLOAD_INCOMPLETE')
    // أستاذ آخر لا يرفع على تذكرتي
    await expectCode(() => receiveUploadStream(h.db, teacherB, ticket.fileId, new Blob([Buffer.alloc(10)]).stream() as ReadableStream<Uint8Array>), 'FILE_NOT_FOUND')

    // تيار أكبر من الحد ⇒ FILE_TOO_LARGE ولا يبقى أثر
    process.env.MAX_VIDEO_UPLOAD_MB = '0.0005' // ≈ 524 بايت
    await expectCode(() => receiveUploadStream(h.db, teacher, ticket.fileId, new Blob([Buffer.alloc(1000, 1)]).stream() as ReadableStream<Uint8Array>), 'FILE_TOO_LARGE')
    expect(await storage().size(pending!.storageKey)).toBeNull()
    delete process.env.MAX_VIDEO_UPLOAD_MB

    const r = await receiveUploadStream(h.db, teacher, ticket.fileId, new Blob([Buffer.alloc(1000, 1)]).stream() as ReadableStream<Uint8Array>)
    expect(r.bytes).toBe(1000)
    const done = await completeUpload(h.db, teacher, ticket.fileId)
    expect(done.status).toBe('READY')
    expect(done.sizeBytes).toBe(1000)
    // الرفع مرة ثانية على ملف جاهز مرفوض
    await expectCode(() => receiveUploadStream(h.db, teacher, ticket.fileId, new Blob([Buffer.alloc(5)]).stream() as ReadableStream<Uint8Array>), 'VALIDATION')
    // البثّ الجزئي يعمل على الملف المرفوع
    const range = await storage().getRange(done.storageKey, 100, 199)
    expect(range.size).toBe(1000)
    expect(range.end - range.start + 1).toBe(100)
    const chunks: Uint8Array[] = []
    const reader = range.stream.getReader()
    for (;;) {
      const { done: d, value } = await reader.read()
      if (d) break
      chunks.push(value)
    }
    expect(Buffer.concat(chunks).length).toBe(100)
  })
})
