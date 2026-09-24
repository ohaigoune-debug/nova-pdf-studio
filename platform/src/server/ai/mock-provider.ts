import { normalizeArabic } from '@/server/lib/arabic'
import type {
  AIProvider,
  AnalyzeStudentInput,
  AnalyzeStudentOutput,
  DraftFromSourceInput,
  DraftFromSourceOutput,
  EvaluateEssayInput,
  EvaluateEssayOutput,
  GenerateExercisesInput,
  GenerateExercisesOutput,
  GeneratedQuestion,
  OrganizeLessonsInput,
  OrganizeLessonsOutput,
  TeacherInsightsInput,
  TeacherInsightsOutput
} from './types'

/**
 * مزوّد تجريبي حتمي (بلا شبكة): يقيس ملامح شكلية في النص العربي فقط.
 * الغرض: تشغيل المسار الكامل (Job → اقتراح → مراجعة الأستاذ) محلياً وفي الاختبارات.
 * لا يُعتبر تصحيحاً حقيقياً — الأستاذ هو من يعتمد.
 */
const CONNECTORS = ['لأن', 'لذلك', 'إذ', 'حيث', 'بينما', 'غير أن', 'كما', 'ثم', 'إضافة إلى', 'من ثم', 'بيد أن']
const EVIDENCE = ['مثلاً', 'مثل', 'كقول', 'قال', 'يقول', 'نحو', 'على سبيل المثال', 'في قوله']
const LITERARY = ['استعارة', 'تشبيه', 'كناية', 'مجاز', 'طباق', 'جناس', 'سجع', 'صورة بيانية', 'محسن بديعي']
const GRAMMAR = ['فاعل', 'مفعول', 'مبتدأ', 'خبر', 'إعراب', 'منصوب', 'مرفوع', 'مجرور']

function countHits(text: string, words: string[]): number {
  return words.reduce((n, w) => (text.includes(normalizeArabic(w)) ? n + 1 : n), 0)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** تنظيف حتمي لعنوان يوتيوب: ترقيم الحلقات، اسم القناة بعد | أو -، والوسوم */
function cleanTitle(raw: string): string {
  const cut = raw.split(/\s+[|｜]\s+/)[0] ?? raw
  return (
    cut
      .replace(/#\S+/g, '')
      .replace(/^\s*(?:الحلقة|الدرس|المحاضرة|الجزء|حصة)\s*[:\-–]?\s*\d+\s*[:\-–]?\s*/u, '')
      .replace(/^\s*\d{1,3}\s*[)\-–.:]\s*/u, '')
      .replace(/\s{2,}/g, ' ')
      .trim() || raw.trim()
  )
}


/**
 * تمارين من نصوص المصدر وحدها (مجلد Drive الأستاذ): جملة من الدرس بكلمة محجوبة.
 * لا بنك جاهز ولا معرفة عامّة — نفس قاعدة المزوّد الحقيقي.
 */
/** عناصر الحل النموذجي (سطر أو جملة لكلٍّ) وما ورد منها في الإجابة: نصف كلماته الدالّة على الأقل */
function compareWithModel(model: string, answer: string): { matched: string[]; missing: string[] } {
  const ans = normalizeArabic(answer)
  const points = model
    .split(/[\n.؛;!؟?]+/)
    .map((x) => x.replace(/^[\s\-–•*\d.)]+/, '').trim())
    .filter((x) => x.length >= 6)
  const matched: string[] = []
  const missing: string[] = []
  for (const p of points) {
    const words = normalizeArabic(p).split(' ').filter((w) => w.length >= 3).map((w) => w.replace(/^(و|ف|ب|ك|ل)?ال/, ''))
    const hit = words.filter((w) => w.length >= 3 && ans.includes(w)).length
    ;(words.length && hit / words.length >= 0.5 ? matched : missing).push(p)
  }
  return { matched, missing }
}

