/**
 * بناء الامتحان تلقائياً (Exam Builder — المرحلة 5).
 *  1) من البنك أولاً: اختيار يحترم المادة والصف والشعبة والفصل/الوحدة، وتوزيع الصعوبة (سهل/متوسط/صعب)،
 *     وزمن الحلّ ضمن المدة، مع تفضيل غير المستعمل حديثاً.
 *  2) إن نقص العدد وكان الذكاء الاصطناعي مضبوطاً: يولّد الباقي **مشابهاً لأسئلة البنك** (لا من فراغ)
 *     في مهمة خلفية، ويُدرج في الورقة موسوماً، وتُحفظ نسخة في البنك بانتظار المراجعة.
 *  3) الطلب الحرّ («ابنِ لي اختبار…») يُحوَّل إلى هذه المعاملات ثم يسلك المسار نفسه.
 */
import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { aiFailureReason } from '@/server/ai/failure'
import { aiProviderInfo, getAiProvider } from '@/server/ai/provider'
import type { ExtractedQuestion } from '@/server/ai/types'
import type { Db } from '@/server/db/connect'
import { bankQuestions, curriculumNodes, examItems, levels, streams, subjects, type BankQuestionRow, type ExamItemSnapshot } from '@/server/db/schema'
import type { ExamKind } from '@/server/db/schema/enums'
import { enqueueJob, updateJobProgress, type JobRow } from '@/server/jobs/queue'
import { assertRole, type Actor } from '@/server/lib/actor'
import { normalizeArabic } from '@/server/lib/arabic'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid, isPermanentJobError } from '@/server/lib/errors'
import { addFreeItem, addItemFromBank, createExam, rebalancePoints, snapshotOf, updateExam } from './exams.service'
import { notify } from './notifications.service'
import { contentHashOf, searchTextOf } from './question-bank.service'

export interface DifficultyProfile {
  easy: number
  medium: number
  hard: number
}
export const DEFAULT_PROFILE: DifficultyProfile = { easy: 30, medium: 50, hard: 20 }

export interface GenerateParams {
  title?: string | null
  kind?: ExamKind
  subjectId: string
  levelId: string
  streamId?: string | null
  schoolTerm?: number | null
  curriculumNodeIds?: string[]
  durationMinutes: number
  exercises: number
  targetPoints?: number
  profile?: DifficultyProfile
  /** إن نقص البنك: توليد الباقي بالذكاء الاصطناعي (يحتاج مفتاحاً) */
  allowAi?: boolean
}

export interface SelectionResult {
  picked: BankQuestionRow[]
  /** ما لم يجده البنك، بصعوبة كل ناقص */
  missing: { difficulty: 1 | 2 | 3 }[]
  pool: number
}

const ws = (actor: Actor): string => {
  assertRole(actor, 'TEACHER')
  if (!actor.workspaceId) throw new AppError('FORBIDDEN')
  return actor.workspaceId
}

/** توزيع عدد التمارين على الصعوبات حسب النسب (الباقي للمتوسط) */
export function quotaOf(n: number, profile: DifficultyProfile = DEFAULT_PROFILE): Record<1 | 2 | 3, number> {
  const total = Math.max(1, profile.easy + profile.medium + profile.hard)
  const easy = Math.round((n * profile.easy) / total)
  const hard = Math.round((n * profile.hard) / total)
  const medium = Math.max(0, n - easy - hard)
  return { 1: easy, 2: medium, 3: hard }
}

/** الصعوبة 4 تُعامل كـ«صعب» في الاختيار */
const bucket = (d: number): 1 | 2 | 3 => (d <= 1 ? 1 : d >= 3 ? 3 : 2)

/**
 * اختيار حتمي من البنك: الأقل استعمالاً أولاً، ثم الأقدم استعمالاً، مع احترام الزمن المتاح
 * والعقد المطلوبة (إن حُدّدت فهي شرط؛ وإلا يُفضَّل ما يطابق الفصل).
 */
