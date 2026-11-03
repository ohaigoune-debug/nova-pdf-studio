import type { NextRequest } from 'next/server'
import { AppError } from '@/server/lib/errors'
import { iosTestsBank } from '@/server/services/ios-tests.service'
import { iosApiGet } from '../_respond'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** GET /api/v1/ios/tests?term=1..3&level=&subject=&cursor= — بنك الفروض والاختبارات خطوة بعد خطوة (مجاني) */
export function GET(req: NextRequest) {
  return iosApiGet(req, async (db, actor) => {
    const p = req.nextUrl.searchParams
    const id = (key: string) => {
      const v = (p.get(key) ?? '').trim()
      if (v && !UUID.test(v)) throw new AppError('VALIDATION', { field: key })
      return v || null
    }
    const termRaw = (p.get('term') ?? '').trim()
    if (termRaw && !/^[123]$/.test(termRaw)) throw new AppError('VALIDATION', { field: 'term' })
    const cursor = (p.get('cursor') ?? '').trim()
    if (cursor && !/^[A-Za-z0-9_-]{1,200}$/.test(cursor)) throw new AppError('VALIDATION', { field: 'cursor' })
    return iosTestsBank(db, actor, { term: termRaw ? Number(termRaw) : null, levelId: id('level'), subjectId: id('subject'), cursor: cursor || null })
  })
}