function exercisesFromSources(sources: { title: string; text: string }[], count: number, types?: GeneratedQuestion['type'][]): GeneratedQuestion[] {
  // صحيح/خطأ من جملة الدرس نفسها إن لم يُسمح بالفراغات
  const trueFalse = !!types?.length && !types.includes('FILL_BLANK') && types.includes('TRUE_FALSE')
  const sentences = sources
    .flatMap((s) => s.text.split(/[.!؟?\n]+/))
    .map((x) => x.replace(/\s+/g, ' ').trim())
    .filter((x) => x.length >= 25 && x.length <= 240 && !x.includes('___'))
  const out: GeneratedQuestion[] = []
  const seen = new Set<string>()
  for (const s of sentences) {
    if (out.length >= count) break
    const word = s
      .split(' ')
      .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
      .filter((w) => w.length >= 4 && !seen.has(w))
      .sort((a, b) => b.length - a.length)[0]
    if (trueFalse) {
      out.push({ type: 'TRUE_FALSE', prompt: `صحيح أم خطأ: ${s}`, answerKey: { value: true } })
      continue
    }
    if (!word) continue
    seen.add(word)
    const at = s.indexOf(word)
    out.push({ type: 'FILL_BLANK', prompt: `أكمل من الدرس: ${s.slice(0, at)}___${s.slice(at + word.length)}`, answerKey: { blanks: [[word]] } })
  }
  return out
}

