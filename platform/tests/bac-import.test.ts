import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { guessBacFile } from '@/lib/bac-bank'
import { setAiProviderForTests } from '@/server/ai/provider'
import type { AIProvider, ClassifyBacFileInput, ExtractQuestionsInput } from '@/server/ai/types'
import type { DatabaseHandle } from '@/server/db/connect'
import { examDocuments, resources } from '@/server/db/schema'
import { seedCurriculum } from '@/server/db/seed-curriculum'
import type { Actor } from '@/server/lib/actor'
import { installAiUsageSink } from '@/server/services/ai-usage.service'
import { driveDownloadUrl, harvestSite, isPdfLink } from '@/server/bac/harvest'
import { importBacFiles } from '@/server/services/bac-import.service'
import { processDocument } from '@/server/services/exam-engine.service'
import { makeAdmin, setupDb } from './helpers'

let h: DatabaseHandle
let admin: Actor
let dir: string

const EXAM = `الجمهورية الجزائرية الديمقراطية الشعبية — الديوان الوطني للامتحانات والمسابقات
امتحان بكالوريا التعليم الثانوي — دورة: 2023 — الشعبة: علوم تجريبية — اختبار في مادة: الرياضيات — المدة: 3 سا 30 د
على المترشح أن يختار أحد الموضوعين التاليين: الموضوع الأول
التمرين الأول (04 نقاط)
نعتبر المتتالية العددية (u_n) المعرفة بـ u_0 = 1 و u_{n+1} = 2u_n + 1.
1) احسب u_1 و u_2.
2) برهن أن المتتالية (v_n) حيث v_n = u_n + 1 هندسية.
`
const CORR = `الإجابة النموذجية لموضوع اختبار مادة الرياضيات — شعبة علوم تجريبية — بكالوريا 2023 — الموضوع الأول
حل التمرين الأول: u_1 = 3، u_2 = 7. v_{n+1} = 2 v_n إذن هندسية أساسها 2.
`
const MYSTERY = `وثيقة بلا عنوان رسمي ولا سنة. نصّ قصير جداً.`

const classifyCalls: ClassifyBacFileInput[] = []
const fakeAi: AIProvider = {
  name: 'fake',
  model: 'fake-1',
  evaluateEssay: () => Promise.reject(new Error('n/a')),
  generateTeacherInsights: () => Promise.reject(new Error('n/a')),
  generateExercises: () => Promise.reject(new Error('n/a')),
  analyzeStudent: () => Promise.reject(new Error('n/a')),
  async classifyBacFile(input: ClassifyBacFileInput) {
    classifyCalls.push(input)
    // الملف الذي اسمه لا يحمل شيئاً: الذكاء الاصطناعي يقرأ العنوان الرسمي من النص
    if (/الفيزيائية/.test(input.excerpt)) return { year: 2021, session: 'NORMAL' as const, streamCode: 'MATH', subjectCode: 'PHYSICS', topicNumber: 2, correction: false, confidence: 0.9 }
    return { year: null, session: null, streamCode: null, subjectCode: null, topicNumber: null, correction: false, confidence: 0.2 }
  },
  async extractQuestions(input: ExtractQuestionsInput) {
    const body = input.text.split('التمرين الأول')[1] ?? input.text
    return { questions: [{ kind: 'EXERCISE', type: 'OPEN', title: 'التمرين الأول', body: body.slice(0, 300), options: [], answerKey: null, solution: null, points: 4, difficulty: 2, estimatedMinutes: 30, topic: null, keywords: [], children: [] }], note: null }
  }
}

