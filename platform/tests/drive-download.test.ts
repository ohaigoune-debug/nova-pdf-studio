/**
 * تنزيل ملفات أرشيف Drive: الحدّ المؤقت ≠ «غير مشارك». في جولة 2026-10 صُنّف 1432 ملفاً عامّاً
 * «DRIVE_NOT_SHARED» لأن Google ردّ بـ403 «حصّة/معدّل» فتُرك. هنا: تمييز السببين، الرجوع إلى الرابط
 * العامّ بلا مفتاح، وإعادة المحاولة بتمهّل — بـ fetch مزيّف ومهل صفرية.
 */
import { describe, expect, it } from 'vitest'
import { AppError } from '@/server/lib/errors'
import { downloadDriveFile, fetchPublicFileBytes, type DriveFile } from '@/server/lib/google-drive'

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])
const file: DriveFile = { id: 'FILE_abcdefghij', name: 'bac-2019-math.pdf', mimeType: 'application/pdf', modifiedTime: '' }
const fast = { retryDelaysMs: [0, 0, 0], sleep: async () => {} }

type Route = (url: URL) => Response
/** fetch مزيّف يميّز بين Drive API (googleapis) والرابط العامّ (usercontent)، ويعدّ النداءات */
function fakeFetch(api: Route, pub: Route) {
  const calls = { api: 0, pub: 0 }
  const f = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    if (url.hostname === 'www.googleapis.com') {
      calls.api++
      return api(url)
    }
    calls.pub++
    return pub(url)
  }) as typeof fetch
  return { f, calls }
}
const pdfResponse = () => new Response(Buffer.from(PDF), { headers: { 'content-type': 'application/octet-stream' } })
const html = (body: string, status = 200) => new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } })
const rateLimited403 = () => new Response('{"error":{"errors":[{"reason":"downloadQuotaExceeded"}],"code":403}}', { status: 403 })

async function code(p: Promise<unknown>): Promise<string | null> {
  try {
    await p
    return null
  } catch (e) {
    return e instanceof AppError ? e.code : 'OTHER'
  }
}

describe('تنزيل ملف من أرشيف Drive العامّ', () => {
  it('403 «حصّة» من Drive API يرجع إلى الرابط العامّ بلا مفتاح وينجح (سبب الـ1432)', async () => {
    const { f, calls } = fakeFetch(rateLimited403, pdfResponse)
    const r = await downloadDriveFile(file, { apiKey: 'k', fetch: f, ...fast })
    expect(Array.from(r.bytes.slice(0, 4))).toEqual([0x25, 0x50, 0x44, 0x46])
    expect(calls).toEqual({ api: 1, pub: 1 })
  })

  it('الحدّ المؤقت في المسارين يُعاد عليه بتمهّل ثم ينجح', async () => {
    let n = 0
    const { f, calls } = fakeFetch(() => new Response('', { status: 429 }), () => (++n < 3 ? html('<title>Sorry</title> unusual traffic from your computer network') : pdfResponse()))
    const slept: number[] = []
    const r = await downloadDriveFile(file, { apiKey: 'k', fetch: f, retryDelaysMs: [5, 10, 20], sleep: async (ms) => void slept.push(ms) })
    expect(r.bytes.byteLength).toBe(PDF.byteLength)
    expect(slept).toEqual([5, 10])
    expect(calls.pub).toBe(3)
  })

  it('الحدّ المستمرّ ينتهي بـ DRIVE_RATE_LIMITED لا DRIVE_NOT_SHARED', async () => {
    const { f, calls } = fakeFetch(rateLimited403, () => new Response('', { status: 429 }))
    expect(await code(downloadDriveFile(file, { apiKey: 'k', fetch: f, ...fast }))).toBe('DRIVE_RATE_LIMITED')
    expect(calls.pub).toBe(4) // محاولة + 3 إعادات
  })

  it('الملف الخاصّ فعلاً يبقى DRIVE_NOT_SHARED ولا يُعاد عليه', async () => {
    const { f, calls } = fakeFetch(() => new Response('{"error":{"code":404}}', { status: 404 }), () => html('<a href="https://accounts.google.com/ServiceLogin">Sign in</a>'))
    expect(await code(downloadDriveFile(file, { apiKey: 'k', fetch: f, ...fast }))).toBe('DRIVE_NOT_SHARED')
    expect(calls).toEqual({ api: 1, pub: 1 })
  })

  it('بلا مفتاح: الرابط العامّ مباشرة', async () => {
    const prev = { g: process.env.GOOGLE_API_KEY, y: process.env.YOUTUBE_API_KEY }
    delete process.env.GOOGLE_API_KEY
    delete process.env.YOUTUBE_API_KEY
    try {
      const { f, calls } = fakeFetch(() => new Response('', { status: 500 }), pdfResponse)
      await downloadDriveFile(file, { fetch: f, ...fast })
      expect(calls).toEqual({ api: 0, pub: 1 })
    } finally {
      if (prev.g !== undefined) process.env.GOOGLE_API_KEY = prev.g
      if (prev.y !== undefined) process.env.YOUTUBE_API_KEY = prev.y
    }
  })

  it('fetchPublicFileBytes: 5xx = حدّ مؤقت، وصفحة «Too Many Requests» = حدّ مؤقت، وصفحة الدخول = غير مشارك', async () => {
    expect(await code(fetchPublicFileBytes(file, { fetch: (async () => new Response('', { status: 503 })) as typeof fetch }))).toBe('DRIVE_RATE_LIMITED')
    expect(await code(fetchPublicFileBytes(file, { fetch: (async () => html('Too Many Requests')) as typeof fetch }))).toBe('DRIVE_RATE_LIMITED')
    expect(await code(fetchPublicFileBytes(file, { fetch: (async () => html('<form action="https://accounts.google.com/ServiceLogin">')) as typeof fetch }))).toBe('DRIVE_NOT_SHARED')
    expect(await code(fetchPublicFileBytes(file, { fetch: (async () => html('', 403)) as typeof fetch }))).toBe('DRIVE_NOT_SHARED')
  })
})
