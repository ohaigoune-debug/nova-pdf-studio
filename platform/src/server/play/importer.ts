/**
 * MADRASADZ PLAY — مزامنة المنهاج واستيراد الأسئلة (Idempotent).
 * - syncCatalog: upsert للمواد والدروس من content/play/catalog.json (لا حذف؛ الدروس الغائبة تبقى).
 * - importQuestions: upsert بالـ key الثابت؛ يعيد تشغيله آمن. لا يغيّر حالة سؤال اعتمده الأستاذ يدوياً.
 */
import { and, eq, inArray } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { auditLogs, playLessons, playQuestions, playSubjects } from '@/server/db/schema'
import { PLAY_SUBJECTS, type PlayReviewStatus } from './constants'
import { normalizeContentQuestion, validateContentQuestion } from './engine'
import type { PlayContentQuestion } from './question-types'

export interface CatalogLesson {
  code: string
  name: string
  objective?: string
  verified?: boolean
}
export interface CatalogUnit {
  code: string
  name: string
  verified?: boolean
  lessons: CatalogLesson[]
}
export interface CatalogSubjectEntry {
  subject: string
  streams?: string[]
  units: CatalogUnit[]
}
export interface CatalogGrade {
  grade: string
  subjects: CatalogSubjectEntry[]
}
export interface PlayCatalog {
  version: number
  grades: CatalogGrade[]
}

export async function syncSubjects(db: Db) {
  for (const s of PLAY_SUBJECTS) {
    await db
      .insert(playSubjects)
      .values({ code: s.code, nameAr: s.nameAr, nameFr: s.nameFr, language: s.language, color: s.color, icon: s.icon, sortOrder: s.sortOrder })
      .onConflictDoUpdate({ target: playSubjects.code, set: { nameAr: s.nameAr, nameFr: s.nameFr, language: s.language, color: s.color, icon: s.icon, sortOrder: s.sortOrder, updatedAt: new Date() } })
  }
}

export async function syncCatalog(db: Db, catalog: PlayCatalog): Promise<{ lessons: number; inserted: number; updated: number }> {
  await syncSubjects(db)
  let lessons = 0
  let inserted = 0
  let updated = 0
  for (const g of catalog.grades) {
    for (const entry of g.subjects) {
      const streamCodes = [...(entry.streams ?? [])].sort()
      let unitOrder = 0
      for (const u of entry.units) {
        unitOrder++
        let lessonOrder = 0
        for (const l of u.lessons) {
          lessonOrder++
          lessons++
          const [existing] = await db
            .select({ id: playLessons.id })
            .from(playLessons)
            .where(and(eq(playLessons.gradeCode, g.grade), eq(playLessons.subjectCode, entry.subject), eq(playLessons.unitCode, u.code), eq(playLessons.lessonCode, l.code), eq(playLessons.streamCodes, streamCodes)))
            .limit(1)
          const values = {
            unitName: u.name,
            unitOrder,
            lessonName: l.name,
            lessonOrder,
            objective: l.objective ?? null,
            verified: Boolean(l.verified && u.verified !== false)
          }
          if (existing) {
            await db.update(playLessons).set({ ...values, updatedAt: new Date() }).where(eq(playLessons.id, existing.id))
            updated++
          } else {
            await db.insert(playLessons).values({ gradeCode: g.grade, streamCodes, subjectCode: entry.subject, unitCode: u.code, lessonCode: l.code, ...values })
            inserted++
          }
        }
      }
    }
  }
  return { lessons, inserted, updated }
}

export interface ImportReport {
  total: number
  inserted: number
  updated: number
  skippedInvalid: number
  skippedNoLesson: number
  errors: { key: string; errors: string[] }[]
}

/**
 * يحلّ الدرس بالسنة/المادة/الوحدة/الدرس. إن حمل السؤال شعباً محددة يُفضَّل درس بالشعب نفسها، وإلا درس عام أو أي درس بالرموز نفسها.
 */
