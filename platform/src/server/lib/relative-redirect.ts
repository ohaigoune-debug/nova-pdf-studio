import { NextResponse } from 'next/server'

/**
 * تحويل بمسار نسبي (Location: /…) من Route Handler.
 * خلف الوكيل يحمل req.url في Route Handlers عنوان الخادم الداخلي (https://0.0.0.0:3000)، فيُحوَّل الزائر
 * إلى عنوان لا يُفتح؛ المسار النسبي يبقيه على النطاق الذي جاء منه (madrasadz.com). الحادثة: 22 نوفمبر 2026.
 */
export function redirectPath(path: string, status: 302 | 303 | 307 = 307): NextResponse {
  const safe = path.startsWith('/') && !path.startsWith('//') ? path : '/'
  return new NextResponse(null, { status, headers: { Location: safe, 'Cache-Control': 'no-store' } })
}
