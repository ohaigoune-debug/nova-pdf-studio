import type { NextRequest } from 'next/server'
import { studentIdOf } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { getPlayProfile, listSubjectsFor } from '@/server/services/play.service'
import { iosApiGet } from '../../_respond'

export const dynamic = 'force-dynamic'

/** GET /api/v1/ios/play/subjects — مواد PLAY لمستوى التلميذ وشعبته */
export function GET(req: NextRequest) {
  return iosApiGet(req, async (db, actor) => {
    if (!actor) throw new AppError('AUTH_REQUIRED')
    studentIdOf(actor)
    const profile = await getPlayProfile(db, actor)
    if (!profile.gradeCode) return { gradeCode: null, streamCode: null, subjects: [] }
    return { gradeCode: profile.gradeCode, streamCode: profile.streamCode, subjects: await listSubjectsFor(db, profile.gradeCode, profile.streamCode) }
  })
}
