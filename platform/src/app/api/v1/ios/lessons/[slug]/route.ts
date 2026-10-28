import type { NextRequest } from 'next/server'
import { iosApiLesson } from '@/server/services/ios-api.service'
import { iosApiGet } from '../../_respond'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  return iosApiGet(req, (db, actor) => iosApiLesson(db, actor, safeDecode(slug)))
}

function safeDecode(value: string): string {
  try { return decodeURIComponent(value) } catch { return value }
}
