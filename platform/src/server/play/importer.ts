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
  /** صفوف إضافية ربطت أسئلة عامة بنسخ الدرس في مناهج الشعب الأخرى */
  linkedCopies: number
  errors: { key: string; errors: string[] }[]
}

/**
 * يحلّ الدرس بالسنة/المادة/الوحدة/الدرس. إن حمل السؤال شعباً محددة يُفضَّل درس بالشعب نفسها، وإلا درس عام أو أي درس بالرموز نفسها.
 */
export interface ResolvedLesson {
  id: string
  /** نسخ الدرس نفسه في مناهج شعب أخرى، يُربط بها السؤال أيضًا (صفّ لكل نسخة) */
  extra: { id: string; streamCodes: string[] }[]
}

/** مفتاح نسخة السؤال المربوطة بنسخة الدرس في منهاج شعبة أخرى (الأصل يبقى بمفتاحه) */
export function linkedCopyKey(key: string, streamCodes: string[]): string {
  return `${key}~${[...streamCodes].sort().join('-')}`
}

async function lessonIndex(db: Db) {
  const rows = await db.select({ id: playLessons.id, gradeCode: playLessons.gradeCode, subjectCode: playLessons.subjectCode, unitCode: playLessons.unitCode, lessonCode: playLessons.lessonCode, streamCodes: playLessons.streamCodes }).from(playLessons)
  const map = new Map<string, { id: string; streamCodes: string[] }[]>()
  for (const r of rows) {
    const k = `${r.gradeCode}|${r.subjectCode}|${r.unitCode}|${r.lessonCode}`
    const arr = map.get(k) ?? []
    arr.push({ id: r.id, streamCodes: r.streamCodes })
    map.set(k, arr)
  }
  return (grade: string, subject: string, unit: string, lesson: string, streams: string[]): ResolvedLesson | null => {
    const arr = map.get(`${grade}|${subject}|${unit}|${lesson}`)
    if (!arr?.length) return null
    let primary: { id: string; streamCodes: string[] } | undefined
    if (streams.length) {
      primary =
        arr.find((x) => x.streamCodes.length === streams.length && streams.every((s) => x.streamCodes.includes(s))) ??
        arr.find((x) => x.streamCodes.some((s) => streams.includes(s)))
    }
    primary ??= arr.find((x) => x.streamCodes.length === 0) ?? arr[0]!
    // الدرس نفسه قد يوجد في منهاجين (الشعب العلمية، وآداب/لغات) بالرمز نفسه. السؤال العام (بلا شعب) يُربط بكل
    // نسخ الدرس، والسؤال الموجّه لشعب يُربط بكل نسخة تشترك معه في شعبة. كان يُربط بالنسخة الأولى وحدها،
    // فلا يراه تلاميذ الشعب الأخرى في «مراجعة الدروس».
    const p = primary
    const extra = arr.filter((x) => x.id !== p.id && x.streamCodes.length > 0 && (streams.length === 0 || x.streamCodes.some((s) => streams.includes(s))))
    return { id: p.id, extra }
  }
}

export function initialStatus(q: PlayContentQuestion, warnings: string[]): PlayReviewStatus {
  if (q.reviewStatus === 'NEEDS_REVIEW' || q.reviewStatus === 'REJECTED' || q.reviewStatus === 'DRAFT') return q.reviewStatus
  if (warnings.length > 0) return 'NEEDS_REVIEW'
  return 'AUTO_VALIDATED'
}

const MANUAL_STATUSES: PlayReviewStatus[] = ['APPROVED', 'PUBLISHED', 'REJECTED']

export async function importQuestions(db: Db, questions: PlayContentQuestion[], opts: { dryRun?: boolean } = {}): Promise<ImportReport> {
  const resolveLesson = await lessonIndex(db)
  const report: ImportReport = { total: questions.length, inserted: 0, updated: 0, skippedInvalid: 0, skippedNoLesson: 0, linkedCopies: 0, errors: [] }
  type Planned = { q: PlayContentQuestion; warnings: string[]; targets: { key: string; lessonId: string }[] }
  const planned: Planned[] = []
  for (const q of questions) {
    const v = validateContentQuestion(q)
    if (v.errors.length) {
      report.skippedInvalid++
      report.errors.push({ key: q.key, errors: v.errors })
      continue
    }
    const resolved = resolveLesson(q.grade, q.subject, q.unit, q.lesson, q.streams ?? [])
    if (!resolved) {
      report.skippedNoLesson++
      report.errors.push({ key: q.key, errors: [`الدرس غير موجود في المنهاج: ${q.grade}/${q.subject}/${q.unit}/${q.lesson}`] })
      continue
    }
    planned.push({ q, warnings: v.warnings, targets: [{ key: q.key, lessonId: resolved.id }, ...resolved.extra.map((x) => ({ key: linkedCopyKey(q.key, x.streamCodes), lessonId: x.id }))] })
  }
  const allKeys = planned.flatMap((p) => p.targets.map((t) => t.key))
  const existing = new Map<string, { id: string; key: string; reviewStatus: string; contentHash: string }>()
  for (let i = 0; i < allKeys.length; i += 1000) {
    const chunk = allKeys.slice(i, i + 1000)
    const rows = await db.select({ id: playQuestions.id, key: playQuestions.key, reviewStatus: playQuestions.reviewStatus, contentHash: playQuestions.contentHash }).from(playQuestions).where(inArray(playQuestions.key, chunk))
    for (const r of rows) existing.set(r.key, r)
  }
  for (const { q, warnings, targets } of planned) {
    const n = normalizeContentQuestion(q)
    const status = initialStatus(q, warnings)
    report.linkedCopies += targets.length - 1
    for (const [ti, target] of targets.entries()) {
      const prev = existing.get(target.key)
      const primary = ti === 0
      if (opts.dryRun) {
        if (primary) {
          if (prev) report.updated++
          else report.inserted++
        }
        continue
      }
      const base = {
        type: n.type,
        gradeCode: n.gradeCode,
        streamCodes: n.streamCodes,
        subjectCode: n.subjectCode,
        lessonId: target.lessonId,
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
        qualityFlags: warnings,
        note: n.note
      }
      if (prev) {
        // لا نُسقط حالة قرّرها مراجع بشري إلا إذا تغيّر المحتوى
        const keepManual = MANUAL_STATUSES.includes(prev.reviewStatus as PlayReviewStatus) && prev.contentHash === n.contentHash
        await db
          .update(playQuestions)
          .set({ ...base, reviewStatus: keepManual ? prev.reviewStatus : status, updatedAt: new Date(), deletedAt: null })
          .where(eq(playQuestions.id, prev.id))
        if (primary) report.updated++
      } else {
        await db.insert(playQuestions).values({ key: target.key, ...base, reviewStatus: status })
        if (primary) report.inserted++
      }
    }
  }
  return report
}

/** سجلّ تدقيق لتشغيل استيراد كامل (من CLI) */
export async function logImportRun(db: Db, summary: Record<string, unknown>): Promise<void> {
  await db.insert(auditLogs).values({ actorUserId: null, workspaceId: null, action: 'play.import.run', entityType: 'play_question', entityId: null, newValue: summary })
}