export async function selectFromBank(db: Db, actor: Actor, p: GenerateParams, exclude: string[] = []): Promise<SelectionResult> {
  const workspaceId = ws(actor)
  assertUuid(p.subjectId, 'VALIDATION')
  assertUuid(p.levelId, 'VALIDATION')
  const rows = await db
    .select()
    .from(bankQuestions)
    .where(
      and(
        isNull(bankQuestions.deletedAt),
        isNull(bankQuestions.parentId),
        eq(bankQuestions.status, 'PUBLISHED'),
        or(eq(bankQuestions.workspaceId, workspaceId), eq(bankQuestions.visibility, 'PUBLIC')),
        eq(bankQuestions.subjectId, p.subjectId),
        eq(bankQuestions.levelId, p.levelId),
        p.streamId ? or(eq(bankQuestions.streamId, p.streamId), isNull(bankQuestions.streamId)) : undefined,
        p.curriculumNodeIds?.length ? inArray(bankQuestions.curriculumNodeId, p.curriculumNodeIds) : undefined,
        exclude.length ? sql`${bankQuestions.id} not in (${sql.join(exclude.map((id) => sql`${id}`), sql`, `)})` : undefined
      )
    )
    .orderBy(asc(bankQuestions.usageCount), asc(sql`coalesce(${bankQuestions.lastUsedAt}, '1970-01-01')`), desc(bankQuestions.createdAt))
    .limit(400)
  // ما يطابق الفصل يتقدّم؛ ثم تمارين قبل أسئلة مفردة (الورقة تمارين أساساً)
  const score = (r: BankQuestionRow) => (p.schoolTerm && r.schoolTerm === p.schoolTerm ? 0 : p.schoolTerm && r.schoolTerm ? 2 : 1) * 10 + (r.kind === 'QUESTION' ? 1 : 0)
  const sorted = [...rows].sort((a, b) => score(a) - score(b))
  const quota = quotaOf(p.exercises, p.profile)
  const picked: BankQuestionRow[] = []
  const missing: SelectionResult['missing'] = []
  let minutes = 0
  const budget = p.durationMinutes
  const seenHash = new Set<string>()
  for (const d of [3, 2, 1] as const) {
    for (let i = 0; i < quota[d]; i++) {
      const cand = sorted.find((r) => !picked.includes(r) && bucket(r.difficulty) === d && !seenHash.has(r.contentHash ?? r.id) && minutes + (r.estimatedMinutes ?? 0) <= budget)
      if (!cand) {
        missing.push({ difficulty: d })
        continue
      }
      picked.push(cand)
      seenHash.add(cand.contentHash ?? cand.id)
      minutes += cand.estimatedMinutes ?? 0
    }
  }
  // مرونة: نقص في صعوبة يُعوَّض بالمتاح من صعوبة مجاورة قبل اللجوء إلى التوليد
  for (let i = missing.length - 1; i >= 0; i--) {
    const cand = sorted.find((r) => !picked.includes(r) && !seenHash.has(r.contentHash ?? r.id) && minutes + (r.estimatedMinutes ?? 0) <= budget)
    if (!cand) break
    picked.push(cand)
    seenHash.add(cand.contentHash ?? cand.id)
    minutes += cand.estimatedMinutes ?? 0
    missing.splice(i, 1)
  }
  return { picked, missing, pool: rows.length }
}

async function names(db: Db, p: GenerateParams) {
  const [s] = await db.select({ n: subjects.nameAr }).from(subjects).where(eq(subjects.id, p.subjectId)).limit(1)
  const [l] = await db.select({ n: levels.nameAr }).from(levels).where(eq(levels.id, p.levelId)).limit(1)
  const [st] = p.streamId ? await db.select({ n: streams.nameAr }).from(streams).where(eq(streams.id, p.streamId)).limit(1) : []
  const nodes = p.curriculumNodeIds?.length ? await db.select({ t: curriculumNodes.title }).from(curriculumNodes).where(inArray(curriculumNodes.id, p.curriculumNodeIds)) : []
  return { subject: s?.n ?? null, level: l?.n ?? null, stream: st?.n ?? null, nodes: nodes.map((n) => n.t) }
}

const TERM_AR = ['', 'الفصل الأول', 'الفصل الثاني', 'الفصل الثالث']

