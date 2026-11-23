/**
 * P0 — فتح PDF وتعديله وحفظه: كل عملية تُتحقق بإعادة قراءة الملف الناتج بمحرك pdf.js (نفس محرك العرض في التطبيق).
 */
import { describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { applyEdits } from '@modules/pdf/shared/applyEdits'
import { addPageNumbers, addWatermark, compress, deletePages, extractPages, imagesToPdf, merge, reorderPages, rotatePages, split } from '@modules/pdf/shared/pdfTools'
import type { EditLayer } from '@modules/pdf/shared/editModel'
import { applyInk, simplify, strokeToSvgPath } from '../src/lib/ink'
import { addNoteAnnotations } from '../src/lib/annotations'

async function samplePdf(pages = 3, label = 'Page'): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 0; i < pages; i++) {
    const p = doc.addPage([595.28, 841.89])
    p.drawText(`${label} ${i + 1}`, { x: 72, y: 760, size: 24, font })
  }
  return doc.save()
}

async function textOf(bytes: Uint8Array): Promise<string[]> {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: false, isEvalSupported: false, standardFontDataUrl: 'node_modules/pdfjs-dist/standard_fonts/' }).promise
  const out: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent()
    out.push(tc.items.map((it) => ('str' in it ? it.str : '')).join(' ').trim())
  }
  await doc.destroy()
  return out
}

describe('PDF editing (overlay engine shared with Windows)', () => {
  it('adds real text, shapes, highlight and white-out, and the result reopens', async () => {
    const src = await samplePdf(1)
    const layer: EditLayer = {
      objects: [
        { id: 'w', kind: 'redact', page: 0, x: 70, y: 60, width: 120, height: 30, color: '#ffffff' },
        { id: 't', kind: 'text', page: 0, x: 72, y: 200, width: 300, height: 30, text: 'Signed in Bou Saada', fontSize: 16, fontFamily: 'sans', bold: true, italic: false, underline: false, align: 'left', color: '#123D36', background: null, direction: 'ltr' },
        { id: 'h', kind: 'highlight', page: 0, x: 70, y: 195, width: 220, height: 24, color: '#FFE066', opacity: 0.4 },
        { id: 'r', kind: 'rect', page: 0, x: 60, y: 300, width: 200, height: 80, stroke: '#17B890', strokeWidth: 2, fill: null, opacity: 1 }
      ]
    }
    const out = await applyEdits(src, layer)
    const text = await textOf(out)
    expect(text[0]).toContain('Signed in Bou Saada')
    // النص الأصلي ما زال في الملف (التبييض طبقة فوقه وليس حذفًا للنص — لا ندّعي تحرير النص الأصلي)
    expect(text[0]).toContain('Page 1')
  })

  it('bakes handwriting as vector paths (Apple Pencil strokes)', async () => {
    const src = await samplePdf(2)
    const points: [number, number][] = Array.from({ length: 60 }, (_, i) => [100 + i * 3, 400 + Math.sin(i / 5) * 20])
    expect(strokeToSvgPath(points)).toMatch(/^M [\d.]+ [\d.]+ Q/)
    expect(simplify(points, 50).length).toBeLessThan(points.length)
    const out = await applyInk(src, [{ id: 's', page: 1, points, color: '#1D4ED8', width: 2.5, opacity: 1 }])
    const doc = await PDFDocument.load(out)
    expect(doc.getPageCount()).toBe(2)
    expect(out.length).toBeGreaterThan(src.length)
    // المسار مكتوب كرسم متجهي في محتوى الصفحة الثانية (عوامل c/l للمنحنيات والخطوط)
    const page = await (await pdfjs.getDocument({ data: out.slice() }).promise).getPage(2)
    const ops = await page.getOperatorList()
    expect(ops.fnArray.length).toBeGreaterThan(5)
  })

  it('adds real PDF comments (sticky notes) readable by other PDF apps', async () => {
    const src = await samplePdf(1)
    const out = await addNoteAnnotations(src, [{ id: 'n1', page: 0, x: 400, y: 120, text: 'راجع المبلغ — vérifier le total', author: 'NOVA' }])
    const doc = await pdfjs.getDocument({ data: out.slice() }).promise
    const annots = await (await doc.getPage(1)).getAnnotations()
    expect(annots).toHaveLength(1)
    expect(annots[0].subtype).toBe('Text')
    expect(annots[0].contentsObj.str).toBe('راجع المبلغ — vérifier le total')
    expect(annots[0].titleObj.str).toBe('NOVA')
  })

  it('saves edits over an existing document and keeps page count', async () => {
    const src = await samplePdf(3)
    const edited = await applyEdits(src, { objects: [{ id: 'c', kind: 'check', page: 2, x: 50, y: 50, width: 20, height: 20, stroke: '#000000', strokeWidth: 2, fill: null, opacity: 1 }] })
    expect((await PDFDocument.load(edited)).getPageCount()).toBe(3)
  })
})

