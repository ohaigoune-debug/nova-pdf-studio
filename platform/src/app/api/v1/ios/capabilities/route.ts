import { NextResponse } from 'next/server'
import { iosCapabilities } from '@/server/services/ios-api.service'
import { iosNoStore } from '@/server/services/ios-session.service'

export const dynamic = 'force-dynamic'

/** عامة: يعلن ما يدعمه الخادم، فيقرر التطبيق الشاشات الأصلية أو العرض الحالي /ios */
export function GET() {
  return iosNoStore(NextResponse.json({ ok: true, data: iosCapabilities() }))
}
