import type { NextRequest } from 'next/server'
import { AppError } from '@/server/lib/errors'
import { PLAY_EXAM_KINDS, type PlayExamKind } from '@/server/play/constants'
import { listExamSets } from '@/server/services/play-exams.service'
import { iosApiGet } from '../../_respond'

export const dynamic = 'force-dynamic'

/** GET /api/v1/ios/play/sets?subject=AR&kind=BAC|DEVOIR|TEST|TESTS — مواضيع المادة (بلا محتوى) */
export function GET(req: NextRequest) {
  return iosApiGet(req, async (db, actor) => {
    if (!actor) throw new AppError('AUTH_REQUIRED')
    const subject = (req.nextUrl.searchParams.get('subject') ?? '').trim().toUpperCase()
    if (!/^[A-Z0-9_]{2,12}$/.test(subject)) throw new AppError('VALIDATION', { field: 'subject' })
    const k = req.nextUrl.searchParams.get('kind')
    const kind = k === 'TESTS' || (PLAY_EXAM_KINDS as readonly string[]).includes(k ?? '') ? (k as PlayExamKind | 'TESTS') : undefined
    return listExamSets(db, actor, { subjectCode: subject, kind })
  })
}
