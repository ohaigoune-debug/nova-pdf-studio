/**
 * نطاق التلميذ (قرار المالك 15 نوفمبر 2026): التلميذ المسجَّل يرى دروس مستواه وشعبته فقط، مع الدروس المشتركة
 * بين كل شعب مستواه (درس بلا شعبة)، والدروس القديمة غير المصنّفة (بلا مستوى). لا يغيّر النطاقَ إلا هو نفسه
 * من «حسابي» — لا رابط ولا مرشّح في الصفحة.
 *
 * الشرط نفسه يُطبَّق في القوائم وفي فتح الدرس (الخادم)، فتغيير الرابط لا يفتح درسًا من مستوى أو شعبة أخرى.
 * المحتوى الموجَّه لأفواج التلميذ أو له شخصيًا (محتوى دوراته) يبقى خارج هذا الشرط: حقّ الوصول إليه من الاشتراك.
 */
import { and, eq, inArray, isNull, or, type SQL } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { content, levels, streams, students } from '@/server/db/schema'
import { assertRole, studentIdOf, type Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { streamFamily } from './stream-family'
import { listLevels, listStreams, streamFitsLevel, streamsByLevel } from './reference.service'

export interface StudentScope {
  levelId: string | null
  levelCode: string | null
  /** اسم المستوى بلا ما بين القوسين: «السنة الثالثة ثانوي» */
  levelName: string | null
  streamId: string | null
  streamName: string | null
  /** مستوى ثانوي: الشعبة إلزامية (نفس قاعدة التسجيل) */
  needsStream: boolean
  /** المستوى، والشعبة حين تلزم، محفوظان في الحساب: لا مرشّحات للتلميذ */
  complete: boolean
  /** الشعبة وأمّها («تقني رياضي — هندسة مدنية» يرى ما صُنّف لـ«تقني رياضي») */
  streamFamily: string[]
  /** السطر الصغير أعلى القائمة: «السنة الثالثة ثانوي · آداب وفلسفة» */
  label: string | null
}

const isSecondary = (code: string | null | undefined) => Boolean(code && /AS$/i.test(code))
const shortLevelName = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, '').trim()

export async function studentScope(db: Db, studentId: string): Promise<StudentScope> {
  const [row] = await db
    .select({ levelId: students.levelId, streamId: students.streamId, levelCode: levels.code, levelName: levels.nameAr, streamName: streams.nameAr })
    .from(students)
    .leftJoin(levels, eq(levels.id, students.levelId))
    .leftJoin(streams, eq(streams.id, students.streamId))
    .where(eq(students.id, studentId))
    .limit(1)
  const levelId = row?.levelId ?? null
  const needsStream = isSecondary(row?.levelCode)
  // شعبة محفوظة لمستوى لا شعب له (متوسط) لا تُستعمل في التصفية
  const streamId = needsStream ? (row?.streamId ?? null) : null
  const levelName = row?.levelName ? shortLevelName(row.levelName) : null
  const streamName = streamId ? (row?.streamName ?? null) : null
  return {
    levelId,
    levelCode: row?.levelCode ?? null,
    levelName,
    streamId,
    streamName,
    needsStream,
    complete: Boolean(levelId) && (!needsStream || Boolean(streamId)),
    streamFamily: await streamFamily(db, streamId),
    label: levelName ? [levelName, streamName].filter(Boolean).join(' · ') : null
  }
}

/** نطاق صاحب الطلب إن كان تلميذًا، وإلا null (الزائر والمشرف والأستاذ: لا قيد ولا تغيير في مرشّحاتهم) */
export async function studentScopeOf(db: Db, actor: Actor | null | undefined): Promise<StudentScope | null> {
  if (actor?.role !== 'STUDENT' || !actor.studentId) return null
  return studentScope(db, actor.studentId)
}

/**
 * شرط SQL على جدول content: درس من مستوى التلميذ أو بلا مستوى، ومن شعبته (أو أمّها) أو بلا شعبة (مشترك).
 * بلا مستوى في الحساب: لا قيد (لا نعرف ما ليس له؛ تطلب الصفحة اختياره أولًا).
 */
export function contentScopeClause(scope: StudentScope | null): SQL | undefined {
  if (!scope?.levelId) return undefined
  return and(
    or(isNull(content.levelId), eq(content.levelId, scope.levelId)),
    scope.streamFamily.length ? or(isNull(content.streamId), inArray(content.streamId, scope.streamFamily)) : undefined
  )
}

/** الشرط نفسه على صفّ محمَّل (لصفحة الدرس العامة) */
export function contentInScope(scope: StudentScope | null, row: { levelId: string | null; streamId: string | null }): boolean {
  if (!scope?.levelId) return true
  if (row.levelId && row.levelId !== scope.levelId) return false
  if (row.streamId && scope.streamFamily.length && !scope.streamFamily.includes(row.streamId)) return false
  return true
}

/**
 * يحفظ التلميذ مستواه وشعبته في حسابه (أول مرة من «دروسي»، أو تغييرًا من «حسابي»). نفس قواعد التسجيل:
 * الشعبة إلزامية للثانوي ومن شعب سنته؛ المتوسط بلا شعبة.
 */
export async function saveStudentLevelStream(db: Db, actor: Actor, input: { levelId: string; streamId?: string | null }): Promise<StudentScope> {
  assertRole(actor, 'STUDENT')
  const studentId = studentIdOf(actor)
  const [lv] = await db.select({ id: levels.id, code: levels.code }).from(levels).where(eq(levels.id, input.levelId)).limit(1)
  if (!lv) throw new AppError('VALIDATION', { field: 'levelId' })
  let streamId: string | null = null
  if (isSecondary(lv.code)) {
    if (!input.streamId) throw new AppError('VALIDATION', { field: 'streamId' })
    const [st] = await db.select({ id: streams.id }).from(streams).where(eq(streams.id, input.streamId)).limit(1)
    if (!st || !(await streamFitsLevel(db, lv.id, st.id))) throw new AppError('VALIDATION', { field: 'streamId' })
    streamId = st.id
  }
  const updated = await db.update(students).set({ levelId: lv.id, streamId }).where(and(eq(students.id, studentId), eq(students.userId, actor.userId))).returning({ id: students.id })
  if (!updated.length) throw new AppError('FORBIDDEN')
  return studentScope(db, studentId)
}

/** خيارات نموذج المستوى والشعبة: نفس قوائم التسجيل (شعب كل سنة من grade_streams) */
export async function levelStreamOptions(db: Db) {
  const [lv, st, byLevel] = await Promise.all([listLevels(db), listStreams(db), streamsByLevel(db)])
  return {
    levels: lv.map((l) => ({ id: l.id, name: l.nameAr, secondary: isSecondary(l.code), streamIds: byLevel.get(l.id) ?? [] })),
    streams: st.map((s) => ({ id: s.id, name: s.nameAr }))
  }
}
