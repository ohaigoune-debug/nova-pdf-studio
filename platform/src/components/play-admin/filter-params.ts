/** تحويل معاملات العنوان (URL) إلى مرشّح الأسئلة والعكس — مشترك بين الصفحة ومسار التصدير وأزرار العميل */
import { PLAY_DIFFICULTIES, PLAY_QUESTION_TYPES, PLAY_REVIEW_STATUSES, type PlayDifficulty, type PlayQuestionType, type PlayReviewStatus } from '@/server/play/constants'

export interface PlayFilterParams {
  grade?: string | null
  stream?: string | null
  subject?: string | null
  unit?: string | null
  type?: PlayQuestionType | null
  difficulty?: PlayDifficulty | null
  status?: PlayReviewStatus | null
  search?: string | null
  suspended?: boolean | null
  reported?: boolean | null
}

export type RawQuery = Record<string, string | string[] | undefined>

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || null

export function parseFilter(q: RawQuery): PlayFilterParams {
  const type = one(q.type)
  const difficulty = one(q.difficulty)
  const status = one(q.status)
  return {
    grade: one(q.grade),
    stream: one(q.stream),
    subject: one(q.subject),
    unit: one(q.unit),
    type: type && (PLAY_QUESTION_TYPES as readonly string[]).includes(type) ? (type as PlayQuestionType) : null,
    difficulty: difficulty && (PLAY_DIFFICULTIES as readonly string[]).includes(difficulty) ? (difficulty as PlayDifficulty) : null,
    status: status && (PLAY_REVIEW_STATUSES as readonly string[]).includes(status) ? (status as PlayReviewStatus) : null,
    search: one(q.search),
    suspended: one(q.suspended) === '1' ? true : null,
    reported: one(q.reported) === '1' ? true : null
  }
}

export function parsePage(q: RawQuery): number {
  const n = Number(one(q.page) ?? '1')
  return Number.isInteger(n) && n > 0 ? n : 1
}

export function filterToQuery(f: PlayFilterParams, page?: number): string {
  const p = new URLSearchParams()
  for (const k of ['grade', 'stream', 'subject', 'unit', 'type', 'difficulty', 'status', 'search'] as const) {
    const v = f[k]
    if (v) p.set(k, String(v))
  }
  if (f.suspended) p.set('suspended', '1')
  if (f.reported) p.set('reported', '1')
  if (page && page > 1) p.set('page', String(page))
  const s = p.toString()
  return s ? `?${s}` : ''
}

export function hasAnyFilter(f: PlayFilterParams): boolean {
  return Boolean(f.grade || f.stream || f.subject || f.unit || f.type || f.difficulty || f.status || f.search || f.suspended || f.reported)
}
