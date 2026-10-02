/**
 * بناء بنك البكالوريا من سطر الأوامر على الخادم (scripts/bac-bank.sh) بمفتاح OpenAI/Anthropic
 * المحفوظ في لوحة الإدارة (أو AI_API_KEY في ملف البيئة). يبني القاعدة مرة؛ المنصة تقرأ منها دائماً.
 *
 *   --report           تقرير الجرد فقط (بلا كتابة)
 *   --sync             جلب روابط DzExams أولاً (كل المواد؛ 30–60 دقيقة في المرة الأولى)
 *   --drive=<رابط>     استيراد مواضيع/تصحيحات من مجلد Google Drive عامّ (بديل DzExams عند الحجب)
 *   --import-dir=<مسار> استيراد من مجلد على الخادم (scripts/bac-bank.sh يمرّر مجلد import/ تحت /app/import)
 *   --register         تسجيل كل المواضيع الرسمية في البنك
 *   --process[=N]      معالجة N وثيقة بالذكاء الاصطناعي (افتراضي: كل ما ينتظر) في دفعات من 20 مع نقطة تحقّق
 *   --retry-failed     يعيد ما فشل سابقاً (عدا الممسوحة ضوئياً: تبقى في طابور المراجعة)
 *   --auto-verify      يوثّق آلياً الوثائق التي تمرّ كل فحوصاتها الآلية (البنود اليدوية تبقى لمراجعة المشرف)
 *   --details[=N]      حلول مفصّلة للتمارين الموثَّقة/المنشورة بلا حلّ مفصّل (افتراضي: الكل) في دفعات من 25
 *   --all              = --register --process --auto-verify --details  (أضف --sync عند الحاجة)
 *   --subject=MATH     حصر على مادة (رمزها في المنصة)
 *   --parallel=N       عدد الوثائق المتزامنة (افتراضي 2؛ الحدّ 4 احتراماً لحدود المزوّد)
 *   --dry              يعرض ما سيفعله بلا كتابة ولا استدعاء للذكاء الاصطناعي
 */
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import { aiProviderInfo } from '@/server/ai/provider'
import { createDatabase, type Db } from '@/server/db/connect'
import { bankQuestions, examDocuments, profiles, subjects, users } from '@/server/db/schema'
import { pendingJobOfType } from '@/server/jobs/queue'
import type { Actor } from '@/server/lib/actor'
import { installAiUsageSink } from '@/server/services/ai-usage.service'
import { loadAiCredentials } from '@/server/services/ai-credentials.service'
import { autoQuality, bacInventory, detailOne, registerAllBacDocuments, verifyDocument, type BacInventory } from '@/server/services/bac-bank.service'
import { importBacFiles } from '@/server/services/bac-import.service'
import { processDocument, type ProcessResult } from '@/server/services/exam-engine.service'
import { syncBacExams } from './sync'

const args = process.argv.slice(2)
const flag = (name: string) => args.includes(`--${name}`)
const num = (name: string, fallback: number | null): number | null => {
  const a = args.find((x) => x === `--${name}` || x.startsWith(`--${name}=`))
  if (!a) return fallback
  const v = a.includes('=') ? Number(a.split('=')[1]) : null
  return v === null ? null : Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback
}
const str = (name: string): string | null => args.find((x) => x.startsWith(`--${name}=`))?.split('=')[1]?.trim() || null

const all = flag('all')
const opts = {
  report: flag('report'),
  sync: flag('sync'),
  drive: str('drive'),
  importDir: str('import-dir'),
  register: all || flag('register'),
  process: all || args.some((a) => a === '--process' || a.startsWith('--process=')),
  processLimit: num('process', null),
  retryFailed: flag('retry-failed'),
  autoVerify: all || flag('auto-verify'),
  details: all || args.some((a) => a === '--details' || a.startsWith('--details=')),
  detailsLimit: num('details', null),
  subject: str('subject')?.toUpperCase() ?? null,
  parallel: Math.min(4, num('parallel', 2) ?? 2),
  dry: flag('dry')
}
const PROCESS_BATCH = 20
const DETAIL_BATCH = 25

const log = (line: string) => console.log(line)
let stopping = false
process.on('SIGINT', () => {
  stopping = true
  log('… إيقاف بعد إتمام الوثيقة الحالية (نقطة التحقّق محفوظة)')
})

