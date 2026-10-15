/**
 * يستورد بنك QCM (content/qcm/*.json) كاختبارات عامة «اختبر نفسك».
 * الاستخدام: TEACHER_EMAIL=... DATABASE_URL=... npx tsx src/server/db/import-qcm-bank.ts
 * ملاحظة: الشروح (explanation) غير مخزّنة في الجداول الحالية.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { createSession, resolveActor } from '@/server/auth/session'
import { createDatabase } from '@/server/db/connect'
import { users } from '@/server/db/schema'
import { createQuiz, type QuizInput } from '@/server/services/quizzes.service'

async function main() {
  const url = process.env.DATABASE_URL
  const email = process.env.TEACHER_EMAIL
  if (!url || !email) throw new Error('DATABASE_URL و TEACHER_EMAIL مطلوبان')
  const handle = await createDatabase(url)
  const db = handle.db
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (!u) throw new Error('الأستاذ غير موجود')
  const s = await createSession(db, { userId: u.id, deviceName: 'qcm-import' })
  const actor = await resolveActor(db, s.token)
  if (!actor) throw new Error('تعذّر إنشاء الجلسة')
  const dir = join(process.cwd(), 'content', 'qcm')
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    const raw = JSON.parse(readFileSync(join(dir, f), 'utf-8')) as QuizInput & { questions: (QuizInput['questions'] extends (infer Q)[] | undefined ? Q : never)[] }
    const input: QuizInput = { ...raw, groupIds: [], studentIds: [], questions: raw.questions.map(({ ...q }: any) => { delete q.explanation; delete q.difficulty; delete q.subtopic; return q }) }
    const quiz = await createQuiz(db, actor, input)
    console.log('imported', f, quiz.id, input.questions?.length)
  }
  await handle.close?.()
}

main().catch((e) => { console.error(e); process.exit(1) })
