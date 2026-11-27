/**
 * «رمز النسخة» في ملفات PDF (27 نوفمبر 2026): رمز صغير معتم يشبه رقم الوثيقة + وسم خفي في بيانات الملف
 * ونصّه الشفاف — يبقى بعد حذف العلامة المائية، ومنه يُعرف الحساب في «كشف التسريب».
 */
import fs from 'node:fs'
import { PDFDocument } from 'pdf-lib'
import { extractText, getDocumentProxy } from 'unpdf'
import { describe, expect, it } from 'vitest'
import { AppError } from '@/server/lib/errors'
import { footnotesMatch, formatLeakRef, leakFootnotesOf, leakMarkOf, leakRefOf, normalizeLeakRef, parseFootnoteNumbers } from '@/server/lib/leak-ref'
import { findFootnoteTokens, readFootnoteSlots, writeFootnoteSlots } from '@/server/lib/pdf-footnotes'
import { StandardFonts, rgb } from 'pdf-lib'
import { parseLeakQuery, scanLeakedPdf } from '@/server/services/leak-trace.service'
import { stampPdf } from '@/server/services/media.service'
import { slicePdf } from '@/server/services/publish.service'

const FIXTURE = 'content/lessons/pdf/4AM/MATH/U1-L1.pdf'
const USER = '4b21efbc-1111-4222-8333-944455556666'
const lines = ['student@test.dz', '2026-11-27 · 4b21efbc']

async function textOf(bytes: Uint8Array): Promise<string> {
  return (await extractText(await getDocumentProxy(new Uint8Array(bytes)), { mergePages: true })).text
}

describe('الرمز', () => {
  it('ثابت لنفس الحساب، 6 خانات من أبجدية لا تلتبس', () => {
    const ref = leakRefOf(USER)
    expect(ref).toMatch(/^[0-9A-HJKMNP-TV-Z]{6}$/)
    expect(leakRefOf(USER.toUpperCase())).toBe(ref)
    expect(leakRefOf('4b21efbc-1111-4222-8333-944455556667')).not.toBe(ref)
    expect(formatLeakRef('7K3Q29')).toBe('7K3Q-29')
  })

  it('يُقرأ كما يُنسخ من الصفحة، حتى مع O بدل 0 وI/L بدل 1', () => {
    expect(normalizeLeakRef('Ref. 7k3q-29')).toBe('7K3Q29')
    expect(normalizeLeakRef('mdz-ref:7K3Q29')).toBe('7K3Q29')
    expect(normalizeLeakRef('7KOQ 2I')).toBe('7K0Q21')
    expect(normalizeLeakRef('7K3Q-2U')).toBeNull()
    expect(normalizeLeakRef('7K3Q2')).toBeNull()
  })

  it('خانة البحث تفهمه بكل أشكاله دون أن تخلطه برمز الحساب أو الهاتف أو الاسم', () => {
    expect(parseLeakQuery('Ref. 7K3Q-29')).toEqual({ kind: 'ref', value: '7K3Q29', date: null })
    expect(parseLeakQuery('7k3q-29 · 2026-11-27')).toEqual({ kind: 'ref', value: '7K3Q29', date: '2026-11-27' })
    expect(parseLeakQuery('mdz-ref:7K3Q29')).toEqual({ kind: 'ref', value: '7K3Q29', date: null })
    expect(parseLeakQuery('7K3Q29')).toEqual({ kind: 'ref', value: '7K3Q29', date: null })
    expect(parseLeakQuery('2026-11-03 · 4B21EFBC')).toEqual({ kind: 'code', value: '4b21efbc', date: '2026-11-03' })
    expect(parseLeakQuery('…1234')).toMatchObject({ kind: 'phone', value: '1234' })
    expect(parseLeakQuery('تلميذ مسرّب')).toMatchObject({ kind: 'name' })
  })
})

