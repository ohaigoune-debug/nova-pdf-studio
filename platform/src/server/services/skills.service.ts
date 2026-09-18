import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { content, contentTargets, groupStudents, levels, profiles, skills, studentSkillHistory, studentSkills, users } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { assertRole, studentIdOf } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import type { ContentCard } from '@/server/queries/content.queries'

/**
 * محرّك المهارات: كل تقييم معتمد (اختبار آلي، تصحيح أستاذ، لاحقاً AI معتمد)
 * يحدّث مستوى المهارة بمتوسط متحرك ويرفع الثقة تدريجياً. لا يُكتب فوق التاريخ.
 */
const NEW_WEIGHT = 0.4
const CONFIDENCE_FULL_AT = 5
export const WEAK_THRESHOLD = 60

export interface SkillResultInput {
  studentId: string
  skillId: string
  /** 0–100 */
  percent: number
  sourceType: 'QUIZ' | 'ASSIGNMENT' | 'AI_REVIEW' | 'MANUAL'
  sourceId?: string | null
}

export async function recordSkillResult(tx: Db, input: SkillResultInput): Promise<{ score: number; confidence: number; attempts: number }> {
  const pct = Math.max(0, Math.min(100, input.percent))
  const [existing] = await tx
    .select()
    .from(studentSkills)
    .where(and(eq(studentSkills.studentId, input.studentId), eq(studentSkills.skillId, input.skillId)))
    .for('update')
    .limit(1)
  const attempts = (existing?.attempts ?? 0) + 1
  const prev = existing ? Number(existing.score) : null
  const score = Math.round((prev === null ? pct : prev * (1 - NEW_WEIGHT) + pct * NEW_WEIGHT) * 100) / 100
  const confidence = Math.round(Math.min(1, attempts / CONFIDENCE_FULL_AT) * 1000) / 1000
  let id: string
  if (existing) {
    await tx.update(studentSkills).set({ score: String(score), confidence: String(confidence), attempts, lastUpdated: new Date() }).where(eq(studentSkills.id, existing.id))
    id = existing.id
  } else {
    const [row] = await tx
      .insert(studentSkills)
      .values({ studentId: input.studentId, skillId: input.skillId, score: String(score), confidence: String(confidence), attempts, lastUpdated: new Date() })
      .returning({ id: studentSkills.id })
    if (!row) throw new AppError('INTERNAL')
    id = row.id
  }
  await tx.insert(studentSkillHistory).values({ studentSkillId: id, score: String(score), confidence: String(confidence), sourceType: input.sourceType, sourceId: input.sourceId ?? null })
  return { score, confidence, attempts }
}

export interface SkillMapItem {
  skillId: string
  code: string
  name: string
  category: string
  score: number
  confidence: number
  attempts: number
  lastUpdated: Date
}

export async function skillMap(db: Db, studentId: string): Promise<SkillMapItem[]> {
  const rows = await db
    .select({ skillId: skills.id, code: skills.code, name: skills.nameAr, category: skills.category, score: studentSkills.score, confidence: studentSkills.confidence, attempts: studentSkills.attempts, lastUpdated: studentSkills.lastUpdated })
    .from(studentSkills)
    .innerJoin(skills, eq(skills.id, studentSkills.skillId))
    .where(eq(studentSkills.studentId, studentId))
    .orderBy(desc(studentSkills.score))
  return rows.map((r) => ({ ...r, score: Number(r.score), confidence: Number(r.confidence) }))
}

/** خريطة مهارات الطالب لفاعل مخوَّل (الطالب نفسه أو أستاذه أو المشرف) */
export async function skillMapFor(db: Db, actor: Actor, studentId: string): Promise<SkillMapItem[]> {
  if (actor.role === 'STUDENT') {
    if (actor.studentId !== studentId) throw new AppError('FORBIDDEN')
  } else {
    assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
    if (actor.role === 'TEACHER') {
      const [m] = await db
        .select({ id: groupStudents.id })
        .from(groupStudents)
        .where(and(eq(groupStudents.studentId, studentId), eq(groupStudents.workspaceId, actor.workspaceId ?? '')))
        .limit(1)
      if (!m) throw new AppError('NOT_FOUND')
    }
  }
  return skillMap(db, studentId)
}

