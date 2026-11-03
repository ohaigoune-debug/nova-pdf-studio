import type { NextRequest } from 'next/server'
import { studentIdOf } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { PLAY_GRADES, streamName } from '@/server/play/constants'
import { getPlayProfile, listSubjectsFor } from '@/server/services/play.service'
import { iosApiGet } from '../../_respond'

export const dynamic = 'force-dynamic'

/** السنوات والشعب المتاحة في PLAY، ليختار التلميذ في التطبيق إن لم تُحدَّد سنته بعد */
const grades = PLAY_GRADES.filter((g) => g.isActive).map((g) => ({ code: g.code, nameAr: g.nameAr, streams: g.streams.map((s) => ({ code: s, nameAr: streamName(s) })) }))

/** GET /api/v1/ios/play/subjects — مواد PLAY لمستوى التلميذ وشعبته */
export function GET(req: NextRequest) {
  return iosApiGet(req, async (db, actor) => {
    if (!actor) throw new AppError('AUTH_REQUIRED')
    studentIdOf(actor)
    const profile = await getPlayProfile(db, actor)
    if (!profile.gradeCode) return { gradeCode: null, streamCode: null, subjects: [], grades }
    return { gradeCode: profile.gradeCode, streamCode: profile.streamCode, subjects: await listSubjectsFor(db, profile.gradeCode, profile.streamCode), grades }
  })
}