/** أول مشرف عام (ADMIN_EMAIL إن وُجد): تُنسب إليه الأعمال والسجلّ */
async function adminActor(db: Db): Promise<Actor> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const rows = await db
    .select({ id: users.id, email: users.email, fullName: profiles.fullName })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(users.role, 'SUPER_ADMIN'), eq(users.status, 'ACTIVE'), isNull(users.deletedAt), email ? eq(users.email, email) : undefined))
    .orderBy(asc(users.createdAt))
    .limit(1)
  const u = rows[0]
  if (!u) throw new Error('لا مشرف عام في القاعدة — شغّل db:bootstrap أولاً')
  return { userId: u.id, role: 'SUPER_ADMIN', fullName: u.fullName ?? 'المشرف العام', email: u.email, workspaceId: null, teacherId: null, studentId: null }
}

async function subjectIdOf(db: Db, code: string | null): Promise<string | null> {
  if (!code) return null
  const [s] = await db.select({ id: subjects.id }).from(subjects).where(eq(subjects.code, code)).limit(1)
  if (!s) throw new Error(`مادة غير معروفة: ${code}`)
  return s.id
}

/** تنفيذ متزامن محدود مع الحفاظ على ترتيب النتائج */
async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  const worker = async () => {
    while (i < items.length && !stopping) {
      const idx = i++
      out[idx] = await fn(items[idx]!)
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, n) }, worker))
  return out.filter((x) => x !== undefined)
}

function printReport(inv: BacInventory, label: string) {
  const t = inv.totals
  log('')
  log(`━━━ ${label} ━━━`)
  log(`المواضيع المكتشفة: ${t.exams}   مسجّلة في البنك: ${t.registered}   بحلّ رسمي: ${t.withSolution}   بلا حلّ: ${t.missingSolutions}`)
  log(`عُولجت: ${t.processed}   بانتظار المراجعة: ${t.pendingReview}   موثَّقة: ${t.verified}   منشورة: ${t.published}   فشلت: ${t.failed} (ممسوحة ضوئياً: ${t.scanned})`)
  log(`التمارين: ${t.exercises}   مصنَّفة في المنهاج: ${t.classified}   بحلّ مفصّل: ${t.detailed} (موثَّق: ${t.detailedVerified})`)
  log(`التكرارات: ${inv.duplicates.length + inv.pdfDuplicates.length}   أخطاء OCR تنتظر المراجعة: ${inv.ocrErrors.length}   نسبة الإنجاز: ${inv.progress}%`)
  const missing = inv.missingYears.filter((m) => m.years.length)
  if (missing.length) log(`سنوات ناقصة: ${missing.map((m) => `${m.subjectName} (${m.years.join('، ')})`).join(' · ')}`)
  if (inv.ocrErrors.length) log(`يحتاج مراجعة بشرية (لا تخمين): ${inv.ocrErrors.slice(0, 10).map((e) => e.title).join(' · ')}${inv.ocrErrors.length > 10 ? ' …' : ''}`)
  log('')
}

