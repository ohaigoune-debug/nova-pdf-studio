/**
 * أرقام التهميش التلقائية في ملفات PDF غير المجهّزة (27 نوفمبر 2026): بعد آخر كلمة في بعض الأسطر،
 * وسطر تهميش في فراغ أسفل الصفحة — دون لمس نص الأستاذ، ولا فوق نصّ أو خطّ أو صورة.
 */
import fs from 'node:fs'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { getDocumentProxy } from 'unpdf'
import { beforeEach, describe, expect, it } from 'vitest'
import { leakFootnotesOf, leakMarkOf } from '@/server/lib/leak-ref'
import { autoFootnoteLayout, resetAutoFootnoteCache } from '@/server/lib/pdf-auto-footnotes'
import { stampPdf } from '@/server/services/media.service'

const LESSON = 'content/lessons/pdf/3AS/AR/U1-L1-LIT-LANG.pdf'
const USER = '9ef45e69-e2df-43cd-b2fb-42a22405c5c6'
const lines = ['student@test.dz', '2026-11-27 · 9ef45e69']

type TextItem = { str: string; transform: number[]; width: number; height: number }
async function pageItems(bytes: Uint8Array, i: number): Promise<TextItem[]> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes))
  return ((await (await pdf.getPage(i)).getTextContent()).items as TextItem[]).filter((t) => t.str.trim())
}

beforeEach(() => {
  process.env.PDF_STAMP_CACHE_MAX_MB = '0'
  resetAutoFootnoteCache()
})

describe('اختيار الأماكن', () => {
  it('حتى 4 أرقام في كل صفحة بترتيب القراءة، لا يقع أيّ منها على نصّ الأستاذ', async () => {
    const bytes = new Uint8Array(fs.readFileSync(LESSON))
    const layout = (await autoFootnoteLayout(bytes))!
    expect(layout.markers.length).toBeGreaterThan(0)
    for (const p of [...new Set(layout.markers.map((m) => m.p))]) {
      const own = layout.markers.filter((m) => m.p === p)
      expect(own.length).toBeLessThanOrEqual(4)
      expect(own.map((m) => m.k)).toEqual(own.map((_, i) => i))
      // من أعلى الصفحة إلى أسفلها
      expect([...own].sort((a, b) => b.y - a.y).map((m) => m.k)).toEqual(own.map((m) => m.k))
      const items = await pageItems(bytes, p + 1)
      for (const m of own) {
        const w = 1.667 * m.s
        const hit = items.find((t) => t.transform[4]! < m.x + w && t.transform[4]! + t.width > m.x && t.transform[5]! < m.y + m.s * 0.8 && t.transform[5]! + t.height * 0.8 > m.y)
        expect(hit, `رقم الصفحة ${p + 1} يقع على «${hit?.str}»`).toBeUndefined()
      }
    }
    for (const n of layout.notes) expect(n.ks).toEqual(layout.markers.filter((m) => m.p === n.p).map((m) => m.k))
  })

  it('ملف بلا نص عربي (أو ممسوح ضوئيًا) لا يأخذ أرقامًا', async () => {
    const doc = await PDFDocument.create()
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const page = doc.addPage([595, 842])
    for (let i = 0; i < 10; i++) page.drawText('Latin text line only', { x: 60, y: 700 - i * 20, size: 12, font })
    expect(await autoFootnoteLayout(await doc.save())).toBeNull()
  })

  it('يُحسب مرة لكل ملف', async () => {
    const bytes = new Uint8Array(fs.readFileSync(LESSON))
    const first = await autoFootnoteLayout(bytes)
    expect(await autoFootnoteLayout(bytes)).toBe(first)
  })
})

describe('الختم', () => {
  it('أرقام صاحب النسخة في أماكنها وفي سطر التهميش، و«Ref.» يغيب عن الصفحات التي فيها أرقام؛ والختم حتمي', async () => {
    const original = fs.readFileSync(LESSON)
    const layout = (await autoFootnoteLayout(new Uint8Array(original)))!
    const nums = leakFootnotesOf(USER)
    const stamped = await stampPdf(original, lines, leakMarkOf(USER))
    expect((await stampPdf(original, lines, leakMarkOf(USER))).equals(stamped)).toBe(true)
    for (const p of [...new Set(layout.markers.map((m) => m.p))]) {
      const items = await pageItems(stamped, p + 1)
      const strs = items.map((t) => t.str)
      for (const m of layout.markers.filter((x) => x.p === p)) {
        const drawn = items.find((t) => t.str === `(${nums[m.k]})` && Math.abs(t.transform[4]! - m.x) < 0.01 && Math.abs(t.transform[5]! - m.y) < 0.01)
        expect(drawn, `الرقم ${m.k} في الصفحة ${p + 1}`).toBeDefined()
      }
      expect(strs.some((t) => t.startsWith('Ref.'))).toBe(false)
      expect(strs.join(' ')).toContain('mdz-ref:')
    }
    // تلميذ آخر: الأماكن نفسها بأرقام أخرى
    const other = '738d5be9-c8c5-452b-a067-4b65efb9480e'
    const theirs = (await pageItems(await stampPdf(original, lines, leakMarkOf(other)), layout.markers[0]!.p + 1)).map((t) => t.str)
    expect(theirs).toContain(`(${leakFootnotesOf(other)[0]})`)
  })

  it('الزائر بلا حساب: لا أرقام ولا رمز', async () => {
    const original = fs.readFileSync(LESSON)
    const strs = (await pageItems(await stampPdf(original, ['madrasa · public']), 1)).map((t) => t.str)
    expect(strs.some((t) => /^\(\d{2}\)$/.test(t))).toBe(false)
    expect(strs.some((t) => t.startsWith('Ref.'))).toBe(false)
  })
})
