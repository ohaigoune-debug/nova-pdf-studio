/**
 * صفحات الخطأ العربية: التلميذ الذي يصادف عطلًا أو رابطًا خاطئًا يرى رسالة عربية وطريق رجوع،
 * لا «Application error» ولا «This page could not be found».
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GET as health } from '@/app/api/v1/health/route'
import ErrorPage from '@/app/error'
import GlobalError from '@/app/global-error'
import NotFound from '@/app/not-found'

const app = join(process.cwd(), 'src', 'app')
const failure = Object.assign(new Error('boom: connection refused'), { digest: '1234567890' })

describe('arabic error pages', () => {
  it('ships the three App Router boundary files', () => {
    for (const f of ['error.tsx', 'global-error.tsx', 'not-found.tsx']) expect(existsSync(join(app, f)), f).toBe(true)
    // حدّا الخطأ يجب أن يكونا مكوّنَي عميل وإلا رفضهما Next عند البناء
    for (const f of ['error.tsx', 'global-error.tsx']) expect(readFileSync(join(app, f), 'utf8').trimStart().startsWith("'use client'"), f).toBe(true)
  })

  it('not-found is Arabic and links back home', () => {
    const html = renderToStaticMarkup(createElement(NotFound))
    expect(html).toContain('الصفحة غير موجودة')
    expect(html).toContain('href="/"')
    expect(html).not.toMatch(/could not be found/i)
  })

  it('error page offers retry and home, shows the digest, and never leaks the raw error', () => {
    const html = renderToStaticMarkup(createElement(ErrorPage, { error: failure, reset: () => {} }))
    expect(html).toContain('حدث خطأ غير متوقع')
    expect(html).toContain('أعد المحاولة')
    expect(html).toContain('href="/"')
    expect(html).toContain('1234567890')
    expect(html).not.toContain('connection refused')
  })

  it('global error renders its own rtl document without the root layout', () => {
    const html = renderToStaticMarkup(createElement(GlobalError, { error: failure, reset: () => {} }))
    expect(html).toMatch(/<html[^>]*lang="ar"[^>]*dir="rtl"/)
    expect(html).toContain('أعد المحاولة')
    expect(html).not.toContain('connection refused')
  })

  it('health endpoint answers 200 without touching the database', async () => {
    const res = health()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('docker healthcheck no longer renders the login page', () => {
    const dockerfile = readFileSync(join(process.cwd(), 'Dockerfile'), 'utf8')
    expect(dockerfile).toContain('/api/v1/health')
    expect(dockerfile).not.toMatch(/HEALTHCHECK.*\/login/)
  })
})