describe('الختم والفحص', () => {
  it('كل صفحة تحمل أرقام التهميش أو الرمز الظاهر، والنص الشفاف، وبيانات الملف تحمل الوسم؛ والختم حتمي', async () => {
    const original = fs.readFileSync(FIXTURE)
    const ref = leakRefOf(USER)
    const stamped = await stampPdf(original, lines, leakMarkOf(USER))
    expect((await stampPdf(original, lines, leakMarkOf(USER))).equals(stamped)).toBe(true)
    const doc = await PDFDocument.load(stamped, { updateMetadata: false })
    expect(doc.getKeywords()).toContain(`mdz-ref:${ref}`)
    const pdf = await getDocumentProxy(new Uint8Array(stamped))
    for (let i = 1; i <= pdf.numPages; i++) {
      const t = ((await (await pdf.getPage(i)).getTextContent()).items as { str?: string }[]).map((x) => x.str ?? '').join(' ')
      // صفحة فيها أرقام تهميش تلقائية لا تحتاج «Ref.» الظاهر؛ غيرها يحمله أعلى الصفحة وعلى حافتها
      const nums = leakFootnotesOf(USER).slice(0, 4).map((n) => `(${n})`)
      if (!nums.some((n) => t.includes(n))) {
        expect(t).toContain(`Ref. ${formatLeakRef(ref)}`)
        expect(t).toContain(`${formatLeakRef(ref)} · ${i}/${pdf.numPages}`)
      }
      expect(t).toContain(`mdz-ref:${ref}`)
    }
    // ملف بلا مكان للأرقام (لا نص عربي): «Ref.» الظاهر في كل صفحة
    const latin = await PDFDocument.create()
    latin.addPage([595, 842])
    const latinStamped = await stampPdf(Buffer.from(await latin.save()), lines, leakMarkOf(USER))
    expect(await textOf(latinStamped)).toContain(`Ref. ${formatLeakRef(ref)}`)
    // بلا رمز (الزائر): لا شيء يُضاف غير العلامة المعتادة
    const plain = await stampPdf(original, lines)
    expect(await textOf(plain)).not.toContain('Ref.')
  })

  it('فحص الملف المسرَّب: من بيانات الملف، ثم من نصّه إن نُزعت البيانات، ولا قرينة في الأصل', async () => {
    const original = fs.readFileSync(FIXTURE)
    const ref = leakRefOf(USER)
    const stamped = await stampPdf(original, lines, leakMarkOf(USER))
    expect(await scanLeakedPdf(stamped)).toMatchObject({ ref, source: 'metadata', code: '4b21efbc', date: '2026-11-27', email: 'student@test.dz', query: `Ref. ${formatLeakRef(ref)}` })

    // نسخ الصفحات إلى ملف جديد يُسقط بيانات الملف — الرمز يبقى في النص
    const src = await PDFDocument.load(stamped)
    const copy = await PDFDocument.create()
    for (const p of await copy.copyPages(src, src.getPageIndices())) copy.addPage(p)
    const stripped = await copy.save()
    expect((await PDFDocument.load(stripped)).getKeywords() ?? '').not.toContain('mdz-ref')
    expect(await scanLeakedPdf(stripped)).toMatchObject({ ref, source: 'text' })

    expect(await scanLeakedPdf(original)).toMatchObject({ ref: null, code: null, query: null })
    await expect(scanLeakedPdf(new TextEncoder().encode('not a pdf'))).rejects.toThrow(AppError)
  })
})

