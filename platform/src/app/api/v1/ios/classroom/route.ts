import type { NextRequest } from 'next/server'
import { iosClassroom } from '@/server/services/ios-classroom.service'
import { iosApiGet } from '../_respond'

export const dynamic = 'force-dynamic'

/** GET /api/v1/ios/classroom?group= — القسم الافتراضي لفوج الدورة (أو كل أفواج التلميذ) */
export async function GET(req: NextRequest) {
  const group = req.nextUrl.searchParams.get('group')
  return iosApiGet(req, (db, actor) => iosClassroom(db, actor, group || null))
}