/** بناء فوري من البنك: امتحان مسودة بالعناصر المختارة ونقاط موزّعة على المستهدف */
export async function buildExamFromBank(db: Db, actor: Actor, p: GenerateParams): Promise<{ examId: string; picked: number; missing: number; pool: number }> {
  ws(actor)
  if (p.exercises < 1 || p.exercises > 12) throw new AppError('VALIDATION', { field: 'exercises' })
  const sel = await selectFromBank(db, actor, p)
  const n = await names(db, p)
  const title = p.title?.trim() || `${p.kind === 'HOMEWORK' ? 'فرض' : 'اختبار'} ${p.schoolTerm ? TERM_AR[p.schoolTerm] : ''} في ${n.subject ?? 'المادة'}`.replace(/\s+/g, ' ').trim()
  const exam = await createExam(db, actor, { title, kind: p.kind ?? 'TEST', subjectId: p.subjectId, levelId: p.levelId, streamId: p.streamId ?? null, schoolTerm: p.schoolTerm ?? null, durationMinutes: p.durationMinutes, targetPoints: p.targetPoints ?? 20 })
  for (const q of sel.picked) await addItemFromBank(db, actor, exam.id, q.id)
  if (sel.picked.length) await rebalancePoints(db, actor, exam.id)
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: exam.workspaceId, action: 'exam.auto_build', entityType: 'exam', entityId: exam.id, newValue: { picked: sel.picked.length, missing: sel.missing.length, pool: sel.pool } })
  return { examId: exam.id, picked: sel.picked.length, missing: sel.missing.length, pool: sel.pool }
}

/* ------------------------------ التوليد بالذكاء الاصطناعي ------------------------------ */

/** يبني من البنك ثم يولّد الناقص في الخلفية؛ إن لم ينقص شيء يعود فوراً بلا مهمة */
export async function requestAiBuild(db: Db, actor: Actor, p: GenerateParams): Promise<{ examId: string; jobId: string | null; picked: number; missing: number }> {
  const r = await buildExamFromBank(db, actor, p)
  if (r.missing === 0) return { ...r, jobId: null }
  if (!aiProviderInfo().configured) return { ...r, jobId: null }
  const job = await enqueueJob(db, { type: 'AI_BUILD_EXAM', payload: { examId: r.examId, userId: actor.userId, workspaceId: actor.workspaceId, params: p }, workspaceId: actor.workspaceId, maxAttempts: 2 })
  return { ...r, jobId: job.id }
}

const DIFF_WORD: Record<number, string> = { 1: 'سهل', 2: 'متوسط', 3: 'صعب' }