describe('أرقام التهميش', () => {
  it('8 أرقام بين 10 و99، ثابتة لنفس الحساب ومختلفة لغيره', () => {
    const nums = leakFootnotesOf(USER)
    expect(nums).toHaveLength(8)
    expect(nums.every((n) => n >= 10 && n <= 99)).toBe(true)
    expect(leakFootnotesOf(USER.toUpperCase())).toEqual(nums)
    expect(leakFootnotesOf('4b21efbc-1111-4222-8333-944455556667')).not.toEqual(nums)
    expect(footnotesMatch(USER, nums.slice(0, 4))).toBe(true)
    expect(footnotesMatch(USER, [nums[1]!, nums[0]!, nums[2]!])).toBe(false)
  })

  it('تُقرأ كما يكتبها المشرف من الصورة', () => {
    expect(parseFootnoteNumbers('51 95 82 18')).toEqual([51, 95, 82, 18])
    expect(parseFootnoteNumbers('(51) (95) (82) (18)')).toEqual([51, 95, 82, 18])
    expect(parseFootnoteNumbers('51·95·82')).toEqual([51, 95, 82])
    expect(parseFootnoteNumbers('٥١ ٩٥ ٨٢ ١٨')).toEqual([51, 95, 82, 18])
    expect(parseFootnoteNumbers('519582')).toEqual([51, 95, 82])
    expect(parseFootnoteNumbers('51958218')).toBeNull() // يُترك لرمز الحساب، والبحث هناك يشملها
    expect(parseFootnoteNumbers('51 95')).toBeNull()
    expect(parseFootnoteNumbers('51 05 82')).toBeNull()
    expect(parseLeakQuery('(51) (95) (82) (18)')).toEqual({ kind: 'fn', value: '51 95 82 18', date: null })
    expect(parseLeakQuery('51958218')).toMatchObject({ kind: 'code', value: '51958218' })
  })

  /** ملف فيه وسوم كما يتركها HTML الدرس: نص 1px أبيض في مكان كل رقم */
  async function tokenPdf(): Promise<Uint8Array> {
    const doc = await PDFDocument.create()
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const body = await doc.embedFont(StandardFonts.TimesRoman)
    for (let p = 0; p < 2; p++) {
      const page = doc.addPage([595, 842])
      page.drawText('Lesson text before the footnote', { x: 120, y: 700, size: 12, font: body })
      page.drawText(`mdzfn${p * 2}s93c1f2937`, { x: 100.5, y: 704, size: 1, font, color: rgb(1, 1, 1) })
      page.drawText(`mdzfn${p * 2 + 1}s109c374151`, { x: 60, y: 120, size: 1, font, color: rgb(1, 1, 1) })
    }
    return doc.save()
  }

  it('الأداة تجد الأماكن، والختم يرسم أرقام صاحب النسخة فيها ويحذف خريطة الأماكن', async () => {
    const raw = await tokenPdf()
    const found = await findFootnoteTokens(raw)
    expect(found).toEqual([
      { p: 0, x: 100.5, y: 704, k: 0, s: 9.3, c: '1f2937' },
      { p: 0, x: 60, y: 120, k: 1, s: 10.9, c: '374151' },
      { p: 1, x: 100.5, y: 704, k: 2, s: 9.3, c: '1f2937' },
      { p: 1, x: 60, y: 120, k: 3, s: 10.9, c: '374151' }
    ])
    const doc = await PDFDocument.load(raw)
    writeFootnoteSlots(doc, found)
    const ready = Buffer.from(await doc.save())
    expect(readFootnoteSlots(await PDFDocument.load(ready))).toEqual(found)

    const nums = leakFootnotesOf(USER)
    const stamped = await stampPdf(ready, lines, leakMarkOf(USER))
    const out = await PDFDocument.load(stamped)
    expect(readFootnoteSlots(out)).toBeNull()
    const pdf = await getDocumentProxy(new Uint8Array(stamped))
    const items = async (i: number) => ((await (await pdf.getPage(i)).getTextContent()).items as { str: string; transform: number[] }[])
    const p1 = await items(1)
    expect(p1.find((t) => t.str === `(${nums[0]})`)?.transform.slice(4)).toEqual([100.5, 704])
    expect(p1.find((t) => t.str === `(${nums[1]})`)?.transform.slice(4)).toEqual([60, 120])
    expect((await items(2)).map((t) => t.str)).toEqual(expect.arrayContaining([`(${nums[2]})`, `(${nums[3]})`]))
    // في الدرس الجاهز للبصمة تغني الأرقام عن «Ref.» الظاهر، ويبقى الوسم الخفي
    expect(p1.some((t) => t.str.startsWith('Ref.'))).toBe(false)
    expect(out.getKeywords()).toContain(`mdz-ref:${leakRefOf(USER)}`)
    // الزائر: أرقام عامة ثابتة لا تخص أحدًا، فلا تبقى أماكن فارغة
    const anon = await getDocumentProxy(new Uint8Array(await stampPdf(ready, ['madrasa · public'])))
    const pub = leakFootnotesOf('public')
    expect(((await (await anon.getPage(1)).getTextContent()).items as { str: string }[]).map((t) => t.str)).toContain(`(${pub[0]})`)
  })

  it('تقطيع الملف إلى صفحات (رفع دفعة) يُبقي أماكن الصفحات المقتطعة', async () => {
    const doc = await PDFDocument.load(await tokenPdf())
    writeFootnoteSlots(doc, await findFootnoteTokens(await doc.save()))
    const second = await PDFDocument.load(await slicePdf(await doc.save(), 2, 2))
    expect(readFootnoteSlots(second)?.map((s) => [s.p, s.k])).toEqual([[0, 2], [0, 3]])
  })

  it('درس «إعراب الجمل» في المستودع جاهز للبصمة: 4 أرقام في النص و4 في قائمة التهميشات', async () => {
    const doc = await PDFDocument.load(fs.readFileSync('content/lessons/pdf/3AS/AR/U3-L2-LIT-LANG.pdf'), { updateMetadata: false })
    const slots = readFootnoteSlots(doc)!
    expect(slots).toHaveLength(8)
    expect(slots.map((s) => s.k).sort()).toEqual([0, 0, 1, 1, 2, 2, 3, 3])
    expect(slots.every((s) => s.p === 0)).toBe(true)
  })
})
