import { normalizeArabic } from '@/server/lib/arabic'
import type { AIProvider, AnalyzeStudentInput, AnalyzeStudentOutput, EvaluateEssayInput, EvaluateEssayOutput, GenerateExercisesInput, GenerateExercisesOutput, GeneratedQuestion, TeacherInsightsInput, TeacherInsightsOutput } from './types'

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


/** بنك تمارين تجريبي مصنّف بكلمات مفتاحية في اسم المهارة (يُستبدل بالمزوّد الحقيقي في الإنتاج) */
const EXERCISE_BANK: { match: string[]; questions: GeneratedQuestion[] }[] = [
  {
    match: ['بلاغ', 'صور', 'استعار', 'تشبيه', 'كناي'],
    questions: [
      { type: 'MCQ', prompt: 'في قوله "رأيتُ أسداً يخطب على المنبر"، الصورة البيانية هي:', options: [{ label: 'استعارة تصريحية', isCorrect: true }, { label: 'تشبيه بليغ', isCorrect: false }, { label: 'كناية عن صفة', isCorrect: false }, { label: 'مجاز مرسل', isCorrect: false }], answerKey: null, explanation: 'صُرِّح بالمشبه به (الأسد) وحُذف المشبه (الرجل الشجاع).' },
      { type: 'TRUE_FALSE', prompt: 'التشبيه البليغ هو ما حُذفت منه الأداة ووجه الشبه معاً.', answerKey: { value: true } },
      { type: 'SHORT_ANSWER', prompt: 'ما نوع الصورة في: "فلانٌ كثير الرماد"؟', answerKey: { accepted: ['كناية', 'كناية عن صفة', 'كناية عن الكرم'] } },
      { type: 'FILL_BLANK', prompt: 'الاستعارة التي يُحذف فيها المشبه به ويُرمز له بشيء من لوازمه تسمى استعارة ___.', answerKey: { blanks: [['مكنية', 'مكنيه']] } },
      { type: 'MCQ', prompt: '"العلمُ نورٌ" تشبيه:', options: [{ label: 'بليغ', isCorrect: true }, { label: 'مرسل مفصّل', isCorrect: false }, { label: 'ضمني', isCorrect: false }], answerKey: null }
    ]
  },
  {
    match: ['إعراب', 'نحو', 'حال', 'تمييز', 'مفعول', 'فاعل'],
    questions: [
      { type: 'MCQ', prompt: 'في "جاء الطالبُ مسرعاً"، كلمة "مسرعاً":', options: [{ label: 'حال منصوب', isCorrect: true }, { label: 'تمييز', isCorrect: false }, { label: 'مفعول به', isCorrect: false }, { label: 'نعت', isCorrect: false }], answerKey: null },
      { type: 'TRUE_FALSE', prompt: 'التمييز اسم نكرة منصوب يزيل إبهام ما قبله.', answerKey: { value: true } },
      { type: 'SHORT_ANSWER', prompt: 'أعرب كلمة "طولاً" في: طاب الجوُّ طولاً.', answerKey: { accepted: ['تمييز', 'تمييز منصوب', 'تمييز منصوب بالفتحة'] } },
      { type: 'FILL_BLANK', prompt: 'المفعول المطلق مصدر ___ يؤكّد الفعل أو يبيّن نوعه أو عدده.', answerKey: { blanks: [['منصوب']] } },
      { type: 'MCQ', prompt: 'الجملة التي فيها نائب فاعل:', options: [{ label: 'كُتِبَ الدرسُ', isCorrect: true }, { label: 'كتبَ الطالبُ الدرسَ', isCorrect: false }, { label: 'الطالبُ كاتبٌ', isCorrect: false }], answerKey: null }
    ]
  },
  {
    match: [],
    questions: [
      { type: 'TRUE_FALSE', prompt: 'الفكرة العامة للنص تُستخرج من مجمل أفكاره الجزئية لا من جملة واحدة.', answerKey: { value: true } },
      { type: 'SHORT_ANSWER', prompt: 'ما اسم الخطوة التي نحدّد فيها العاطفة المسيطرة على الشاعر؟', answerKey: { accepted: ['البناء الفكري', 'تحليل العاطفة', 'العاطفة'] } },
      { type: 'MCQ', prompt: 'أداة الربط المناسبة للتعليل:', options: [{ label: 'لأنّ', isCorrect: true }, { label: 'ثم', isCorrect: false }, { label: 'بينما', isCorrect: false }], answerKey: null },
      { type: 'FILL_BLANK', prompt: 'نمط النص الذي يغلب عليه سرد الأحداث وتتابعها هو النمط ___.', answerKey: { blanks: [['السردي', 'سردي']] } },
      { type: 'TRUE_FALSE', prompt: 'المقدمة في موضوع البكالوريا تُذكر فيها الأفكار الجزئية تفصيلاً.', answerKey: { value: false } }
    ]
  }
]

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
      const key = normalizeArabic(input.skillName)
      const set = EXERCISE_BANK.find((b) => b.match.some((m) => key.includes(normalizeArabic(m)))) ?? EXERCISE_BANK[EXERCISE_BANK.length - 1]!
      const questions = set.questions.slice(0, Math.max(1, Math.min(input.count, set.questions.length)))
      return {
        title: `تمارين علاجية: ${input.skillName}`,
        description: `مجموعة قصيرة لتقوية مهارة "${input.skillName}"${input.levelName ? ` — ${input.levelName}` : ''}. ولّدها المزوّد التجريبي؛ راجعها وعدّلها قبل النشر.`,
        questions,
        raw: { bank: set.match[0] ?? 'general', count: questions.length }
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
    }
  }
}