beforeAll(async () => {
  process.env.UPLOADS_DIR = await mkdtemp(path.join(tmpdir(), 'bac-import-uploads-'))
  process.env.DRIVE_CACHE_DIR = await mkdtemp(path.join(tmpdir(), 'bac-import-cache-'))
  h = await setupDb()
  await seedCurriculum(h.db)
  installAiUsageSink(h.db)
  setAiProviderForTests(fakeAi)
  admin = await makeAdmin(h.db)
  dir = await mkdtemp(path.join(tmpdir(), 'bac-import-src-'))
  await mkdir(path.join(dir, 'maths'))
  await writeFile(path.join(dir, 'maths', 'bac-2023-math-se-sujet1.txt'), EXAM)
  await writeFile(path.join(dir, 'maths', 'bac-2023-math-se-sujet1-corrige.txt'), CORR)
  await writeFile(path.join(dir, 'scan0001.txt'), `الجمهورية الجزائرية — بكالوريا 2021 — شعبة رياضيات — اختبار في مادة العلوم الفيزيائية — الموضوع الثاني\nالتمرين الأول: ...`)
  await writeFile(path.join(dir, 'inconnu.txt'), MYSTERY)
})

afterAll(async () => {
  setAiProviderForTests(null)
  delete process.env.UPLOADS_DIR
  await h.close()
})

describe('استيراد ملفات البكالوريا', () => {
  it('تخمين السنة والشعبة والمادة والموضوع والتصحيح من اسم الملف', () => {
    expect(guessBacFile('bac-2023-math-se-sujet1.pdf')).toMatchObject({ year: 2023, session: 'NORMAL', streamCode: 'SCI', subjectCode: 'MATH', topicNumber: 1, correction: false })
    expect(guessBacFile('bac-2023-math-se-sujet1-corrige.pdf')).toMatchObject({ year: 2023, streamCode: 'SCI', subjectCode: 'MATH', topicNumber: 1, correction: true })
    expect(guessBacFile('Physique_2019_MT_rattrapage_S2.pdf')).toMatchObject({ year: 2019, session: 'MAKEUP', streamCode: 'TM', subjectCode: 'PHYSICS', topicNumber: 2 })
    expect(guessBacFile('موضوع اللغة العربية شعبة آداب وفلسفة بكالوريا 2020 الموضوع الثاني.pdf')).toMatchObject({ year: 2020, streamCode: 'LIT', subjectCode: 'ARABIC', topicNumber: 2 })
    expect(guessBacFile('تصحيح موضوع الفلسفة لغات أجنبية 2022.pdf')).toMatchObject({ year: 2022, streamCode: 'LANG', subjectCode: 'PHILO', correction: true })
    expect(guessBacFile('sciences-physiques-ge-2018.pdf')).toMatchObject({ subjectCode: 'PHYSICS', streamCode: 'GE' })
    expect(guessBacFile('svt-se-2017-corrige.pdf')).toMatchObject({ subjectCode: 'SCIENCES', correction: true })
    expect(guessBacFile('genie-civil-2016-tm.pdf')).toMatchObject({ subjectCode: 'TECH_CIVIL', streamCode: 'TM' })
    expect(guessBacFile('scan0001.pdf')).toMatchObject({ year: null, subjectCode: null, streamCode: null })
    // بلا اسم مفيد: العنوان الرسمي في رأس النص يكفي
    expect(guessBacFile('scan0001.pdf', 'بكالوريا 2021 — شعبة رياضيات — اختبار في مادة العلوم الفيزيائية — الموضوع الثاني')).toMatchObject({ year: 2021, streamCode: 'MATH', subjectCode: 'PHYSICS', topicNumber: 2 })
  })

  it('مجلد على الخادم: موضوع + تصحيح مربوط، الذكاء الاصطناعي يكمل الناقص فقط، وغير المصنَّف يُعرض لا يُخمَّن', async () => {
    // اسم «scan0001» لا يفيد والنص فيه العنوان الرسمي: التخمين الحتمي يكفي؛ «inconnu» لا شيء فيه ⇒ الذكاء الاصطناعي يُسأل ثم يُرفض لضعف الثقة
    const r = await importBacFiles(h.db, admin, { kind: 'dir', dir })
    expect(r.files).toBe(4)
    expect(r.exams).toBe(2)
    expect(r.corrections).toBe(1)
    expect(r.unclassified).toBe(1)
    expect(r.errors).toBe(0)
    expect(r.items.find((i) => i.name === 'inconnu.txt')).toMatchObject({ outcome: 'unclassified' })
    expect(classifyCalls.map((c) => c.fileName)).toEqual(['inconnu.txt'])

    const docs = await h.db.select().from(examDocuments).where(eq(examDocuments.docType, 'BAC'))
    expect(docs).toHaveLength(2)
    const math = docs.find((d) => d.examYear === 2023)!
    expect(math).toMatchObject({ status: 'PENDING', topicNumber: 1, language: 'ar', examSession: 'NORMAL' })
    expect(math.fileId).toBeTruthy()
    expect(math.solutionFileId).toBeTruthy()
    expect(math.pdfHash).toHaveLength(64)
    expect(math.solutionPdfHash).toHaveLength(64)
    expect(math.title).toContain('بكالوريا 2023')
    expect(math.title).toContain('الموضوع الأول')
    const [res] = await h.db.select().from(resources).where(eq(resources.id, math.resourceId!))
    expect(res).toMatchObject({ isOfficial: true, hasSolution: true, type: 'EXAM', examYear: 2023, status: 'PUBLISHED' })
    expect(res!.solutionResourceId).toBeTruthy()
    const phys = docs.find((d) => d.examYear === 2021)!
    expect(phys).toMatchObject({ topicNumber: 2 })

    // إعادة التشغيل: لا تكرار
    const again = await importBacFiles(h.db, admin, { kind: 'dir', dir })
    expect(again.duplicates).toBe(3)
    expect(again.exams).toBe(0)
    expect(again.corrections).toBe(0)
    expect((await h.db.select().from(examDocuments)).length).toBe(2)

    // المعالجة تقرأ من الملف المحلي بلا أي تنزيل
    const p = await processDocument(h.db, math.id, { userId: admin.userId, fetch: (() => Promise.reject(new Error('no network'))) as unknown as typeof fetch })
    expect(p.status).toBe('NEEDS_REVIEW')
    expect(p.exercises).toBe(1)
  })
})

