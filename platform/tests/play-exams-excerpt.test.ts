/**
 * الأبيات/الجمل المقصودة تحت السؤال: تُستخرج من نصّ الموضوع وحده، ولا تُعرض حين تكشف الجواب.
 */
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { publicSteps, readExamSetFile } from '@/server/play/exams/engine'
import { latinParagraphRefs, normalizeAr, stepExcerpt, verseRefs, type StepExcerpt } from '@/server/play/exams/excerpt'
import type { OriginalQuestion, SourceDocument, StepPayload } from '@/server/play/exams/types'

const POEM: SourceDocument = {
  id: 'd-poem',
  kind: 'text',
  caption: 'الأبيات',
  table: Array.from({ length: 12 }, (_, i) => [`${i + 1}`, `صدر البيت ${['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر'][i]}`, i === 3 ? 'وَيَكْسُوانِ الرُّبَى حُلَلًا خُضْرًا' : i === 4 || i === 5 ? 'والدّهرُ يومانِ' : `عجز ${i + 1}`])
}
const mcq: StepPayload = { type: 'mcq', options: ['استعارة', 'تشبيه', 'كناية', 'مجاز'] }
const q = (verbatim = 'اشرح ما يلي.', documents: SourceDocument[] = [POEM]): Pick<OriginalQuestion, 'verbatim_text' | 'documents'> => ({ verbatim_text: verbatim, documents })
const nums = (e: StepExcerpt | null) => (e?.kind === 'verses' ? e.rows.map((r) => Number(r.n)) : null)

describe('explicit verse references', () => {
  it.each([
    ['ما إعراب «الربى» (ب4)؟', [4]],
    ['ما نوع الصورة في (ب 6 و7)؟', [6, 7]],
    ['ما موقف الشاعر في الأبيات (7–9)؟', [7, 8, 9]],
    ['حلّل البيتين (6–7).', [6, 7]],
    ['ما نوع الصّورة في الشّطر الثّاني من البيت الثّالث؟', [3]],
    ['ما إعراب «دروس» في البيت الحادي عشر؟', [11]],
    ['قارن بين البيتين الأوّل والثّاني.', [1, 2]],
    ['ما الحكمة في البيت الأخير؟', [12]],
    ['ما فكرة الأبيات الثلاثة الأولى؟', [1, 2, 3]],
    ['ما المخاطب في الأبيات من 2 إلى 4؟', [2, 3, 4]]
  ])('%s', (prompt, expected) => {
    expect(nums(stepExcerpt({ prompt, payload: mcq }, q()))).toEqual(expected)
  })

  it('more than six verses is left to the «النصّ» button', () => {
    expect(stepExcerpt({ prompt: 'لخّص الأبيات (1–9).', payload: mcq }, q())).toBeNull()
  })

  it('normalizes diacritics, shadda and Arabic-Indic digits', () => {
    expect(normalizeAr('البيتَيْنِ (٦–٧)')).toBe('البيتين 6 7')
    expect(verseRefs('في البيت السّابع', 12)).toEqual([7])
  })
})

describe('quotes', () => {
  it('a quote found in exactly one verse shows that verse, even with a proclitic in the text', () => {
    expect(nums(stepExcerpt({ prompt: 'ما الفرق بين «يكسوان» و«حللا»؟', payload: mcq }, q()))).toEqual([4])
  })
  it('a quote found in several verses shows nothing (ambiguous)', () => {
    expect(stepExcerpt({ prompt: 'ما نوع الأسلوب في «والدّهرُ يومانِ»؟', payload: mcq }, q())).toBeNull()
  })
  it('a quote must start a word: «سوان» does not match «ويكسوان»', () => {
    expect(stepExcerpt({ prompt: 'ما معنى «سوان»؟', payload: mcq }, q())).toBeNull()
  })
})

describe('never reveals the answer', () => {
  it('questions about the location itself get no excerpt', () => {
    expect(stepExcerpt({ prompt: 'في أيّ بيت ورد «يكسوان»؟', payload: mcq }, q())).toBeNull()
    expect(stepExcerpt({ prompt: 'حدّد البيت الذي فيه «يكسوان».', payload: mcq }, q())).toBeNull()
  })
  it('options that name verses suppress the excerpt', () => {
    const where: StepPayload = { type: 'mcq', options: ['البيت الثاني', 'البيت الرابع', 'البيت السادس', 'البيت الأول'] }
    expect(stepExcerpt({ prompt: 'ما نوع الصورة في «يكسوان»؟', payload: where }, q())).toBeNull()
    const numbered: StepPayload = { type: 'ordering', items: ['الصفح (ب1–2)', 'العدوان (ب3–4)'] }
    expect(stepExcerpt({ prompt: 'رتّب الأفكار كما في البيتين (1–2).', payload: numbered }, q())).toBeNull()
  })
})

describe('fill-in copied from the verse', () => {
  it('no excerpt when the blanks are cut out of the very verse shown (it would hand over the answer)', () => {
    const copy: StepPayload = { type: 'fill_blank', text: 'وَيَكْسُوانِ الرُّبَى ____ خُضْرًا', bank: ['حللا', 'ثيابا'] }
    expect(stepExcerpt({ prompt: 'أكمل من البيت الرابع:', payload: copy }, q())).toBeNull()
    const window3: StepPayload = { type: 'fill_blank', text: 'رمت ____ ويكسوان الربى حللا (ب4)', bank: ['أ', 'ب'] }
    expect(stepExcerpt({ prompt: 'أكمل الشاهد (ب4):', payload: window3 }, q())).toBeNull()
  })
  it('an explanation to complete keeps the verse', () => {
    const explain: StepPayload = { type: 'fill_blank', text: 'شبّه ____ بإنسان يكسو غيره، فحذف المشبّه به.', bank: ['الربيع', 'الدهر'] }
    expect(nums(stepExcerpt({ prompt: 'أكمل شرح الصورة في البيت الرابع:', payload: explain }, q()))).toEqual([4])
  })
})

