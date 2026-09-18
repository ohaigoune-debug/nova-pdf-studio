import { normalizeArabic } from '@/server/lib/arabic'
import type { AIProvider, EvaluateEssayInput, EvaluateEssayOutput, TeacherInsightsInput, TeacherInsightsOutput } from './types'

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
    }
  }
}
