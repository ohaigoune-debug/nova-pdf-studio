import { NextResponse, type NextRequest } from 'next/server'
import type { CreatedSession } from '@/server/auth/session'
import type { OAuthOutcome } from '@/server/services/oauth.service'
import { iosNoStore } from '@/server/services/ios-session.service'

/**
 * ردود الدخول بـ Google وApple في تطبيق الآيفون:
 *  signed_in     — مثل /api/v1/auth/login: رمز الجلسة يحفظه التطبيق في Keychain.
 *  needs_profile — حساب جديد: يعرض التطبيق شاشة إكمال الحساب ثم يرسلها إلى /api/v1/ios/auth/complete.
 */
export function signedIn(session: CreatedSession, role: string) {
  return iosNoStore(NextResponse.json({ ok: true, data: { status: 'signed_in', token: session.token, expiresAt: session.expiresAt.toISOString(), role } }))
}

export function outcomeResponse(outcome: OAuthOutcome) {
  if (outcome.kind === 'session') return signedIn(outcome.session, outcome.role)
  return iosNoStore(
    NextResponse.json({
      ok: true,
      data: {
        status: 'needs_profile',
        signupToken: outcome.token,
        fullName: outcome.fullName,
        // البريد الوسيط من Apple لا يُعرض للتلميذ
        email: outcome.email && !outcome.email.endsWith('@privaterelay.appleid.com') ? outcome.email : null
      }
    })
  )
}

export function iosMeta(req: NextRequest) {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || null
  return { userAgent: req.headers.get('user-agent'), ip }
}
