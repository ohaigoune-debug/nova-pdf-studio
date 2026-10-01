/**
 * مولّد البكالوريا التجريبية (Exam Builder — «لاحقاً»: BAC Generator).
 * يبني ورقة بالهيكلة الرسمية للمادة والشعبة (الأجزاء، النقاط، المدة)، ويملأ كل جزء بما يناسبه
 * من البنك (مادة الثالثة ثانوي، الشعبة، الصعوبة، الكلمات المفتاحية)، وما لم يجده يتركه عنصراً
 * موسوماً ليكمله الأستاذ. الورقة قابلة للتعديل كأي امتحان، وتُطبع بنسخ A/B/C/D.
 */
import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { bankQuestions, levels, streams, subjects, type BankQuestionRow } from '@/server/db/schema'
import { resolveBacTemplate, totalPointsOf, type BacTemplate } from '@/lib/bac-templates'
import { assertRole, type Actor } from '@/server/lib/actor'
import { normalizeArabic } from '@/server/lib/arabic'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { addFreeItem, addItemFromBank, createExam, updateItem } from './exams.service'

const ws = (actor: Actor): string => {
  assertRole(actor, 'TEACHER')
  if (!actor.workspaceId) throw new AppError('FORBIDDEN')
  return actor.workspaceId
}

const bucket = (d: number): 1 | 2 | 3 => (d <= 1 ? 1 : d >= 3 ? 3 : 2)

export interface BacBuildResult {
  examId: string
  template: BacTemplate
  filled: number
  missing: string[]
}

/** الأفضل من البنك لجزء: الكلمات المفتاحية أولاً، ثم الصعوبة، ثم الأقل استعمالاً */
function pickFor(part: { keywords: string[]; difficulty: 1 | 2 | 3 }, pool: BankQuestionRow[], used: Set<string>): BankQuestionRow | null {
  const kws = part.keywords.map(normalizeArabic).filter(Boolean)
  let best: BankQuestionRow | null = null
  let bestScore = -1
  for (const q of pool) {
    if (used.has(q.id)) continue
    const text = normalizeArabic(`${q.title ?? ''} ${q.body} ${q.keywords.join(' ')}`)
    const hits = kws.filter((k) => text.includes(k)).length
    const score = hits * 10 + (bucket(q.difficulty) === part.difficulty ? 5 : Math.abs(bucket(q.difficulty) - part.difficulty) === 1 ? 2 : 0) + (q.kind === 'EXERCISE' || q.kind === 'PASSAGE' || q.kind === 'INTEGRATIVE' ? 3 : 0) - Math.min(3, q.usageCount)
    if (kws.length && hits === 0 && best && bestScore >= 10) continue
    if (score > bestScore) {
      best = q
      bestScore = score
    }
  }
  return best
}

/**
 * يبني بكالوريا تجريبية للمادة والشعبة: ورقة BAC_MOCK بالمدة والنقاط الرسمية؛ كل جزء إمّا
 * تمرين من البنك (بعنوان الجزء ونقاطه) أو عنصر موسوم «أكمل: …» يملؤه الأستاذ.
 */
export async function buildBacMock(db: Db, actor: Actor, input: { subjectId: string; streamId: string | null; title?: string | null }): Promise<BacBuildResult> {
  const workspaceId = ws(actor)
  assertUuid(input.subjectId, 'VALIDATION')
  if (input.streamId) assertUuid(input.streamId, 'VALIDATION')
  const [subject] = await db.select({ id: subjects.id, code: subjects.code, name: subjects.nameAr }).from(subjects).where(eq(subjects.id, input.subjectId)).limit(1)
  if (!subject) throw new AppError('VALIDATION', { field: 'subjectId' })
  const [stream] = input.streamId ? await db.select({ id: streams.id, code: streams.code, name: streams.nameAr }).from(streams).where(eq(streams.id, input.streamId)).limit(1) : []
  const [l3] = await db.select({ id: levels.id }).from(levels).where(eq(levels.code, '3AS')).limit(1)
  const template = resolveBacTemplate(subject.code, stream?.code ?? null)
  const pool = await db
    .select()
    .from(bankQuestions)
    .where(
      and(
        isNull(bankQuestions.deletedAt),
        isNull(bankQuestions.parentId),
        eq(bankQuestions.status, 'PUBLISHED'),
        or(eq(bankQuestions.workspaceId, workspaceId), eq(bankQuestions.visibility, 'PUBLIC')),
        eq(bankQuestions.subjectId, subject.id),
        l3 ? or(eq(bankQuestions.levelId, l3.id), isNull(bankQuestions.levelId)) : undefined,
        stream ? or(eq(bankQuestions.streamId, stream.id), isNull(bankQuestions.streamId)) : undefined,
        inArray(bankQuestions.kind, ['EXERCISE', 'PASSAGE', 'PROBLEM', 'INTEGRATIVE', 'QUESTION'])
      )
    )
    .orderBy(desc(bankQuestions.createdAt))
    .limit(500)
  const title = input.title?.trim() || `بكالوريا تجريبية — ${subject.name}${stream ? ` — ${stream.name}` : ''}`
  const exam = await createExam(db, actor, { title, kind: 'BAC_MOCK', subjectId: subject.id, levelId: l3?.id ?? null, streamId: stream?.id ?? null, durationMinutes: template.durationMinutes, targetPoints: totalPointsOf(template), instructions: template.instructions, header: { heading: 'بكالوريا تجريبية' } })
  const used = new Set<string>()
  const missing: string[] = []
  let filled = 0
  for (const part of template.parts) {
    if (part.kind === 'TEXT') {
      await addFreeItem(db, actor, exam.id, { kind: 'TEXT', title: part.title, body: `**${part.title}** — ${part.placeholder}` })
      continue
    }
    const q = pickFor(part, pool, used)
    if (q) {
      used.add(q.id)
      const item = await addItemFromBank(db, actor, exam.id, q.id)
      await updateItem(db, actor, item.id, { title: part.title, points: part.points })
      filled++
    } else {
      await addFreeItem(db, actor, exam.id, { kind: 'EXERCISE', title: `${part.title} — أكمل`, body: `${part.placeholder}\n\n(لم يجد البنك تمريناً مناسباً لهذا الجزء: اكتب التمرين هنا أو اسحبه من البنك ثم احذف هذا العنصر.)`, points: part.points })
      missing.push(part.title)
    }
  }
  await writeAudit(db, { actorUserId: actor.userId, workspaceId, action: 'exam.bac_build', entityType: 'exam', entityId: exam.id, newValue: { subject: subject.code, stream: stream?.code ?? null, filled, missing } })
  return { examId: exam.id, template, filled, missing }
}