async function main() {
  const db = (await createDatabase(process.env.DATABASE_URL ?? 'pglite://./data/pglite')).db
  await loadAiCredentials(db)
  installAiUsageSink(db)
  const ai = aiProviderInfo()
  const needsAi = opts.process || opts.details
  if (needsAi && !opts.dry && !ai.configured) throw new Error('لا مفتاح ذكاء اصطناعي: احفظه من لوحة الإدارة (الإعدادات → الذكاء الاصطناعي) أو AI_API_KEY في ملف البيئة')
  log(`المزوّد: ${ai.configured ? `${ai.name} / ${ai.model} (${ai.source === 'admin' ? 'مفتاح لوحة الإدارة' : 'ملف البيئة'})` : 'غير مهيّأ'}${opts.dry ? ' — تجربة بلا كتابة' : ''}`)
  const actor = await adminActor(db)
  const subjectId = await subjectIdOf(db, opts.subject)
  const inv0 = await bacInventory(db, actor)
  printReport(inv0, 'الحالة قبل التشغيل')
  if (opts.report || (!opts.sync && !opts.drive && !opts.importDir && !opts.register && !opts.process && !opts.autoVerify && !opts.details)) return

  // 1) جلب روابط DzExams (روابط فقط؛ الملفات تُنزَّل عند المعالجة)
  if (opts.sync && !stopping) {
    log('▶ جلب DzExams …')
    const r = await syncBacExams(opts.dry ? null : db, { dry: opts.dry, maxExams: opts.dry ? 3 : undefined, maxPagesPerListing: opts.dry ? 1 : undefined, subjects: opts.dry ? ['arabe'] : undefined, log })
    log(`✔ الجلب: ${r.found} موضوعاً في ${r.subjects} مادة، حُفظ ${r.saved}، أخطاء ${r.errors}`)
  }

  // 1ب) استيراد ملفات (Drive أو مجلد الخادم): المكرّر يُتجاهل، وغير المصنَّف يُعرض ولا يُخمَّن
  for (const source of [opts.drive ? { kind: 'drive' as const, folderUrl: opts.drive } : null, opts.importDir ? { kind: 'dir' as const, dir: opts.importDir } : null]) {
    if (!source || stopping) continue
    log(`▶ استيراد ${source.kind === 'drive' ? 'من Drive' : `من ${source.dir}`} …`)
    if (opts.dry) {
      log('(تجربة) يُسرد المجلد فقط عند التشغيل الفعلي')
      continue
    }
    const r = await importBacFiles(db, actor, source, { useAi: ai.configured, onProgress: (d, t, last) => log(`  ${d}/${t} ${last}`) })
    for (const i of r.items) if (i.outcome !== 'exam' && i.outcome !== 'correction') log(`  ${i.outcome === 'duplicate' ? '=' : '✖'} ${i.name} — ${i.reason ?? ''}`)
    log(`✔ الاستيراد: ${r.exams} موضوعاً، ${r.corrections} تصحيحاً، ${r.duplicates} مكرّر، ${r.unclassified} بلا تصنيف، ${r.errors} خطأ${r.scanned ? `، ${r.scanned} مصوّر (OCR لاحقاً)` : ''}`)
  }

  // 2) تسجيل كل المواضيع الرسمية كوثائق للبنك
  if (opts.register && !stopping) {
    if (opts.dry) {
      const [c] = await db.execute<{ n: number }>(sql`select count(*)::int as n from resources r where r.deleted_at is null and r.type = 'EXAM' and r.is_official and r.status = 'PUBLISHED' and r.subject_id is not null and not exists (select 1 from exam_documents d where d.resource_id = r.id)`).then((x) => (Array.isArray(x) ? x : (x as { rows: { n: number }[] }).rows))
      log(`(تجربة) سيُسجَّل ${c?.n ?? 0} موضوعاً`)
    } else {
      const r = await registerAllBacDocuments(db, actor, { limit: 5000, subjectCode: opts.subject })
      log(`✔ التسجيل: ${r.registered} جديد من ${r.candidates} مرشّح ${Object.entries(r.bySubject).map(([k, v]) => `${k}:${v}`).join(' ')}`)
    }
  }

  // 3) المعالجة: OCR/نصّ → تمارين وأسئلة وحلول → تصنيف في المنهاج (الذكاء الاصطناعي الحقيقي)
  const summary = { processed: 0, needsReview: 0, failed: 0, exercises: 0, verified: 0, detailed: 0, detailFailed: 0 }
  if (opts.process && !stopping) {
    const running = await pendingJobOfType(db, 'EXAM_DOC_PROCESS', null)
    if (running) log(`⚠ مهمة معالجة تعمل من اللوحة (${running.id}) — تُترك لها وثائقها؛ تُعالَج هنا الوثائق المنتظرة الأخرى فقط`)
    const statuses = opts.retryFailed ? ['PENDING', 'FAILED'] : ['PENDING']
    const ids = (
      await db
        .select({ id: examDocuments.id, title: examDocuments.title })
        .from(examDocuments)
        .where(and(inArray(examDocuments.status, statuses as ('PENDING' | 'FAILED')[]), eq(examDocuments.docType, 'BAC'), subjectId ? eq(examDocuments.subjectId, subjectId) : undefined, opts.retryFailed ? sql`coalesce(${examDocuments.error}, '') not like '%scanned%'` : undefined))
        .orderBy(desc(examDocuments.examYear), asc(examDocuments.createdAt))
        .limit(opts.processLimit ?? 100000)
    ).filter((d) => !(Array.isArray(running?.payload.documentIds) && running!.payload.documentIds.map(String).includes(d.id)))
    log(`▶ المعالجة: ${ids.length} وثيقة في دفعات من ${PROCESS_BATCH} (متزامن ${opts.parallel})`)
    if (opts.dry) ids.slice(0, 10).forEach((d) => log(`  · ${d.title}`))
    else
      for (let b = 0; b < ids.length && !stopping; b += PROCESS_BATCH) {
        const batch = ids.slice(b, b + PROCESS_BATCH)
        const results = await pool(batch, opts.parallel, async (d): Promise<ProcessResult> => {
          const r = await processDocument(db, d.id, { userId: actor.userId })
          log(`  ${r.status === 'NEEDS_REVIEW' ? '✔' : '✖'} ${r.title}: ${r.status === 'NEEDS_REVIEW' ? `${r.exercises} تمريناً${r.duplicates ? `، ${r.duplicates} مكرّر` : ''}` : `فشل — ${r.error ?? ''}`}`)
          return r
        })
        for (const r of results) {
          summary.processed++
          if (r.status === 'NEEDS_REVIEW') {
            summary.needsReview++
            summary.exercises += r.exercises
          } else summary.failed++
        }
        log(`— نقطة تحقّق: دفعة ${Math.floor(b / PROCESS_BATCH) + 1}/${Math.ceil(ids.length / PROCESS_BATCH)} · عُولج ${summary.processed} · للمراجعة ${summary.needsReview} · فشل ${summary.failed} · تمارين ${summary.exercises}`)
      }
  }

  // 4) التوثيق الآلي: فقط ما تمرّ كل فحوصاته الآلية؛ البنود اليدوية (الأرقام/المعادلات/الأشكال/السلّم/الاكتمال) تبقى للمشرف
  if (opts.autoVerify && !stopping) {
    const docs = await db
      .select()
      .from(examDocuments)
      .where(and(eq(examDocuments.status, 'NEEDS_REVIEW'), eq(examDocuments.docType, 'BAC'), subjectId ? eq(examDocuments.subjectId, subjectId) : undefined))
      .orderBy(desc(examDocuments.examYear))
    let skipped = 0
    const why: Record<string, number> = {}
    for (const doc of docs) {
      if (stopping) break
      const auto = await autoQuality(db, doc)
      const failing = Object.entries(auto).filter(([, v]) => v !== true).map(([k]) => k)
      if (failing.length) {
        skipped++
        failing.forEach((k) => (why[k] = (why[k] ?? 0) + 1))
        continue
      }
      if (!opts.dry) await verifyDocument(db, actor, doc.id, { ...auto, note: 'توثيق آلي للبنود المحسوبة؛ البنود اليدوية بانتظار المشرف' })
      summary.verified++
    }
    const AUTO_AR: Record<string, string> = { year: 'السنة', subject: 'المادة', stream: 'الشعبة', pages: 'الصفحات', questions: 'الأسئلة', solution: 'الحلّ الرسمي', notDuplicate: 'مكرّر' }
    log(`✔ التوثيق الآلي: ${summary.verified} وثيقة${opts.dry ? ' (تجربة)' : ''}، ${skipped} تبقى للمراجعة اليدوية${skipped ? ` (ينقصها: ${Object.entries(why).map(([k, v]) => `${AUTO_AR[k] ?? k} ${v}`).join('، ')})` : ''}`)
  }

  // 5) الحلول المفصّلة: تمرين تلو الآخر، تُبنى مرة وتُحفظ غير موثَّقة حتى يراجعها المشرف
  if (opts.details && !stopping) {
    const qs = await db
      .select({ id: bankQuestions.id })
      .from(bankQuestions)
      .innerJoin(examDocuments, eq(examDocuments.id, bankQuestions.documentId))
      .where(and(isNull(bankQuestions.workspaceId), isNull(bankQuestions.parentId), isNull(bankQuestions.deletedAt), isNotNull(bankQuestions.documentId), isNull(bankQuestions.solutionDetail), sql`${bankQuestions.status} <> 'ARCHIVED'`, inArray(examDocuments.status, ['VERIFIED', 'PUBLISHED']), subjectId ? eq(examDocuments.subjectId, subjectId) : undefined))
      .orderBy(desc(bankQuestions.sourceYear), asc(bankQuestions.sourceExerciseNo))
      .limit(opts.detailsLimit ?? 100000)
    log(`▶ الحلول المفصّلة: ${qs.length} تمريناً في دفعات من ${DETAIL_BATCH}`)
    if (!opts.dry)
      for (let b = 0; b < qs.length && !stopping; b += DETAIL_BATCH) {
        const batch = qs.slice(b, b + DETAIL_BATCH)
        const rs = await pool(batch, opts.parallel, (q) => detailOne(db, q.id, actor.userId))
        for (const r of rs) {
          if (r.ok) summary.detailed++
          else {
            summary.detailFailed++
            log(`  ✖ ${r.title}: ${r.error ?? ''}`)
          }
        }
        log(`— نقطة تحقّق: حلول ${summary.detailed} تمّت · ${summary.detailFailed} فشلت`)
      }
  }

  const inv1 = await bacInventory(db, actor)
  printReport(inv1, 'تقرير الدفعة')
  log(`هذه الجولة: عُولج ${summary.processed} (للمراجعة ${summary.needsReview}، فشل ${summary.failed})، تمارين جديدة ${summary.exercises}، وُثّق آلياً ${summary.verified}، حلول مفصّلة ${summary.detailed}${summary.detailFailed ? ` (فشل ${summary.detailFailed})` : ''}`)
  log(`الخطوة البشرية التالية: /admin/bac-bank → اعتماد الوثائق الموثَّقة (نشر) ومراجعة طابور الحلول المفصّلة. لا يرى التلاميذ شيئاً قبل ذلك.`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