/* موقع وهمي يشبه ency-education: صفحة بكالوريا ← صفحة مادة ← روابط PDF (مباشرة وعبر Drive) */
const SITE: Record<string, { ct: string; body: string }> = {
  'https://edu.test/bac.html': { ct: 'text/html; charset=utf-8', body: '<html><title>بكالوريا | موقع</title><body><a href="/bac/math.html">مواضيع بكالوريا الرياضيات</a> <a href="/contact.html">اتصل بنا</a> <a href="/bac/math.html#top">نفسها</a> <a href="https://other.test/bac/x.html">موقع آخر</a></body></html>' },
  'https://edu.test/bac/math.html': { ct: 'text/html', body: '<html><h1>مواضيع بكالوريا الرياضيات شعبة علوم تجريبية</h1><a href="/files/bac-2020-math-se-sujet1.pdf">موضوع 2020 الموضوع الأول</a> <a href="https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz01234/view">تصحيح موضوع 2020 الموضوع الأول</a> <a href="/bac/math.html?page=2">الصفحة 2</a> <a href="/img/logo.png">صورة</a></html>' },
  'https://edu.test/bac/math.html?page=2': { ct: 'text/html', body: '<html><h1>مواضيع بكالوريا الرياضيات — 2</h1><a href="/files/bac-2020-math-se-sujet1.pdf">نفس الملف</a><iframe src="/files/old.pdf"></iframe></html>' },
  'https://edu.test/files/bac-2020-math-se-sujet1.pdf': { ct: 'text/plain; charset=utf-8', body: 'بكالوريا 2020 — الرياضيات — علوم تجريبية — الموضوع الأول\nالتمرين الأول (04 نقاط)\nنعتبر الدالة f(x) = ln(x) + x.\n1) ادرس تغيرات f.\n' },
  'https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKlMnOpQrStUvWxYz01234': { ct: 'text/plain', body: 'الإجابة النموذجية — بكالوريا 2020 — الرياضيات — علوم تجريبية — الموضوع الأول\nحل التمرين الأول: f متزايدة.\n' },
  'https://edu.test/files/old.pdf': { ct: 'text/html', body: '<html>ليس ملفاً</html>' }
}
const siteFetch = (async (u: RequestInfo | URL) => {
  const hit = SITE[String(u)]
  return hit ? new Response(hit.body, { headers: { 'content-type': hit.ct } }) : new Response('nf', { status: 404 })
}) as typeof fetch

