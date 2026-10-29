import fs from 'node:fs/promises'
import { eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/v1/ios/materials/[contentId]/export/route'
import { createSession, SESSION_COOKIE } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import type { DatabaseHandle } from '@/server/db/connect'
import { content, courseEnrollments, files, profiles } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { storage, type StorageAdapter } from '@/server/lib/storage'
import { createContent } from '@/server/services/content.service'
import { acceptTerms, createCourse, enrollStudent } from '@/server/services/courses.service'
import { uploadFile } from '@/server/services/files.service'
import { exportIosPdf, IOS_PDF_EXPORT_MAX_BYTES } from '@/server/services/ios-file-export.service'
import { makeAdmin, makeStudent, makeTeacher, publishLegacyCourse, setupDb, workspaceIdOfTeacher } from './helpers'

vi.mock('@/server/db/client', () => ({ getDb: vi.fn() }))

let h: DatabaseHandle
let student: Actor
let other: Actor
let admin: Actor
let teacher: Actor
let course: Awaited<ReturnType<typeof createCourse>>
let pdf: Awaited<ReturnType<typeof uploadFile>>
let lesson: Awaited<ReturnType<typeof createContent>>
let token: string
const pdfBytes = Buffer.from('%PDF-1.4\n% teacher-permitted test document\n%%EOF')
const uploads = `data/test-uploads-ios-export-${Date.now()}`
const previousUploads = process.env.UPLOADS_DIR

beforeAll(async () => {
  process.env.UPLOADS_DIR = uploads
  h = await setupDb()
  vi.mocked(getDb).mockResolvedValue(h.db)
  admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin)
  student = await makeStudent(h.db)
  other = await makeStudent(h.db)
  course = await createCourse(h.db, admin, { title: 'دورة ملفات الآيفون', workspaceId: await workspaceIdOfTeacher(h.db, teacher), season: '2026/2027' })
  await publishLegacyCourse(h.db, course.id)
  await enrollStudent(h.db, admin, { courseId: course.id, studentId: student.studentId!, source: 'MANUAL' })
  pdf = await uploadFile(h.db, teacher, { originalName: 'درس مسموح.pdf', mimeType: 'application/pdf', bytes: pdfBytes })
  await h.db.update(files).set({ status: 'READY' }).where(eq(files.id, pdf.id))
  lesson = await createContent(h.db, teacher, { title: 'ملف قابل للمشاركة', type: 'PDF', fileId: pdf.id, visibility: 'GROUP_ONLY', groupIds: [course.groupId], allowDownload: true, publish: true })
  token = (await createSession(h.db, { userId: student.userId })).token
})

afterEach(() => vi.unstubAllEnvs())
afterAll(async () => {
  await h.close()
  await fs.rm(uploads, { recursive: true, force: true })
  if (previousUploads === undefined) delete process.env.UPLOADS_DIR
  else process.env.UPLOADS_DIR = previousUploads
})

function request(cookieToken?: string) {
  return new NextRequest(`https://madrasadz.com/api/v1/ios/materials/${lesson.id}/export`, { headers: cookieToken ? { cookie: `${SESSION_COOKIE}=${cookieToken}` } : {} })
}
function response(cookieToken?: string) { return GET(request(cookieToken), { params: Promise.resolve({ contentId: lesson.id }) }) }