describe('fallback to the original question', () => {
  it('uses explicit references of the original question when the step has none', () => {
    expect(nums(stepExcerpt({ prompt: 'ما نوع الصورة؟', payload: mcq }, q('استخرج من البيتين 4 و5 صورة بيانية.')))).toEqual([4, 5])
  })
  it('but not a wide range', () => {
    expect(stepExcerpt({ prompt: 'ما نوع الصورة؟', payload: mcq }, q('في الأبيات (1–8) صور بيانية.'))).toBeNull()
  })
})

describe('prose and free verse', () => {
  const long = 'جملة طويلة '.repeat(40).trim()
  const PROSE: SourceDocument = {
    id: 'd-text',
    kind: 'text',
    caption: 'النّصّ',
    text: `البيت مدرسة الطفل الأولى. فيه يتعلّم أهمّ دروس الحياة.\nوالأسرة تُخرّج للمجتمع أفراده، وهي نعمة من نعم الله.\n${long}، وقهر الأمراض بالعقاقير الجديدة، ${long}.`
  }
  it('the paragraph named in the step', () => {
    expect(stepExcerpt({ prompt: 'ما المحلّ الإعرابيّ لجملة «هي نعمة» في الفقرة الثّانية؟', payload: mcq }, q('', [PROSE]))).toEqual({ kind: 'prose', parts: ['والأسرة تُخرّج للمجتمع أفراده، وهي نعمة من نعم الله.'] })
  })
  it('the sentence that contains the quote', () => {
    expect(stepExcerpt({ prompt: 'ما إعراب «دروس» في قوله: «يتعلّم أهمّ دروس الحياة»؟', payload: mcq }, q('', [PROSE]))).toEqual({ kind: 'prose', parts: ['فيه يتعلّم أهمّ دروس الحياة.'] })
  })
  it('a long sentence is cut to a window around the quote', () => {
    const e = stepExcerpt({ prompt: 'ما وجه بلاغة «وقهر الأمراض»؟', payload: mcq }, q('', [PROSE]))
    expect(e?.kind).toBe('prose')
    const part = e!.kind === 'prose' ? e!.parts[0]! : ''
    expect(part).toContain('قهر الأمراض')
    expect(part.startsWith('… ')).toBe(true)
    expect(part.length).toBeLessThan(360)
  })
  it('numbered free-verse lines behave like verses', () => {
    const lines: SourceDocument = { id: 'd-poem-1', kind: 'text', caption: 'النّصّ', text: Array.from({ length: 8 }, (_, i) => `${i + 1}- سطر رقم ${i + 1}`).join('\n') }
    expect(stepExcerpt({ prompt: 'ما نوع الأسلوب في السّطر الثّالث؟', payload: mcq }, q('', [lines]))).toEqual({ kind: 'verses', rows: [{ n: '3', a: 'سطر رقم 3', b: '' }] })
  })
})

describe('English and French passages', () => {
  const PASSAGE: SourceDocument = { id: 'd-text', kind: 'text', caption: 'Text', text: 'First paragraph about the Incas and their empire, long enough to count as prose.\nSecond paragraph: the Sapa Inca ruled from Cuzco with his nobles and priests.\nThird paragraph about the Spanish conquest and the gold they came to find in the Andes.' }
  it.each([
    ['Find in §2 the word that means “governed”.', 2],
    ['What does “they” refer to in paragraph 3?', 3],
    ['Relevez dans le deuxième paragraphe un mot de sens contraire.', 2],
    ['In the last paragraph, what did the Spanish want?', 3]
  ])('%s', (prompt, n) => {
    const e = stepExcerpt({ prompt, payload: mcq }, q('', [PASSAGE]))
    expect(e).toEqual({ kind: 'prose', parts: [PASSAGE.text!.split('\n')[n - 1]] })
  })
  it('no excerpt when the question asks which paragraph', () => {
    expect(stepExcerpt({ prompt: 'In which paragraph is the conquest mentioned?', payload: mcq }, q('', [PASSAGE]))).toBeNull()
    expect(latinParagraphRefs('Dans quel paragraphe…', 3)).toEqual([])
  })
})

describe('all converted sets', () => {
  const root = 'content/play-exams/sets'
  const files = readdirSync(root).flatMap((lvl) => readdirSync(join(root, lvl, 'AR')).map((f) => join(root, lvl, 'AR', f)))

  it('every excerpt is copied from the set’s own documents, at most six verses', () => {
    let shown = 0
    for (const f of files) {
      const { doc } = readExamSetFile(f)
      const source = normalizeAr(
        doc.original_questions
          .flatMap((x) => x.documents)
          .map((d) => [d.text ?? '', ...(d.table ?? []).flat()].join(' '))
          .join(' ')
      )
      for (const s of publicSteps(doc)) {
        if (!s.excerpt) continue
        shown++
        const pieces = s.excerpt.kind === 'verses' ? s.excerpt.rows.flatMap((r) => [r.a, r.b]) : s.excerpt.parts.map((p) => p.replace(/^… | …$/g, ''))
        if (s.excerpt.kind === 'verses') expect(s.excerpt.rows.length, `${doc.set_id}/${s.id}`).toBeLessThanOrEqual(6)
        for (const p of pieces.filter(Boolean)) expect(source.includes(normalizeAr(p)), `${doc.set_id}/${s.id}`).toBe(true)
      }
    }
    // تغطية فعلية: أكثر من ثلث الخطوات التفاعلية تعرض ما تحيل إليه
    expect(shown).toBeGreaterThan(1500)
  })
})