describe('PDF tools on iOS (pdf-lib, same functions as Windows)', () => {
  it('merge / split / extract / delete / reorder / rotate', async () => {
    const a = await samplePdf(2, 'A')
    const b = await samplePdf(3, 'B')
    const merged = await merge([a, b])
    expect(await textOf(merged)).toEqual(['A 1', 'A 2', 'B 1', 'B 2', 'B 3'])
    const parts = await split(merged, { every: 2 })
    expect(parts).toHaveLength(3)
    expect(await textOf(await extractPages(merged, [4, 0]))).toEqual(['B 3', 'A 1'])
    expect(await textOf(await deletePages(merged, [1, 2]))).toEqual(['A 1', 'B 2', 'B 3'])
    expect(await textOf(await reorderPages(merged, [4, 3, 2, 1, 0]))).toEqual(['B 3', 'B 2', 'B 1', 'A 2', 'A 1'])
    const rotated = await rotatePages(merged, [0], 90)
    expect((await PDFDocument.load(rotated)).getPage(0).getRotation().angle).toBe(90)
  })

  it('watermark + page numbers + compress', async () => {
    const src = await samplePdf(2)
    const wm = await addWatermark(src, { text: 'CONFIDENTIAL', opacity: 0.2 })
    expect((await textOf(wm))[0]).toContain('CONFIDENTIAL')
    const numbered = await addPageNumbers(src, { format: '{n} / {total}' })
    expect((await textOf(numbered))[1]).toContain('2 / 2')
    const c = await compress(numbered)
    expect((await PDFDocument.load(c)).getPageCount()).toBe(2)
  })

  it('images → PDF (scanner output path)', async () => {
    // JPEG صغير صالح (1×1) لتجربة المسار دون مكتبات صور
    const jpeg = Uint8Array.from(Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64'))
    const out = await imagesToPdf([{ data: jpeg, mime: 'image/jpeg' }, { data: jpeg, mime: 'image/jpeg' }], 'A4')
    const doc = await PDFDocument.load(out)
    expect(doc.getPageCount()).toBe(2)
    expect(Math.round(doc.getPage(0).getWidth())).toBe(595)
  })
})

describe('Arabic text added in the editor is searchable', () => {
  it('raster Arabic text gets an invisible text layer that pdf.js extracts', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const { addSearchableTextForObjects } = await import('../src/lib/textLayer')
    // راستر وهمي (في التطبيق: Canvas داخل WKWebView) — الاختبار يخص طبقة النص لا الرسم
    const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'))
    const objects: EditLayer['objects'] = [
      { id: 'a', kind: 'text', page: 0, x: 72, y: 300, width: 300, height: 40, text: 'تمت الموافقة على العقد\nبوسعادة 2026-11-16', fontSize: 16, fontFamily: 'sans', bold: false, italic: false, underline: false, align: 'right', color: '#123D36', background: null, direction: 'rtl' }
    ]
    let out = await applyEdits(await samplePdf(1), { objects }, { rasterizeText: async (o) => ({ png, widthPt: o.width, heightPt: 40 }), rasterScale: 1 })
    expect((await textOf(out))[0]).not.toContain('الموافقة')
    out = await addSearchableTextForObjects(out, objects, readFileSync(resolve(__dirname, '../../../resources/fonts/NotoNaskhArabic-Regular.ttf')))
    const text = (await textOf(out))[0]
    for (const w of ['تمت', 'الموافقة', 'العقد', 'بوسعادة', '2026-11-16', 'Page 1']) expect(text, text).toContain(w)
  })
})

