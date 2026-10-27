/**
 * A permanent presentation preference, never an authentication or entitlement.
 * Native and browser users still pass all ordinary server permission checks.
 */
export const IOS_PRESENTATION_COOKIE = 'madrasa_ios_study'
export const IOS_PRESENTATION_VALUE = 'study-only'
export const IOS_PRESENTATION_HEADER = 'x-madrasa-ios-presentation'
export const IOS_CLIENT_HEADER = 'x-madrasadz-ios-client'

export function iosPresentationState(input: { pathname: string; cookie?: string; clientHeader?: string | null }) {
  const activate = input.pathname === '/ios' && input.clientHeader === IOS_PRESENTATION_VALUE
  return { activate, enabled: activate || input.cookie === IOS_PRESENTATION_VALUE }
}

function under(path: string, prefix: string) { return path === prefix || path.startsWith(prefix + '/') }

/** Fixed learning-only routes, independent of reviewer/account/time/device identity. */
export function iosPresentationRedirect(pathname: string): string | null {
  let path: string
  try { path = decodeURIComponent(pathname).replace(/\/+$/, '') || '/' }
  catch { return '/ios?unavailable=route' }
  if (!path.startsWith('/') || path.startsWith('//') || /[\\\x00-\x1f]/.test(path)) return '/ios?unavailable=route'
  const matchPath = path.toLowerCase()
  if (['/store', '/track', '/claim', '/activate-code', '/student/store', '/student/cart', '/student/orders', '/student/codes', '/student/activate', '/student/activate-code', '/student/enroll'].some((prefix) => under(matchPath, prefix))
    || under(matchPath, '/student/courses/catalog') || under(matchPath, '/student/courses/orders')
    || /^\/student\/courses\/[^/]+\/order(?:\/|$)/.test(matchPath)) return '/ios?unavailable=commerce'
  // Owner decision (2026-10-27): the teacher-led virtual classroom is available in the
  // internal iPhone build. The open forum and group directory stay out of scope.
  // App Review still requires report/block/filter/contact safeguards (guideline 1.2).
  if (['/forum', '/student/forum', '/student/groups'].some((prefix) => under(matchPath, prefix))) return '/ios?unavailable=community'
  if (['/admin', '/teacher', '/assistant', '/print'].some((prefix) => under(matchPath, prefix))) return '/ios?unavailable=role'
  if (['/', '/student', '/student/courses', '/student/lessons', '/lessons'].includes(matchPath)) return '/ios'
  const course = path.match(/^\/student\/courses\/([^/]+)$/i)
  if (course) return `/ios/course/${encodeURIComponent(course[1]!)}`
  const lesson = path.match(/^\/(?:student\/)?lessons\/([^/]+)$/i)
  if (lesson) return `/ios/lesson/${encodeURIComponent(lesson[1]!)}`
  return null
}