describe('authorized iOS PDF export', () => {
  it('exports an explicitly permitted PDF for the existing student account with private attachment headers', async () => {
    const result = await response(token)
    expect(result.status).toBe(200)
    expect(result.headers.get('content-type')).toBe('application/pdf')
    expect(result.headers.get('cache-control')).toBe('private, no-store')
    expect(result.headers.get('vary')).toBe('Cookie')
    expect(result.headers.get('x-content-type-options')).toBe('nosniff')
    expect(result.headers.get('x-madrasadz-account')).toBe(student.userId)
    expect(result.headers.get('content-disposition')).toBe(`attachment; filename*=UTF-8''${encodeURIComponent('درس مسموح.pdf')}`)
    expect(Buffer.from(await result.arrayBuffer())).toEqual(pdfBytes)
  })

  it('requires the current browser cookie, not an app hint or Bearer token', async () => {
    const req = request()
    req.headers.set('authorization', `Bearer ${token}`)
    req.headers.set('x-madrasadz-ios-client', 'study-only')
    const result = await GET(req, { params: Promise.resolve({ contentId: lesson.id }) })
    expect(result.status).toBe(401)
    expect(result.headers.get('cache-control')).toBe('private, no-store')
    expect(result.headers.has('x-madrasadz-account')).toBe(false)
  })

  it('denies another student and staff without exposing the file', async () => {
    for (const actor of [other, admin, teacher]) {
      const session = await createSession(h.db, { userId: actor.userId })
      const result = await response(session.token)
      expect(result.status).toBe(403)
      expect(result.headers.has('x-madrasadz-account')).toBe(false)
    }
  })

  it('respects the teacher download flag and READY state', async () => {
    await h.db.update(content).set({ allowDownload: false }).where(eq(content.id, lesson.id))
    expect((await response(token)).status).toBe(403)
    await h.db.update(content).set({ allowDownload: true }).where(eq(content.id, lesson.id))
    await h.db.update(files).set({ status: 'PENDING' }).where(eq(files.id, pdf.id))
    expect((await response(token)).status).toBe(403)
    await h.db.update(files).set({ status: 'READY' }).where(eq(files.id, pdf.id))
  })

  it('does not export video content or a non-PDF file through this endpoint', async () => {
    await h.db.update(content).set({ type: 'VIDEO' }).where(eq(content.id, lesson.id))
    expect((await response(token)).status).toBe(403)
    await h.db.update(content).set({ type: 'PDF' }).where(eq(content.id, lesson.id))
    await h.db.update(files).set({ mimeType: 'video/mp4' }).where(eq(files.id, pdf.id))
    expect((await response(token)).status).toBe(403)
    await h.db.update(files).set({ mimeType: 'application/pdf' }).where(eq(files.id, pdf.id))
  })

  it('requires phone verification when configured and never sends a real SMS', async () => {
    vi.stubEnv('SMS_PROVIDER', 'webhook')
    vi.stubEnv('SMS_WEBHOOK_URL', 'https://sms.invalid/test')
    expect((await response(token)).status).toBe(403)
    await h.db.update(profiles).set({ phoneVerifiedAt: new Date() }).where(eq(profiles.userId, student.userId))
    expect((await response(token)).status).toBe(200)
  })

  it('requires the current terms version for a relevant enrolled course', async () => {
    const { courses } = await import('@/server/db/schema')
    await h.db.update(courses).set({ termsText: 'شروط التنزيل المصرح', termsVersion: 2 }).where(eq(courses.id, course.id))
    expect((await response(token)).status).toBe(403)
    await acceptTerms(h.db, student, course.id)
    expect((await response(token)).status).toBe(200)
  })

  it('denies expired and revoked course access immediately', async () => {
    await h.db.update(courseEnrollments).set({ expiresAt: new Date(Date.now() - 1_000) }).where(eq(courseEnrollments.courseId, course.id))
    expect((await response(token)).status).toBe(403)
    await h.db.update(courseEnrollments).set({ expiresAt: null, status: 'REVOKED' }).where(eq(courseEnrollments.courseId, course.id))
    expect((await response(token)).status).toBe(403)
    await h.db.update(courseEnrollments).set({ status: 'ACTIVE' }).where(eq(courseEnrollments.courseId, course.id))
  })

  it('rejects oversized metadata before reading any storage bytes', async () => {
    await h.db.update(files).set({ sizeBytes: IOS_PDF_EXPORT_MAX_BYTES + 1 }).where(eq(files.id, pdf.id))
    const getRange = vi.fn()
    await expect(exportIosPdf(h.db, student, lesson.id, { getRange } as unknown as StorageAdapter)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(getRange).not.toHaveBeenCalled()
    await h.db.update(files).set({ sizeBytes: pdfBytes.length }).where(eq(files.id, pdf.id))
  })

  it('rejects an oversized actual object without consuming the stream', async () => {
    const cancel = vi.fn()
    const stream = new ReadableStream<Uint8Array>({ cancel })
    const getRange = vi.fn(async () => ({ stream, size: IOS_PDF_EXPORT_MAX_BYTES + 1, start: 0, end: IOS_PDF_EXPORT_MAX_BYTES }))
    await expect(exportIosPdf(h.db, student, lesson.id, { getRange } as unknown as StorageAdapter)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('rechecks rights after storage I/O if the enrollment is revoked during export', async () => {
    const real = storage()
    const getRange = vi.fn(async (key: string, start: number, end?: number) => {
      const range = await real.getRange(key, start, end)
      await h.db.update(courseEnrollments).set({ status: 'REVOKED' }).where(eq(courseEnrollments.courseId, course.id))
      return range
    })
    await expect(exportIosPdf(h.db, student, lesson.id, { getRange } as unknown as StorageAdapter)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await h.db.update(courseEnrollments).set({ status: 'ACTIVE' }).where(eq(courseEnrollments.courseId, course.id))
  })
})
