import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { addInvisibleTextLayer } from '@modules/ocr/renderer/searchablePdf'
import { fontkitTreatsAsRtl, prepareArabicRunForFontkit, segmentMixedLine } from '@modules/ocr/renderer/bidiOrder'

describe('Arabic text-layer ordering (digits and Latin words inside Arabic lines)', () => {
  it('detects when fontkit will reverse the run', () => {
    expect(fontkitTreatsAsRtl('المبلغ 12500 دينار')).toBe(true)
    expect(fontkitTreatsAsRtl('2026 فاتورة')).toBe(true)
    expect(fontkitTreatsAsRtl('Client : مكتبة')).toBe(false)
  })
  it('pre-reverses only the LTR runs (digits, latin, amounts)', () => {
    expect(prepareArabicRunForFontkit('المبلغ 12500 دينار')).toBe('المبلغ 00521 دينار')
    expect(prepareArabicRunForFontkit('الإجمالي 12 500,00 DA')).toBe('الإجمالي AD 00,005 21')
    expect(prepareArabicRunForFontkit('فاتورة رقم 2026-015')).toBe('فاتورة رقم 510-6202')
  })
  it('leaves pure Arabic and pure latin untouched', () => {
    expect(prepareArabicRunForFontkit('مكتبة النور')).toBe('مكتبة النور')
    expect(prepareArabicRunForFontkit('Client 12')).toBe('Client 12')
  })
  it('latin-first lines: Arabic runs are put in visual order', () => {
    expect(prepareArabicRunForFontkit('Client : مكتبة النور')).toBe('Client : رونلا ةبتكم')
  })
  it('splits mixed lines by the font able to draw them (Noto Naskh has no Latin letters, "-", "/", "%")', () => {
    const ar = new Set([...'0123456789 :,.'].map((c) => c.codePointAt(0)!))
    const has = (cp: number) => ar.has(cp) || (cp >= 0x0600 && cp <= 0x06ff)
    const latin = (t: string) => /^[\x20-\x7E]*$/.test(t)
    expect(segmentMixedLine('فاتورة رقم 2026-015 للعميل', has, latin)).toEqual({ rtl: true, segments: [{ text: 'فاتورة رقم', font: 'arabic' }, { text: '2026-015', font: 'latin' }, { text: 'للعميل', font: 'arabic' }] })
    expect(segmentMixedLine('المبلغ 12 500,00 DA', has, latin)).toEqual({ rtl: true, segments: [{ text: 'المبلغ 12 500,00', font: 'arabic' }, { text: 'DA', font: 'latin' }] })
    expect(segmentMixedLine('Client : مكتبة النور', has, latin)).toEqual({ rtl: false, segments: [{ text: 'Client :', font: 'latin' }, { text: 'مكتبة النور', font: 'arabic' }] })
  })
  it('searchable PDF: every word is extracted in the right order (Arabic-first and Latin-first lines)', async () => {
    const lines = ['فاتورة رقم 2026-015 للعميل', 'Client : مكتبة النور', 'المبلغ 12 500,00 DA', 'Total TTC : 12 500,00 دينار']
    const doc = await PDFDocument.create()
    doc.addPage([595.28, 841.89])
    const spans = lines.map((text, i) => ({ text, x: 60, y: 80 + i * 40, width: 400, height: 20, fontSize: 16 }))
    const font = readFileSync(resolve(__dirname, '../../../resources/fonts/NotoNaskhArabic-Regular.ttf'))
    const out = await addInvisibleTextLayer(await doc.save(), [{ index: 0, spans: spans as never, pageWidthPt: 595.28, pageHeightPt: 841.89 }], font)
    const pdf = await pdfjs.getDocument({ data: out, isEvalSupported: false, standardFontDataUrl: 'node_modules/pdfjs-dist/standard_fonts/' }).promise
    const text = (await (await pdf.getPage(1)).getTextContent()).items.map((it) => ('str' in it ? it.str : '')).join(' | ')
    await pdf.destroy()
    for (const word of ['فاتورة', 'للعميل', '2026-015', 'Client', 'مكتبة', 'النور', 'المبلغ', '12 500,00', 'Total', 'دينار']) expect(text, text).toContain(word)
  })
})
