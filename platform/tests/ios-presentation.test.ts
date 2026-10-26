import { NextRequest } from 'next/server'
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IOS_CLIENT_HEADER, IOS_PRESENTATION_COOKIE, IOS_PRESENTATION_HEADER, IOS_PRESENTATION_VALUE, iosPresentationRedirect, iosPresentationState } from '@/lib/ios-presentation'
import { config, middleware } from '@/middleware'

afterEach(() => vi.unstubAllEnvs())

function request(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`https://madrasadz.com${path}`, { headers })
}
const cookie = `${IOS_PRESENTATION_COOKIE}=${IOS_PRESENTATION_VALUE}`

describe('fixed iOS presentation, separate from authorization', () => {
  it('activates only through the exact native bootstrap header on /ios', () => {
    expect(iosPresentationState({ pathname: '/ios', clientHeader: 'study-only' })).toEqual({ activate: true, enabled: true })
    for (const pathname of ['/', '/login', '/student', '/ios/lesson/test']) expect(iosPresentationState({ pathname, clientHeader: 'study-only' }).enabled).toBe(false)
    expect(iosPresentationState({ pathname: '/ios', clientHeader: 'review' }).enabled).toBe(false)
    expect(iosPresentationState({ pathname: '/ios', cookie: 'false' }).enabled).toBe(false)
  })

  it('persists a bounded HttpOnly secure preference and forwards a sanitized rendering hint', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const response = middleware(request('/ios', { [IOS_CLIENT_HEADER]: 'study-only' }))
    const saved = response.cookies.get(IOS_PRESENTATION_COOKIE)
    expect(saved).toMatchObject({ value: 'study-only', httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 2_592_000 })
    expect(response.headers.get(`x-middleware-request-${IOS_PRESENTATION_HEADER}`)).toBe('study-only')
    expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'")
  })

  it('does not change ordinary website sales or trust a supplied internal header or User-Agent', () => {
    const response = middleware(request('/store', { [IOS_PRESENTATION_HEADER]: 'study-only', 'user-agent': 'Madrasadz-iOS', [IOS_CLIENT_HEADER]: 'study-only' }))
    expect(response.headers.get('location')).toBeNull()
    expect(response.cookies.get(IOS_PRESENTATION_COOKIE)).toBeUndefined()
    expect(response.headers.get(`x-middleware-request-${IOS_PRESENTATION_HEADER}`)).toBeNull()
  })

  it('keeps the presentation for RSC/SPA prefetches without repeating the native header', () => {
    const headers = { cookie, 'next-router-prefetch': '1', purpose: 'prefetch', rsc: '1' }
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: 'https://madrasadz.com/student/play', headers, cookies: { [IOS_PRESENTATION_COOKIE]: IOS_PRESENTATION_VALUE } })).toBe(true)
    const response = middleware(request('/student/play', { ...headers, cookie: `${cookie}; madrasa_session=existing-session` }))
    expect(response.headers.get(`x-middleware-request-${IOS_PRESENTATION_HEADER}`)).toBe('study-only')
  })

  it('sanitizes a forged internal hint on ordinary prefetches too', () => {
    const headers = { [IOS_PRESENTATION_HEADER]: 'study-only', 'next-router-prefetch': '1' }
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: 'https://madrasadz.com/login', headers })).toBe(true)
    expect(middleware(request('/login', headers)).headers.get(`x-middleware-request-${IOS_PRESENTATION_HEADER}`)).toBeNull()
  })

  it('redirects fixed commerce, activation, community and staff paths for every iOS account', () => {
    for (const path of ['/store', '/store/book', '/student/courses/catalog', '/student/courses/math/order', '/student/courses/orders', '/activate-code', '/claim', '/student/activate', '/forum/thread', '/student/classroom', '/student/classroom/thread', '/student/groups', '/student/groups/example', '/admin/store', '/teacher/content', '/assistant']) {
      const response = middleware(request(path, { cookie }))
      expect(response.status).toBe(307)
      expect(new URL(response.headers.get('location')!).pathname).toBe('/ios')
      expect(new URL(response.headers.get('location')!).searchParams.has('unavailable')).toBe(true)
    }
  })

  it('routes existing login destinations and lesson links to the lean portal', () => {
    expect(iosPresentationRedirect('/')).toBe('/ios')
    expect(iosPresentationRedirect('/student')).toBe('/ios')
    expect(iosPresentationRedirect('/student/')).toBe('/ios')
    expect(iosPresentationRedirect('/student/courses/math')).toBe('/ios/course/math')
    expect(iosPresentationRedirect('/st%6Fre/book')).toBe('/ios?unavailable=commerce')
    expect(iosPresentationRedirect('/STUDENT/courses/math/ORDER')).toBe('/ios?unavailable=commerce')
    expect(iosPresentationRedirect('/%E0%A4')).toBe('/ios?unavailable=route')
    expect(iosPresentationRedirect('/student/lessons/%D8%AF%D8%B1%D8%B3')).toBe('/ios/lesson/%D8%AF%D8%B1%D8%B3')
    for (const path of ['/ios', '/student/profile', '/student/play', '/student/practice', '/student/quizzes', '/student/exams', '/login', '/forgot-password', '/privacy']) expect(iosPresentationRedirect(path)).toBeNull()
  })

  it('does not exempt the native presentation from existing protected-page session checks', () => {
    const response = middleware(request('/student/profile', { cookie }))
    expect(new URL(response.headers.get('location')!).pathname).toBe('/login')
    // Middleware only checks cookie presence; the real session and student guards
    // still run in the layout and services exactly as on the website.
    expect(response.cookies.get('madrasa_session')).toBeUndefined()
  })
})
