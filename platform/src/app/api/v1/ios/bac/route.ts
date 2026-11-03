import type { NextRequest } from 'next/server'
import { AppError } from '@/server/lib/errors'
import { iosBacList } from '@/server/services/ios-bac.service'
import { iosApiGet } from '../_respond'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** GET /api/v1/ios/bac?stream=&subject=&year=&cursor= — بنك البكالوريات السابقة (مجاني، كما في /bac) */
export function GET(req: NextRequest) {
  return iosApiGet(req, async (db, actor) => {
    const p = req.nextUrl.searchParams
    const id = (key: string) => {
      const v = (p.get(key) ?? '').trim()
      if (v && !UUID.test(v)) throw new AppError('VALIDATION', { field: key })
      return v || null
    }
    const yearRaw = (p.get('year') ?? '').trim()
    if (yearRaw && !/^\d{4}$/.test(yearRaw)) throw new AppError('VALIDATION', { field: 'year' })
    const cursor = (p.get('cursor') ?? '').trim()
    if (cursor && !/^[A-Za-z0-9_-]{1,200}$/.test(cursor)) throw new AppError('VALIDATION', { field: 'cursor' })
    return iosBacList(db, actor, { streamId: id('stream'), subjectId: id('subject'), year: yearRaw ? Number(yearRaw) : null, cursor: cursor || null })
  })
}
