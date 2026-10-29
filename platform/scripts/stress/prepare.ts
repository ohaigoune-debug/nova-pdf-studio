/**
 * اختبار الضغط — تجهيز قاعدة الاختبار وحدها (لا الإنتاج).
 *
 *   DATABASE_URL=postgres://stress:…@stress-db:5432/stress STRESS_ACCOUNTS=300 \
 *   STRESS_MANIFEST=/out/manifest.json STRESS_OUT=/out/accounts.json npx tsx scripts/stress/prepare.ts
 *
 * يرفض أي قاعدة لا يبدأ اسم مضيفها أو اسمها بـ stress (حماية من استهداف قاعدة حقيقية بالخطأ).
 * ينشئ: البيانات المرجعية + مشرفًا وهميًّا، وحسابات تلاميذ وهمية (3 ثانوي، علوم تجريبية / آداب وفلسفة) مع جلسة
 * لكلّ حساب (الرمز في ملف الخرج فقط، لا في السجلّ)، وقائمة مواضيع البكالوريا المعتمدة لكلّ شعبة بخطواتها التفاعليّة،
 * ومعرّفي إجراءَي «بدء الموضوع» و«إرسال الخطوة» من ملفّ الإجراءات في صورة التطبيق نفسها.
 */
import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { and, eq, inArray } from 'drizzle-orm'
import { createDatabase } from '@/server/db/connect'
import { bootstrapPlatform } from '@/server/db/bootstrap'
import { playExamSets, profiles } from '@/server/db/schema'
import { createSession, resolveActor } from '@/server/auth/session'
import { publicSteps } from '@/server/play/exams/engine'
import { registerStudent } from '@/server/services/auth.service'
import { setPlayProfile } from '@/server/services/play.service'

const N = Number(process.env.STRESS_ACCOUNTS ?? 300)
const OUT = process.env.STRESS_OUT ?? '/out/accounts.json'
const MANIFEST = process.env.STRESS_MANIFEST ?? '/out/manifest.json'
const STREAMS = ['SCI', 'LIT'] as const
const SUBJECTS = ['AR', 'HIST']

function assertStressDatabase(raw: string | undefined): string {
  if (!raw) throw new Error('DATABASE_URL مطلوب')
  if (raw.startsWith('pglite://') && process.env.STRESS_LOCAL_TEST === '1') return raw // تجربة المحرّر محليًّا فقط
  const u = new URL(raw)
  const db = u.pathname.replace(/^\//, '')
  if (!u.hostname.startsWith('stress') || !db.startsWith('stress')) throw new Error(`رفض: ${u.hostname}/${db} ليست قاعدة اختبار الضغط (يجب أن يبدأ المضيف والقاعدة بـ stress)`)
  return raw
}

/** معرّف إجراء الخادم واسم الصفحة التي تحمله، من server-reference-manifest.json (صورة التطبيق نفسها) */
function actionIds(path: string) {
  const m = JSON.parse(readFileSync(path, 'utf8')) as { node: Record<string, { workers: Record<string, { moduleId: string | number }>; exportedName?: string }> }
  const found: Record<string, { id: string; pages: string[] }> = {}
  for (const [id, entry] of Object.entries(m.node)) {
    // بناء الإنتاج: الاسم في exportedName؛ بناء التطوير: داخل moduleId المرمَّز
    if (entry.exportedName) found[entry.exportedName] = { id, pages: Object.keys(entry.workers) }
    for (const w of Object.values(entry.workers)) {
      for (const hit of decodeURIComponent(String(w.moduleId)).matchAll(/"id":"([0-9a-f]+)","exportedName":"(\w+)"/g)) {
        if (hit[1] === id) found[hit[2]!] = { id, pages: Object.keys(entry.workers) }
      }
    }
  }
  const start = found.startExamAttemptAction
  const submit = found.submitExamStepAction
  if (!start || !submit) throw new Error('لم يُعثر على إجراءَي الموضوع في ملفّ الإجراءات')
  return { start: start.id, submit: submit.id, startPages: start.pages, submitPages: submit.pages }
}

async function main() {
  process.env.AUTO_MIGRATE = '1'
  const url = assertStressDatabase(process.env.DATABASE_URL)
  const actions = actionIds(MANIFEST)
  const handle = await createDatabase(url)
  const db = handle.db
  try {
    await bootstrapPlatform(db, { email: 'stress-admin@stress.local', password: randomBytes(18).toString('base64url'), fullName: 'مشرف اختبار الضغط' })

    const sets: Record<string, { uuid: string; setId: string; steps: { id: string; type: string; n: number }[] }[]> = {}
    for (const stream of STREAMS) {
      const rows = await db
        .select({ id: playExamSets.id, setId: playExamSets.setId, streams: playExamSets.streamCodes, doc: playExamSets.document })
        .from(playExamSets)
        .where(and(eq(playExamSets.kind, 'BAC'), eq(playExamSets.gradeCode, '3AS'), inArray(playExamSets.subjectCode, SUBJECTS), eq(playExamSets.publishable, true)))
      sets[stream] = rows
        .filter((r) => !r.streams.length || r.streams.includes(stream))
        .map((r) => ({
          uuid: r.id,
          setId: r.setId,
          steps: publicSteps(r.doc, stream)
            .filter((s) => s.payload.type === 'mcq' || s.payload.type === 'multi')
            .map((s) => ({ id: s.id, type: s.payload.type, n: 'options' in s.payload ? (s.payload.options as unknown[]).length : 0 }))
        }))
        .filter((s) => s.steps.length >= 3)
        .slice(0, 40)
      if (!sets[stream]!.length) throw new Error(`لا مواضيع بكالوريا معتمدة لشعبة ${stream} في قاعدة الاختبار (شغّل import-approved أولًا)`)
    }

    const accounts: { token: string; stream: string }[] = []
    for (let i = 0; i < N; i++) {
      const stream = STREAMS[i % STREAMS.length]!
      const r = await registerStudent(db, { email: `stress${i}@stress.local`, password: 'Stress@12345', fullName: `تلميذ اختبار ${i + 1}` })
      await db.update(profiles).set({ phoneVerifiedAt: new Date() }).where(eq(profiles.userId, r.userId))
      const s = await createSession(db, { userId: r.userId, userAgent: 'madrasa-stress' })
      const actor = await resolveActor(db, s.token)
      if (!actor) throw new Error('جلسة غير صالحة')
      await setPlayProfile(db, actor, { gradeCode: '3AS', streamCode: stream })
      accounts.push({ token: s.token, stream })
      if ((i + 1) % Math.max(50, Math.round(N / 10)) === 0) console.log(`  ${i + 1}/${N} حساب`)
    }
    writeFileSync(OUT, JSON.stringify({ actions, accounts, sets }))
    console.log(`✔ قاعدة الاختبار جاهزة: ${accounts.length} حسابًا، ${sets.SCI!.length} موضوعًا (علوم) و${sets.LIT!.length} (آداب)`)
  } finally {
    await handle.close()
  }
}

main().catch((e) => {
  console.error('✖', e instanceof Error ? e.message : e)
  process.exit(1)
})