export function createMockProvider(): AIProvider {
  return {
    name: 'mock',
    model: 'heuristic-ar-v1',
    async evaluateEssay(input: EvaluateEssayInput): Promise<EvaluateEssayOutput> {
      const text = normalizeArabic(input.answerText)
      const words = text.split(/\s+/).filter(Boolean)
      const sentences = text.split(/[.!؟?\n]+/).filter((s) => s.trim().length > 0)
      const wc = words.length
      const connectors = countHits(text, CONNECTORS)
      const evidence = countHits(text, EVIDENCE)
      const literary = countHits(text, LITERARY)
      const grammar = countHits(text, GRAMMAR)
      const structure = sentences.length >= 3 && wc / Math.max(1, sentences.length) < 45

      // نسبة تقديرية 0..1 من الملامح الشكلية
      let ratio = 0.25
      ratio += Math.min(0.3, wc / 400)
      ratio += Math.min(0.15, connectors * 0.05)
      ratio += Math.min(0.1, evidence * 0.05)
      ratio += Math.min(0.1, literary * 0.04)
      ratio += structure ? 0.1 : 0
      ratio = Math.max(0.05, Math.min(0.95, ratio))

      const strengths: string[] = []
      const weaknesses: string[] = []
      const mistakes: string[] = []
      if (wc >= 120) strengths.push('إجابة مفصّلة بحجم مناسب')
      else if (wc < 40) weaknesses.push('الإجابة قصيرة جداً ولا تغطي المطلوب')
      if (connectors >= 2) strengths.push('استعمال أدوات الربط وتماسك الأفكار')
      else weaknesses.push('ضعف الربط بين الجمل والفقرات')
      if (evidence >= 1) strengths.push('الاستشهاد بأمثلة أو شواهد من النص')
      else weaknesses.push('غياب الشواهد والأمثلة الداعمة')
      if (literary >= 1) strengths.push('توظيف مصطلحات بلاغية')
      if (structure) strengths.push('تقسيم واضح إلى جمل وفقرات')
      else weaknesses.push('بناء الفقرات غير واضح (جمل طويلة أو غير مفصولة)')
      if (/\b(هاذا|هاذه|إنشاء الله|لاكن)\b/.test(input.answerText)) mistakes.push('أخطاء إملائية شائعة (هاذا/لاكن…)')
      if (!/[.،؛:]/.test(input.answerText)) mistakes.push('غياب علامات الترقيم')

      const skillsDetected: string[] = []
      const skillsToImprove: string[] = []
      const has = (s: string) => input.knownSkills.find((k) => k.includes(s))
      const pick = (needle: string, ok: boolean) => {
        const k = has(needle)
        if (!k) return
        ;(ok ? skillsDetected : skillsToImprove).push(k)
      }
      pick('بلاغ', literary >= 1)
      pick('إعراب', grammar >= 1)
      pick('نحو', grammar >= 1)
      pick('تحليل', evidence >= 1 && wc >= 80)
      pick('تعبير', structure && connectors >= 2)
      pick('إملاء', mistakes.length === 0)

      let rubricBreakdown: Record<string, number> | null = null
      let suggestedScore: number
      if (input.rubric && input.rubric.length > 0) {
        rubricBreakdown = {}
        let total = 0
        input.rubric.forEach((it, i) => {
          // توزيع النسبة مع تذبذب طفيف حسب البند (حتمي)
          const local = Math.max(0, Math.min(1, ratio + ((i % 3) - 1) * 0.05))
          const pts = round2(Math.round(local * it.maxPoints * 4) / 4)
          rubricBreakdown![it.id] = pts
          total += pts
        })
        suggestedScore = round2(Math.min(input.maxScore, total))
      } else {
        suggestedScore = round2(Math.round(ratio * input.maxScore * 4) / 4)
      }
      const confidence = round2(Math.max(0.2, Math.min(0.7, 0.3 + wc / 500)))
      const notes = [
        `تقدير أولي من المزوّد التجريبي (${wc} كلمة، ${sentences.length} جمل).`,
        weaknesses.length ? `يُنصح بالتركيز على: ${weaknesses[0]}.` : 'الإجابة متوازنة شكلاً؛ راجع المضمون.'
      ].join(' ')
      if (input.modelAnswer?.trim()) {
        // مع حل نموذجي: العلامة من نسبة عناصره التي وردت في الإجابة، ولا شيء غيرها
        const cmp = compareWithModel(input.modelAnswer, input.answerText)
        const score = round2((input.maxScore * cmp.matched.length) / Math.max(1, cmp.matched.length + cmp.missing.length))
        return {
          suggestedScore: score, confidence: 0.6, rubricBreakdown: null, strengths, weaknesses, mistakes, skillsDetected, skillsToImprove,
          teacherNotesSuggestion: `أصاب ${cmp.matched.length} من ${cmp.matched.length + cmp.missing.length} عناصر في الحل النموذجي.`,
          matched: cmp.matched, missing: cmp.missing,
          raw: { wc, matched: cmp.matched, missing: cmp.missing }
        }
      }
      return { suggestedScore, confidence, rubricBreakdown, strengths, weaknesses, mistakes, skillsDetected, skillsToImprove, teacherNotesSuggestion: notes, raw: { wc, sentences: sentences.length, connectors, evidence, literary, grammar } }
    },

    async generateTeacherInsights(input: TeacherInsightsInput): Promise<TeacherInsightsOutput> {
      const facts = input.facts
      if (facts.length === 0) {
        return { summary: `لا توجد بيانات كافية بعد يا أستاذ ${input.teacherName}. ستظهر التوصيات بعد تراكم حصص وواجبات واختبارات.`, nextLessonSuggestions: [] }
      }
      const weak = facts.filter((f) => f.includes('ضعف'))
      const attendance = facts.filter((f) => f.includes('الحضور') || f.includes('غياب'))
      const missing = facts.filter((f) => f.includes('لم يرسل'))
      const summary = [
        `أستاذ ${input.teacherName}، هذا ملخص وضع أفواجك من البيانات المسجّلة:`,
        weak.length ? `• مهارات تحتاج علاجاً: ${weak.length}.` : null,
        attendance.length ? `• ملاحظات على الحضور: ${attendance.length}.` : null,
        missing.length ? `• تأخّر في تسليم الواجبات مرصود.` : null
      ]
        .filter(Boolean)
        .join('\n')
      const next: string[] = []
      for (const w of weak.slice(0, 2)) {
        const m = w.match(/"([^"]+)"/)
        if (m?.[1]) next.push(`خصّص جزءاً من الحصة القادمة لمراجعة "${m[1]}" مع تمرين تطبيقي قصير واختبار من 5 أسئلة.`)
      }
      if (attendance.length) next.push('ابدأ الحصة بتذكير قصير بقاعدة الغيابات وتواصل مع الطلاب المعرّضين للتعليق.')
      if (missing.length) next.push('أرسل تذكيراً بالواجبات المتأخرة وحدّد أجلاً إضافياً قصيراً.')
      return { summary, nextLessonSuggestions: next, raw: { facts: facts.length } }
    },
    async generateExercises(input: GenerateExercisesInput): Promise<GenerateExercisesOutput> {
      const questions = exercisesFromSources(input.sources, Math.max(1, input.count), input.questionTypes)
      return {
        title: `تمارين علاجية: ${input.skillName}`,
        description: `من دروسك في Drive لمهارة "${input.skillName}"${input.levelName ? ` — ${input.levelName}` : ''}. ولّدها المزوّد التجريبي؛ راجعها قبل النشر.`,
        questions,
        raw: { sources: input.sources.map((x) => x.title), count: questions.length }
      }
    },

    async analyzeStudent(input: AnalyzeStudentInput): Promise<AnalyzeStudentOutput> {
      const f = input.facts
      const pick = (needle: string) => f.filter((x) => x.includes(needle))
      const strengths: string[] = []
      const weaknesses: string[] = []
      const recommendations: string[] = []
      for (const x of pick('مهارة قوية')) strengths.push(x)
      for (const x of pick('مهارة ضعيفة')) weaknesses.push(x)
      const att = pick('نسبة الحضور')[0]
      const rate = att ? Number(att.match(/(\d+)%/)?.[1] ?? NaN) : NaN
      if (Number.isFinite(rate)) (rate >= 85 ? strengths : weaknesses).push(att!)
      if (Number.isFinite(rate) && rate < 75) recommendations.push('تواصل مع الطالب/الولي بخصوص الغيابات وقدّم له ملخصات الحصص الفائتة.')
      if (weaknesses.some((w) => w.includes('مهارة ضعيفة'))) recommendations.push('خصّص تمارين علاجية قصيرة للمهارة الأضعف وتابع تحسّنها في خريطة المهارات بعد أسبوعين.')
      const late = pick('متأخر')[0]
      if (late) recommendations.push('نبّه الطالب إلى الالتزام بوقت الحصة.')
      if (pick('لم يرسل').length) recommendations.push('ذكّره بالواجبات المتأخرة وحدّد أجلاً إضافياً قصيراً.')
      if (recommendations.length === 0) recommendations.push('استمر في المتابعة الحالية؛ لا مؤشرات قلق في البيانات الحالية.')
      const summary = f.length
        ? `ملخص أولي (مزوّد تجريبي) للطالب ${input.studentName}: ${strengths.length} نقاط قوة و${weaknesses.length} نقاط تحتاج متابعة من ${f.length} معطيات مسجّلة.`
        : `لا توجد بيانات كافية بعد عن الطالب ${input.studentName}.`
      return { summary, strengths, weaknesses, recommendations, raw: { facts: f.length } }
    },

    /** بلا نموذج: ترتيب القائمة كما هو وعنوان منظّف، ولا يُخترع ملخّص */
    async draftFromSource(input: DraftFromSourceInput): Promise<DraftFromSourceOutput> {
      // الحل في الملف إن سبقه عنوان «الحل/التصحيح/الإجابة»؛ وإلا يبقى فارغاً لا مخترعاً
      const text = input.text.trim()
      const m = /^\s*(?:الحل|التصحيح|الإجابة|حل التمرين)[^\n]*$/m.exec(text)
      const statement = (m ? text.slice(0, m.index) : text).trim()
      const answer = m ? text.slice(m.index + m[0].length).trim() : ''
      const title = cleanTitle(input.fileTitle.replace(/\.[a-z0-9]{2,5}$/i, ''))
      if (input.mode === 'explanation') {
        return { title, statement: '', modelAnswer: '', solutionInSource: false, summary: text.split(/[.!؟?\n]/)[0]!.trim().slice(0, 200), body: text.slice(0, 4000), raw: { mode: 'explanation' } }
      }
      return { title, statement, modelAnswer: answer, solutionInSource: !!answer, summary: '', body: '', raw: { mode: 'assignment', split: !!m } }
    },

    async organizeLessons(input: OrganizeLessonsInput): Promise<OrganizeLessonsOutput> {
      return {
        lessons: input.items.map((i, n) =>
          input.kind === 'files'
            ? { youtubeId: i.youtubeId, title: cleanTitle(i.title.replace(/\.[a-z0-9]{2,5}$/i, '')), summary: (i.description ?? '').split(/[.!؟?\n]/)[0]!.trim().slice(0, 160), topic: null, order: n + 1 }
            : { youtubeId: i.youtubeId, title: cleanTitle(i.title), summary: '', topic: null, order: n + 1 }
        ),
        raw: { count: input.items.length }
      }
    }
  }
}