describe('حصاد موقع عامّ', () => {
  it('روابط PDF وDrive تُعرف، ويُتبع الموقع نفسه فقط، بلا تكرار', async () => {
    expect(isPdfLink('https://x.test/a.pdf?dl=1')).toBe(true)
    expect(isPdfLink('https://x.test/a.html')).toBe(false)
    expect(driveDownloadUrl('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz01234/view?usp=sharing')).toBe('https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKlMnOpQrStUvWxYz01234')
    expect(driveDownloadUrl('https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWxYz01234')).toContain('id=1AbCdEfGhIjKlMnOpQrStUvWxYz01234')
    const r = await harvestSite('https://edu.test/bac.html', { fetch: siteFetch, delayMs: 0 })
    expect(r.pages).toBe(3) // بكالوريا، الرياضيات، الصفحة 2 — لا «اتصل بنا» ولا الموقع الآخر ولا الصورة
    expect(r.errors).toBe(0)
    expect(r.pdfs.map((p) => p.url).sort()).toEqual(['https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKlMnOpQrStUvWxYz01234', 'https://edu.test/files/bac-2020-math-se-sujet1.pdf', 'https://edu.test/files/old.pdf'].sort())
    expect(r.pdfs.find((p) => p.url.endsWith('sujet1.pdf'))).toMatchObject({ text: 'موضوع 2020 الموضوع الأول', pageTitle: 'مواضيع بكالوريا الرياضيات شعبة علوم تجريبية' })
  })

  it('الاستيراد من الموقع: الموضوع رسمي بمصدره، تصحيح الموقع غير رسمي للمراجعة، والرابط الذي يعيد HTML خطأ لا تخمين', async () => {
    const r = await importBacFiles(h.db, admin, { kind: 'web', seedUrl: 'https://edu.test/bac.html' }, { fetch: siteFetch })
    expect(r).toMatchObject({ files: 3, exams: 1, corrections: 1, errors: 1, unclassified: 0 })
    const [doc] = await h.db.select().from(examDocuments).where(eq(examDocuments.examYear, 2020))
    expect(doc).toMatchObject({ topicNumber: 1, sourceUrl: 'https://edu.test/bac/math.html', status: 'PENDING' })
    expect(doc!.solutionFileId).toBeTruthy()
    const [exam] = await h.db.select().from(resources).where(eq(resources.id, doc!.resourceId!))
    expect(exam).toMatchObject({ isOfficial: true, hasSolution: true, sourceUrl: 'https://edu.test/bac/math.html' })
    const [sol] = await h.db.select().from(resources).where(eq(resources.id, exam!.solutionResourceId!))
    expect(sol).toMatchObject({ isOfficial: false, originalAuthor: 'edu.test', status: 'NEEDS_REVIEW', type: 'SOLUTION' })
    // إعادة الحصاد: لا تكرار
    const again = await importBacFiles(h.db, admin, { kind: 'web', seedUrl: 'https://edu.test/bac.html' }, { fetch: siteFetch })
    expect(again).toMatchObject({ exams: 0, corrections: 0, duplicates: 2 })
  })
})