describe('editing rotated pages (/Rotate) in display coordinates', () => {
  for (const turn of [90, 180, 270] as const) {
    it(`page rotated ${turn}°: text lands where the user placed it and reads upright`, async () => {
      const { degrees } = await import('pdf-lib')
      const { applyInk } = await import('../src/lib/ink')
      const doc = await PDFDocument.create()
      doc.addPage([595.28, 841.89]).setRotation(degrees(turn))
      const src = await doc.save()
      const disp = turn === 180 ? { w: 595.28, h: 841.89 } : { w: 841.89, h: 595.28 }
      const objects: EditLayer['objects'] = [{ id: 't', kind: 'text', page: 0, x: 100, y: 150, width: 300, height: 24, text: 'Rotated OK', fontSize: 18, fontFamily: 'sans', bold: false, italic: false, underline: false, align: 'left', color: '#000000', background: null, direction: 'ltr' }]
      let out = await applyEdits(src, { objects }, { coordinateSpace: 'display' })
      out = await applyInk(out, [{ id: 'i', page: 0, points: [[50, 50], [80, 60], [120, 55]], color: '#1D4ED8', width: 2, opacity: 1 }])
      const pdf = await pdfjs.getDocument({ data: out, isEvalSupported: false, standardFontDataUrl: 'node_modules/pdfjs-dist/standard_fonts/' }).promise
      const page = await pdf.getPage(1)
      const vp = page.getViewport({ scale: 1 })
      expect([Math.round(vp.width), Math.round(vp.height)]).toEqual([Math.round(disp.w), Math.round(disp.h)])
      const item = (await page.getTextContent()).items.find((it) => 'str' in it && it.str.includes('Rotated')) as { str: string; transform: number[] }
      expect(item).toBeTruthy()
      const m = pdfjs.Util.transform(vp.transform, item.transform)
      // اتجاه النص على الشاشة: أفقي من اليسار إلى اليمين
      expect(m[0]).toBeGreaterThan(0)
      expect(Math.abs(m[1])).toBeLessThan(0.01)
      // الموضع: بداية النص عند x=100 وخط القاعدة قرب y=150+18
      expect(Math.abs(m[4] - 100)).toBeLessThan(1)
      expect(Math.abs(m[5] - 168)).toBeLessThan(1)
      await pdf.destroy()
    })
  }
  it('default (Windows) behaviour is unchanged: unrotated coordinates', async () => {
    const { degrees } = await import('pdf-lib')
    const doc = await PDFDocument.create()
    doc.addPage([595.28, 841.89]).setRotation(degrees(90))
    const out = await applyEdits(await doc.save(), { objects: [{ id: 't', kind: 'text', page: 0, x: 100, y: 150, width: 300, height: 24, text: 'Legacy', fontSize: 18, fontFamily: 'sans', bold: false, italic: false, underline: false, align: 'left', color: '#000000', background: null, direction: 'ltr' }] })
    const pdf = await pdfjs.getDocument({ data: out, isEvalSupported: false, standardFontDataUrl: 'node_modules/pdfjs-dist/standard_fonts/' }).promise
    const item = (await (await pdf.getPage(1)).getTextContent()).items.find((it) => 'str' in it && it.str === 'Legacy') as { transform: number[] }
    // فضاء المستخدم غير المدوّر: x=100 وخط القاعدة = 841.89 − 150 − 18
    expect(Math.abs(item.transform[4] - 100)).toBeLessThan(1)
    expect(Math.abs(item.transform[5] - (841.89 - 168))).toBeLessThan(1)
    await pdf.destroy()
  })
})

describe('Arabic editor text on a rotated page is searchable and placed where the user put it', () => {
  it('rotated 90°: hidden text layer in display coordinates', async () => {
    const { degrees } = await import('pdf-lib')
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const { addSearchableTextForObjects } = await import('../src/lib/textLayer')
    const doc = await PDFDocument.create()
    doc.addPage([595.28, 841.89]).setRotation(degrees(90))
    const objects: EditLayer['objects'] = [{ id: 'a', kind: 'text', page: 0, x: 120, y: 200, width: 300, height: 30, text: 'تمت الموافقة', fontSize: 18, fontFamily: 'sans', bold: false, italic: false, underline: false, align: 'right', color: '#000000', background: null, direction: 'rtl' }]
    const out = await addSearchableTextForObjects(await doc.save(), objects, readFileSync(resolve(__dirname, '../../../resources/fonts/NotoNaskhArabic-Regular.ttf')))
    const pdf = await pdfjs.getDocument({ data: out, isEvalSupported: false, standardFontDataUrl: 'node_modules/pdfjs-dist/standard_fonts/' }).promise
    const page = await pdf.getPage(1)
    const vp = page.getViewport({ scale: 1 })
    const items = (await page.getTextContent()).items.filter((it) => 'str' in it && it.str.trim()) as { str: string; transform: number[] }[]
    const text = items.map((i) => i.str).join(' ')
    expect(text).toContain('الموافقة')
    const m = pdfjs.Util.transform(vp.transform, items[0].transform)
    expect(Math.abs(m[1])).toBeLessThan(0.01) // أفقي على الشاشة
    expect(m[4]).toBeGreaterThan(110)
    expect(m[4]).toBeLessThan(430)
    expect(Math.abs(m[5] - 218)).toBeLessThan(8) // خط القاعدة قرب y=200+18
    await pdf.destroy()
  })
})

