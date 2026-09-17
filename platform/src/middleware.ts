import { NextResponse, type NextRequest } from 'next/server'

const SESSION_COOKIE = 'madrasa_session'
const PROTECTED = ['/student', '/teacher', '/admin']

/**
 * فحص خفيف على الحافة: وجود كوكي الجلسة فقط.
 * التحقق الحقيقي (صلاحية الجلسة + الدور) يتم في Layouts والخدمات على الخادم.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    if (!req.cookies.get(SESSION_COOKIE)?.value) {
      const url = req.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/student/:path*', '/teacher/:path*', '/admin/:path*']
}