export async function runBuildExamJob(db: Db, job: JobRow): Promise<Record<string, unknown>> {
  const examId = String(job.payload.examId ?? '')
  const userId = String(job.payload.userId ?? '')
  const workspaceId = String(job.payload.workspaceId ?? '')
  assertUuid(examId, 'EXAM_NOT_FOUND')
  assertUuid(userId, 'NOT_FOUND')
  const p = job.payload.params as GenerateParams
  const actor: Actor = { userId, role: 'TEACHER', fullName: '', email: '', workspaceId, teacherId: null, studentId: null }
  const provider = getAiProvider()
  if (!provider.generateExamItems) throw new AppError('AI_UNAVAILABLE')
  // ما في الورقة الآن هو ما يُستكمل؛ الأمثلة من البنك (المختارة أولاً، ثم عيّنة من نفس المادة والصف)
  const current = await db.select().from(examItems).where(eq(examItems.examId, examId))
  const inExam = current.map((i) => i.bankQuestionId).filter((x): x is string => Boolean(x))
  const sel = await selectFromBank(db, actor, p, inExam)
  const examples = [...current.filter((i) => i.bankQuestionId).map((i) => i.snapshot), ...sel.picked.slice(0, 4).map((q) => snapshotOf(q))].slice(0, 6)
  const need = Math.max(0, p.exercises - current.filter((i) => i.kind === 'EXERCISE' || i.kind === 'QUESTION').length)
  if (need === 0) return { generated: 0 }
  const quota = quotaOf(need, p.profile)
  const n = await names(db, p)
  let generated = 0
  const lastAttempt = job.attempts >= job.maxAttempts
  await updateJobProgress(db, job.id, { totalItems: need, processedItems: 0 })
  for (const d of [3, 2, 1] as const) {
    if (!quota[d]) continue
    let out: ExtractedQuestion[]
    try {
      out = (await provider.generateExamItems({ subject: n.subject, levelName: n.level, streamName: n.stream, units: n.nodes, term: p.schoolTerm ?? null, count: quota[d], difficulty: DIFF_WORD[d]!, minutesEach: Math.max(10, Math.round(p.durationMinutes / p.exercises)), examples: examples.map((e) => ({ body: e.body, solution: e.solution ?? null, children: (e.children ?? []).map((c) => c.body) })) })).items
    } catch (e) {
      if (isPermanentJobError(e) || lastAttempt) await notify(db, { userId, workspaceId, type: 'SYSTEM', title: 'لم يكتمل توليد الامتحان', body: `${aiFailureReason(e)} — الورقة تحوي ما وجده البنك.`, link: `/teacher/exams/${examId}` })
      throw e
    }
    for (const q of out.slice(0, quota[d])) {
      const snapshot: ExamItemSnapshot = { kind: q.kind, type: q.type, title: q.title, body: q.body, options: q.options, answerKey: q.answerKey, solution: q.solution, bareme: [], points: q.points ?? 1, difficulty: q.difficulty, estimatedMinutes: q.estimatedMinutes, sourceLabel: 'مولَّد بالذكاء الاصطناعي — راجعه', keywords: q.keywords, children: q.children.map((c) => ({ kind: c.kind, type: c.type, title: c.title, body: c.body, options: c.options, answerKey: c.answerKey, solution: c.solution, points: c.points ?? 1, difficulty: c.difficulty })) }
      await addFreeItem(db, actor, examId, { kind: 'EXERCISE', body: q.body, title: q.title, points: q.points ?? 1 })
      // النسخة الكاملة (بالحلّ والفرعيات) في العنصر المضاف للتوّ
      const [last] = await db.select().from(examItems).where(eq(examItems.examId, examId)).orderBy(desc(examItems.position)).limit(1)
      if (last) await db.update(examItems).set({ snapshot }).where(eq(examItems.id, last.id))
      // وفي البنك بانتظار المراجعة (لا يُنشر آلياً)
      await db.insert(bankQuestions).values({
        workspaceId,
        authorUserId: userId,
        kind: q.kind,
        type: q.type,
        title: q.title,
        body: q.body,
        options: q.options,
        answerKey: q.answerKey,
        solution: q.solution,
        points: String(q.points ?? 1),
        difficulty: q.difficulty,
        estimatedMinutes: q.estimatedMinutes,
        subjectId: p.subjectId,
        levelId: p.levelId,
        streamId: p.streamId ?? null,
        schoolTerm: p.schoolTerm ?? null,
        examKind: 'TEST',
        sourceLabel: 'مولَّد بالذكاء الاصطناعي',
        rightsStatus: 'OWN',
        keywords: q.keywords,
        status: 'NEEDS_REVIEW',
        contentHash: contentHashOf(q.body),
        searchText: searchTextOf({ title: q.title, body: q.body, solution: q.solution, keywords: q.keywords })
      })
      generated++
      await updateJobProgress(db, job.id, { processedItems: generated })
    }
  }
  if (generated) await rebalancePoints(db, actor, examId)
  await updateExam(db, actor, examId, {})
  await notify(db, { userId, workspaceId, type: 'SYSTEM', title: 'اكتمل بناء الامتحان', body: `${generated} تمريناً مولَّداً بالذكاء الاصطناعي أُضيف إلى الورقة (موسوم «راجعه») ونُسخ إلى بنكك بانتظار المراجعة.`, link: `/teacher/exams/${examId}` })
  return { generated }
}

/* ------------------------------ الطلب الحرّ ------------------------------ */

export interface ParsedRequest {
  subjectId: string | null
  levelId: string | null
  streamId: string | null
  schoolTerm: number | null
  durationMinutes: number | null
  exercises: number | null
  profile: DifficultyProfile | null
  kind: ExamKind
}

const AR_DIGITS = /[٠-٩]/g
const toLatinDigits = (s: string) => s.replace(AR_DIGITS, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))

/**
 * تحويل طلب بالعربية إلى معاملات بلا نموذج: مطابقة أسماء المواد والصفوف والشعب من القاعدة،
 * والأرقام (ساعتان، 4 تمارين…)، والفصل، والصعوبة.
 */