export async function skillHistory(db: Db, studentId: string, skillId: string) {
  return db
    .select({ score: studentSkillHistory.score, confidence: studentSkillHistory.confidence, sourceType: studentSkillHistory.sourceType, recordedAt: studentSkillHistory.recordedAt })
    .from(studentSkillHistory)
    .innerJoin(studentSkills, eq(studentSkills.id, studentSkillHistory.studentSkillId))
    .where(and(eq(studentSkills.studentId, studentId), eq(studentSkills.skillId, skillId)))
    .orderBy(asc(studentSkillHistory.recordedAt))
}

export interface GroupWeakSkill {
  skillId: string
  name: string
  weakCount: number
  assessed: number
  average: number
  students: string[]
}

/** المهارات الضعيفة المشتركة في فوج (من بيانات حقيقية) */
export async function groupWeakSkills(db: Db, groupId: string, threshold = WEAK_THRESHOLD): Promise<GroupWeakSkill[]> {
  const rows = await db
    .select({ skillId: skills.id, name: skills.nameAr, score: studentSkills.score, fullName: profiles.fullName })
    .from(groupStudents)
    .innerJoin(studentSkills, eq(studentSkills.studentId, groupStudents.studentId))
    .innerJoin(skills, eq(skills.id, studentSkills.skillId))
    .innerJoin(users, sql`${users.id} = (select user_id from students st where st.id = ${groupStudents.studentId})`)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(groupStudents.groupId, groupId), eq(groupStudents.status, 'ACTIVE')))
  const map = new Map<string, GroupWeakSkill & { sum: number }>()
  for (const r of rows) {
    const item = map.get(r.skillId) ?? { skillId: r.skillId, name: r.name, weakCount: 0, assessed: 0, average: 0, students: [], sum: 0 }
    item.assessed++
    item.sum += Number(r.score)
    if (Number(r.score) < threshold) {
      item.weakCount++
      item.students.push(r.fullName ?? '—')
    }
    map.set(r.skillId, item)
  }
  return [...map.values()]
    .map(({ sum, ...x }) => ({ ...x, average: Math.round(sum / x.assessed) }))
    .filter((x) => x.weakCount > 0)
    .sort((a, b) => b.weakCount - a.weakCount)
}

/** محتوى مقترح للطالب لتقوية مهاراته الضعيفة (تعلّم تكيفي مبسّط) */
export async function suggestedContentForStudent(db: Db, actor: Actor, limit = 6): Promise<{ skillName: string; items: ContentCard[] }[]> {
  const studentId = studentIdOf(actor)
  const weak = (await skillMap(db, studentId)).filter((s) => s.score < WEAK_THRESHOLD).slice(0, 3)
  if (weak.length === 0) return []
  const gids = (await db.select({ groupId: groupStudents.groupId }).from(groupStudents).where(eq(groupStudents.studentId, studentId))).map((r) => r.groupId)
  const targeted = db
    .select({ id: contentTargets.contentId })
    .from(contentTargets)
    .where(or(gids.length ? inArray(contentTargets.groupId, gids) : sql`false`, eq(contentTargets.studentId, studentId)))
  const out: { skillName: string; items: ContentCard[] }[] = []
  for (const w of weak) {
    const items = await db
      .select({ id: content.id, slug: content.slug, type: content.type, title: content.title, summary: content.summary, topic: content.topic, levelName: levels.nameAr, authorName: profiles.fullName, publishedAt: content.publishedAt, externalUrl: content.externalUrl })
      .from(content)
      .leftJoin(levels, eq(levels.id, content.levelId))
      .leftJoin(users, eq(users.id, content.authorUserId))
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(and(eq(content.skillId, w.skillId), isNotNull(content.publishedAt), isNull(content.deletedAt), or(inArray(content.visibility, ['PUBLIC', 'STUDENTS_ONLY']), inArray(content.id, targeted))))
      .orderBy(desc(content.publishedAt))
      .limit(limit)
    if (items.length) out.push({ skillName: w.name, items })
  }
  return out
}

/** الطلاب الذين لديهم مهارة ما تحت العتبة داخل مساحة الأستاذ */
export async function weakStudentsForSkill(db: Db, workspaceId: string, skillId: string, threshold = WEAK_THRESHOLD) {
  return db
    .selectDistinct({ studentId: studentSkills.studentId, fullName: profiles.fullName, score: studentSkills.score })
    .from(studentSkills)
    .innerJoin(groupStudents, and(eq(groupStudents.studentId, studentSkills.studentId), eq(groupStudents.workspaceId, workspaceId), eq(groupStudents.status, 'ACTIVE')))
    .innerJoin(users, sql`${users.id} = (select user_id from students st where st.id = ${studentSkills.studentId})`)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(studentSkills.skillId, skillId), lt(studentSkills.score, String(threshold))))
}