describe('font embedding report (Arabic PDF shown broken on iPhone, 16 Nov)', () => {
  const load = async (file: string) => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const data = new Uint8Array(readFileSync(resolve(__dirname, '../src/lib/selftest-fixtures', file)))
    const doc = await pdfjs.getDocument({ data, useSystemFonts: true, isEvalSupported: false, verbosity: 0 }).promise
    return { pageCount: doc.numPages, page: (i: number) => doc.getPage(i + 1) }
  }
  it('flags non-embedded Arabic fonts and accepts embedded ones', async () => {
    const { fontReport } = await import('../src/lib/fontReport')
    const ok = await fontReport(await load('arabic-embedded.pdf'))
    expect(ok.fonts.length).toBe(1)
    expect(ok.missing).toEqual([])
    const bad = await fontReport(await load('arabic-nonembedded.pdf'))
    expect(bad.missing).toEqual(['TraditionalArabic'])
  })
})

describe('Arabic repair plan for PDFs without embedded fonts', () => {
  const engineFor = async (file: string) => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const data = new Uint8Array(readFileSync(resolve(__dirname, '../src/lib/selftest-fixtures', file)))
    const doc = await pdfjs.getDocument({ data, useSystemFonts: true, isEvalSupported: false, verbosity: 0 }).promise
    return { pageCount: doc.numPages, page: (i: number) => doc.getPage(i + 1) } as never
  }
  it('targets only missing fonts that carry Arabic, with logical-order text and a close bundled font', async () => {
    const { repairPlan } = await import('../src/lib/arabicRepair')
    expect(await repairPlan(await engineFor('arabic-embedded.pdf'), 0)).toBeNull()
    const plan = (await repairPlan(await engineFor('arabic-nonembedded.pdf'), 0))!
    expect(plan).not.toBeNull()
    expect([...plan.targets.values()].map((s) => s.family)).toEqual(['Amiri'])
    const text = plan.items.map((i) => i.str).join('\n')
    expect(text).toContain('البناء الفكري')
    expect(text).toContain('الدكتور حيقون أسامة')
  })
  it('maps common document fonts to the closest bundled font', async () => {
    const { closestFont } = await import('../src/lib/arabicRepair')
    expect(closestFont('ABCDEF+Cairo-Bold')).toEqual({ family: 'Cairo', exact: true })
    expect(closestFont('SakkalMajalla').family).toBe('Amiri')
    expect(closestFont('Traditional Arabic,Bold').family).toBe('Amiri')
    expect(closestFont('Simplified Arabic').family).toBe('Noto Naskh Arabic')
    expect(closestFont('DroidArabicKufi').family).toBe('Noto Kufi Arabic')
    expect(closestFont('HacenTunisia').family).toBe('Cairo')
    expect(closestFont('Unknown Font').exact).toBe(false)
  })
})

describe('document font detection (write with the document font)', () => {
  it('lists the fonts used with the closest bundled font', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const { documentFonts } = await import('../src/lib/fontReport')
    const data = new Uint8Array(readFileSync(resolve(__dirname, '../src/lib/selftest-fixtures/arabic-embedded.pdf')))
    const doc = await pdfjs.getDocument({ data, useSystemFonts: true, isEvalSupported: false, verbosity: 0 }).promise
    const fonts = await documentFonts({ pageCount: doc.numPages, page: (i: number) => doc.getPage(i + 1) } as never)
    expect(fonts).toHaveLength(1)
    expect(fonts[0]).toMatchObject({ name: 'NotoNaskhArabic', embedded: true, match: { family: 'Noto Naskh Arabic', exact: true } })
    expect(fonts[0].uses).toBeGreaterThan(3)
  })
})

describe('Arabic repair: canvas font matching', () => {
  it('matches pdf.js font strings exactly, with or without quotes', async () => {
    const { fontMatcher } = await import('../src/lib/arabicRepair')
    const m = fontMatcher(['g_d0_f1', 'g_d0_s1'])
    expect(m('normal normal 16px "TraditionalArabic",g_d0_s1,sans-serif')).toBe(true)
    expect(m('16px TraditionalArabic, g_d0_s1, sans-serif')).toBe(true)
    expect(m('16px "g_d0_f1", sans-serif')).toBe(true)
    expect(m('16px "g_d0_s10", sans-serif')).toBe(false)
    expect(m('16px "g_d0_f12", serif')).toBe(false)
  })
  it('records the system-font name pdf.js uses for the missing font', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const { repairPlan } = await import('../src/lib/arabicRepair')
    const data = new Uint8Array(readFileSync(resolve(__dirname, '../src/lib/selftest-fixtures/arabic-nonembedded.pdf')))
    const doc = await pdfjs.getDocument({ data, useSystemFonts: true, isEvalSupported: false, verbosity: 0 }).promise
    const plan = (await repairPlan({ pageCount: 1, page: () => doc.getPage(1) } as never, 0))!
    expect(plan.cssNames.some((n) => /_sf?\d+$/.test(n))).toBe(true)
  })
})