async function lessonIndex(db: Db) {
  const rows = await db.select({ id: playLessons.id, gradeCode: playLessons.gradeCode, subjectCode: playLessons.subjectCode, unitCode: playLessons.unitCode, lessonCode: playLessons.lessonCode, streamCodes: playLessons.streamCodes }).from(playLessons)
  const map = new Map<string, { id: string; streamCodes: string[] }[]>()
  for (const r of rows) {
    const k = `${r.gradeCode}|${r.subjectCode}|${r.unitCode}|${r.lessonCode}`
    const arr = map.get(k) ?? []
    arr.push({ id: r.id, streamCodes: r.streamCodes })
    map.set(k, arr)
  }
  return (grade: string, subject: string, unit: string, lesson: string, streams: string[]): string | null => {
    const arr = map.get(`${grade}|${subject}|${unit}|${lesson}`)
    if (!arr?.length) return null
    if (streams.length) {
      const exact = arr.find((x) => x.streamCodes.length === streams.length && streams.every((s) => x.streamCodes.includes(s)))
      if (exact) return exact.id
      const overlapping = arr.find((x) => x.streamCodes.some((s) => streams.includes(s)))
      if (overlapping) return overlapping.id
    }
    const generic = arr.find((x) => x.streamCodes.length === 0)
    return (generic ?? arr[0])!.id
  }
}

/** الحالة الابتدائية عند الاستيراد: AUTO_VALIDATED إذا اجتاز الفحص بلا تحذيرات، NEEDS_REVIEW إذا وُجدت تحذيرات أو طُلب ذلك */
export function initialStatus(q: PlayContentQuestion, warnings: string[]): PlayReviewStatus {
  if (q.reviewStatus === 'NEEDS_REVIEW' || q.reviewStatus === 'REJECTED' || q.reviewStatus === 'DRAFT') return q.reviewStatus
  if (warnings.length > 0) return 'NEEDS_REVIEW'
  return 'AUTO_VALIDATED'
}

const MANUAL_STATUSES: PlayReviewStatus[] = ['APPROVED', 'PUBLISHED', 'REJECTED']

export async function importQuestions(db: Db, questions: PlayContentQuestion[], opts: { dryRun?: boolean } = {}): Promise<ImportReport> {
  const resolveLesson = await lessonIndex(db)
  const report: ImportReport = { total: questions.length, inserted: 0, updated: 0, skippedInvalid: 0, skippedNoLesson: 0, errors: [] }
  const keys = questions.map((q) => q.key)
  const existingRows = keys.length ? await db.select({ id: playQuestions.id, key: playQuestions.key, reviewStatus: playQuestions.reviewStatus, contentHash: playQuestions.contentHash }).from(playQuestions).where(inArray(playQuestions.key, keys)) : []
  const existing = new Map(existingRows.map((r) => [r.key, r]))
  for (const q of questions) {
    const v = validateContentQuestion(q)
    if (v.errors.length) {
      report.skippedInvalid++
      report.errors.push({ key: q.key, errors: v.errors })
      continue
    }
    const lessonId = resolveLesson(q.grade, q.subject, q.unit, q.lesson, q.streams ?? [])
    if (!lessonId) {
      report.skippedNoLesson++
      report.errors.push({ key: q.key, errors: [`الدرس غير موجود في المنهاج: ${q.grade}/${q.subject}/${q.unit}/${q.lesson}`] })
      continue
    }
    const n = normalizeContentQuestion(q)
    const status = initialStatus(q, v.warnings)
    const prev = existing.get(q.key)
    if (opts.dryRun) {
      if (prev) report.updated++
      else report.inserted++
      continue
    }
    const base = {
      type: n.type,
      gradeCode: n.gradeCode,
      streamCodes: n.streamCodes,
      subjectCode: n.subjectCode,
      lessonId,
      unitCode: n.unitCode,
      lessonCode: n.lessonCode,
      objective: n.objective,
      difficulty: n.difficulty,
      language: n.language,
      questionText: n.questionText,
      payload: n.payload,
      answerKey: n.answerKey,
      explanation: n.explanation,
      tags: n.tags,
      contentHash: n.contentHash,
      source: n.source,
      qualityFlags: v.warnings,
      note: n.note
    }
    if (prev) {
      // لا نُسقط حالة قرّرها مراجع بشري إلا إذا تغيّر المحتوى
      const keepManual = MANUAL_STATUSES.includes(prev.reviewStatus as PlayReviewStatus) && prev.contentHash === n.contentHash
      await db
        .update(playQuestions)
        .set({ ...base, reviewStatus: keepManual ? prev.reviewStatus : status, updatedAt: new Date(), deletedAt: null })
        .where(eq(playQuestions.id, prev.id))
      report.updated++
    } else {
      await db.insert(playQuestions).values({ key: n.key, ...base, reviewStatus: status })
      report.inserted++
    }
  }
  return report
}

/** سجلّ تدقيق لتشغيل استيراد كامل (من CLI) */
export async function logImportRun(db: Db, summary: Record<string, unknown>): Promise<void> {
  await db.insert(auditLogs).values({ actorUserId: null, workspaceId: null, action: 'play.import.run', entityType: 'play_question', entityId: null, newValue: summary })
}
