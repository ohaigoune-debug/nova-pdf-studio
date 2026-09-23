import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GET } from '@/app/download/android/route'
import { apkInfo } from '@/server/lib/android-apk'

describe('تحميل تطبيق أندرويد', () => {
  let dir: string
  const prev = process.env.DOWNLOADS_DIR
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'apk-'))
    process.env.DOWNLOADS_DIR = dir
  })
  afterEach(async () => {
    if (prev === undefined) delete process.env.DOWNLOADS_DIR
    else process.env.DOWNLOADS_DIR = prev
    await rm(dir, { recursive: true, force: true })
  })

  it('قبل البناء: لا زر ولا ملف (404)', async () => {
    expect(await apkInfo()).toBeNull()
    expect((await GET()).status).toBe(404)
  })

  it('بعد النشر: يُحمَّل بنوعه الصحيح واسمه', async () => {
    const bytes = Buffer.from('PK\u0003\u0004 fake apk')
    await writeFile(path.join(dir, 'madrasa.apk'), bytes)
    expect((await apkInfo())?.size).toBe(bytes.length)
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/vnd.android.package-archive')
    expect(res.headers.get('content-disposition')).toContain('madrasa.apk')
    expect(Buffer.from(await res.arrayBuffer()).equals(bytes)).toBe(true)
  })
})

describe('داخل التطبيق لا يُعرض «حمّل التطبيق»', () => {
  it('الإطلاق من التطبيق يُعلَّم بكوكي ويُمرَّر للصفحات، ولا يُقبل من الزائر مزوّراً', async () => {
    const { NextRequest } = await import('next/server')
    const { middleware } = await import('@/middleware')

    const launch = middleware(new NextRequest('https://madrasadz.com/?source=android-app'))
    expect(launch.cookies.get('madrasa_app')?.value).toBe('1')
    expect(launch.headers.get('x-middleware-request-x-madrasa-app')).toBe('1')

    const later = middleware(new NextRequest('https://madrasadz.com/lessons', { headers: { cookie: 'madrasa_app=1' } }))
    expect(later.headers.get('x-middleware-request-x-madrasa-app')).toBe('1')

    const web = middleware(new NextRequest('https://madrasadz.com/', { headers: { 'x-madrasa-app': '1' } }))
    expect(web.headers.get('x-middleware-request-x-madrasa-app')).toBeNull()
    expect(web.cookies.get('madrasa_app')).toBeUndefined()
  })
})
