import type { NextRequest } from 'next/server'
import { iosApiHome } from '@/server/services/ios-api.service'
import { iosApiGet } from '../_respond'

export const dynamic = 'force-dynamic'

export function GET(req: NextRequest) {
  return iosApiGet(req, (db, actor) => iosApiHome(db, actor))
}