export async function parseExamRequest(db: Db, text: string): Promise<ParsedRequest> {
  const t = normalizeArabic(toLatinDigits(text))
  const [subjectRows, levelRows, streamRows] = await Promise.all([db.select({ id: subjects.id, name: subjects.nameAr, code: subjects.code }).from(subjects), db.select({ id: levels.id, name: levels.nameAr, code: levels.code }).from(levels), db.select({ id: streams.id, name: streams.nameAr, code: streams.code }).from(streams)])
  const pick = <T extends { id: string; name: string; code: string }>(rows: T[], aliases: Record<string, string[]> = {}) => {
    let best: T | null = null
    let bestLen = 0
    for (const r of rows) {
      const keys = [normalizeArabic(r.name), ...(aliases[r.code] ?? []).map(normalizeArabic)]
      for (const k of keys) if (k.length > bestLen && t.includes(k)) { best = r; bestLen = k.length }
    }
    return best
  }
  const subject = pick(subjectRows, { ARABIC: ['العربيه', 'لغه عربيه', 'ادب عربي'], MATH: ['رياضيات'], PHYSICS: ['فيزياء'], SCIENCES: ['علوم طبيعيه', 'علوم الطبيعه'], FRENCH: ['فرنسيه'], ENGLISH: ['انجليزيه', 'انقليزيه'], PHILO: ['فلسفه'], HISTGEO: ['تاريخ', 'جغرافيا'], ISLAMIC: ['علوم اسلاميه', 'اسلاميه'] })
  const level = pick(levelRows, { '3AS': ['ثالثه ثانوي', '3 ثانوي', 'بكالوريا', 'باك'], '2AS': ['ثانيه ثانوي', '2 ثانوي'], '1AS': ['اولى ثانوي', '1 ثانوي'], '4AM': ['رابعه متوسط', 'بيام'], '3AM': ['ثالثه متوسط'], '2AM': ['ثانيه متوسط'], '1AM': ['اولى متوسط'] })
  const stream = pick(streamRows, { SCI: ['علوم تجريبيه', 'علمي', 'علوم'], MATH: ['شعبه رياضيات'], LIT: ['اداب وفلسفه', 'ادبي', 'اداب'], LANG: ['لغات اجنبيه', 'لغات'], GE: ['تسيير واقتصاد', 'تسيير'], TM: ['تقني رياضي', 'تقني'] })
  const term = /الفصل الاول|فصل 1|الفصل 1/.test(t) ? 1 : /الفصل الثاني|فصل 2|الفصل 2/.test(t) ? 2 : /الفصل الثالث|فصل 3|الفصل 3/.test(t) ? 3 : null
  // ملاحظة: \b لا يعمل مع الحروف العربية في JS، فنستعمل حدود المسافات صراحةً (النصّ مطبَّع: ى←ي، ة←ه، لا ترقيم)
  const W = '(?:^|\\s)'
  const E = '(?=\\s|$)'
  const word = (w: string) => new RegExp(`${W}${w}${E}`)
  let duration: number | null = null
  const hm = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:ساعات|ساعه|سا|h)${E}`).exec(t)
  if (hm) duration = Math.round(Number(hm[1]!.replace(',', '.')) * 60)
  else if (/ساعتين|ساعتان/.test(t)) duration = 120
  else if (/ساعه ونصف/.test(t)) duration = 90
  else if (word('ساعه').test(t)) duration = 60
  const mm = new RegExp(`(\\d+)\\s*(?:دقيقه|دقائق|د|min)${E}`).exec(t)
  if (mm) duration = (duration ?? 0) + Number(mm[1])
  const em = /(\d+)\s*(?:تمارين|تمرين|اسئله|سؤال)/.exec(t)
  const exercises = em ? Number(em[1]) : /اربعه تمارين|اربع تمارين/.test(t) ? 4 : /ثلاثه تمارين|ثلاث تمارين/.test(t) ? 3 : /خمسه تمارين|خمس تمارين/.test(t) ? 5 : /سته تمارين|ست تمارين/.test(t) ? 6 : null
  const profile: DifficultyProfile | null = /صعب جدا/.test(t) ? { easy: 0, medium: 30, hard: 70 } : /متوسط الي صعب|متوسط فصعب|متوسط و ?صعب/.test(t) ? { easy: 10, medium: 50, hard: 40 } : word('صعب').test(t) ? { easy: 10, medium: 40, hard: 50 } : word('سهل').test(t) ? { easy: 60, medium: 35, hard: 5 } : /متوسط/.test(t) ? { easy: 25, medium: 60, hard: 15 } : null
  const kind: ExamKind = /فرض/.test(t) ? 'HOMEWORK' : /بكالوريا تجريبيه|باك تجريبي|بكالوريا بيضاء/.test(t) ? 'BAC_MOCK' : /استجواب/.test(t) ? 'QUIZ' : 'TEST'
  return { subjectId: subject?.id ?? null, levelId: level?.id ?? null, streamId: stream?.id ?? null, schoolTerm: term, durationMinutes: duration, exercises, profile, kind }
}
