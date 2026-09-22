import { NextResponse, type NextRequest } from 'next/server'

const SESSION_COOKIE = 'madrasa_session'
const PROTECTED = ['/student', '/teacher', '/assistant', '/admin']

/**
 * سياسة أمن المحتوى (CSP) بـ nonce لكل طلب: لا سكربت مضمّن بلا nonce، ولا مصادر خارجية إلا خطوط Google.
 * Next.js يقرأ الترويسة من الطلب ويضع الـnonce على سكربتاته تلقائياً.
 */
function buildCsp(nonce: string): string {
  const dev = process.env.NODE_ENV !== 'production'
  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    `font-src 'self' data:`,
    `img-src 'self' blob: data: https://i.ytimg.com`,
    `connect-src 'self'${dev ? ' ws: wss:' : ''}`,
    `worker-src 'self'`,
    `manifest-src 'self'`,
    `media-src 'self' blob:`,
    // فيديوهات يوتيوب مضمّنة داخل التطبيق (نسخة الخصوصية المعزّزة) — لا إطارات أخرى
    `frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`
  ]
  if (!dev) directives.push('upgrade-insecure-requests')
  return directives.join('; ')
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // فحص خفيف على الحافة: وجود كوكي الجلسة فقط. التحقق الحقيقي في الخادم.
  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    if (!req.cookies.get(SESSION_COOKIE)?.value) {
      const url = req.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }
  }

  const nonce = btoa(crypto.randomUUID())
  const csp = buildCsp(nonce)
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)
  const res = NextResponse.next({ request: { headers: requestHeaders } })
  res.headers.set('Content-Security-Policy', csp)
  return res
}

export const config = {
  matcher: [
    {
      // كل الصفحات عدا الملفات الثابتة وطلبات الجلب المسبق
      source: '/((?!_next/static|_next/image|favicon.ico|icon.svg|sw.js|manifest.webmanifest|api/).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' }
      ]
    }
  ]
}
