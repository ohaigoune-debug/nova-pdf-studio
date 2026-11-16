/**
 * إصلاح عرض العربية في ملفات PDF التي لا تحتوي خطوطها (اكتُشف على iPhone حقيقي، 16 نوفمبر).
 *
 * المشكلة: خط غير مضمّن ← pdf.js يرسم كل حرف وحده بخط النظام (بحرفه المجرد من ToUnicode) فتنفصل الحروف.
 * الحل (للعرض فقط، الملف لا يتغيّر):
 *  1. نعرف الخطوط الناقصة التي تحمل نصًا عربيًا في الصفحة (getOperatorList + getTextContent).
 *  2. نصيّر الصفحة عاديًا لكن نحجب رسم حروف تلك الخطوط فقط (وسيط على سياق Canvas) ونلتقط لونها وموضعها.
 *  3. نعيد رسم كل مقطع نصي (نصه المنطقي من pdf.js بعد خوارزمية bidi) بخط عربي مضمّن في التطبيق،
 *     في موضعه نفسه، ومضغوطًا أفقيًا إلى عرضه الأصلي، وبلونه — فيتشكّل ويتصل بمحرك WebKit.
 */
import { OPS, Util } from 'pdfjs-dist'
import type { PdfEngine } from '@modules/pdf/renderer/pdfEngine'
import { NASKH_FAMILY, ensureFamilyLoaded } from './editorFonts'

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/

interface FontObj { name?: string; loadedName?: string; missingFile?: boolean; isType3Font?: boolean; bold?: boolean; black?: boolean; italic?: boolean; systemFontInfo?: { loadedName?: string; css?: string } | null }
interface TextItemLike { str: string; dir: string; transform: number[]; width: number; height: number; fontName: string }
type PageProxy = Awaited<ReturnType<PdfEngine['page']>>

export interface Substitute { family: string; bold: boolean; italic: boolean; original: string }
export interface RepairPlan { targets: Map<string, Substitute>; items: TextItemLike[]; /** أسماء العائلات التي يضعها pdf.js في ctx.font لهذه الخطوط */ cssNames: string[] }

const BUNDLED = ['Amiri', 'Scheherazade New', 'Lateef', 'Markazi Text', 'Noto Kufi Arabic', 'Reem Kufi', 'Cairo', 'Tajawal', 'Almarai', 'Changa', 'El Messiri', 'Aref Ruqaa', NASKH_FAMILY]
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** أقرب خط مضمّن في التطبيق لاسم خط من الملف (بلا بادئة المجموعة الجزئية ABCDEF+). */
export function closestFont(rawName: string): { family: string; exact: boolean } {
  const name = rawName.replace(/^[A-Z]{6}\+/, '')
  const sq = squash(name)
  for (const fam of BUNDLED) if (sq.startsWith(squash(fam))) return { family: fam, exact: true }
  const rules: [RegExp, string][] = [
    [/ruq[a]?a|reqa|diwani|thuluth/i, 'Aref Ruqaa'],
    [/kufi|kufy|kofi/i, 'Noto Kufi Arabic'],
    [/hacen|gess|ge\s?ss|dubai|din|frutiger|bahij|jazeera|neue|sans\s?arabic|droidarabicnaskh|helvetica|swissra|janna|bein/i, 'Cairo'],
    [/traditional|typesetting|sakkal|majalla|badr|lotus|mitra|yagut|yaqut|zar|nazanin|aga|kfgqpc|uthman|quran|decotype|naskh|times|kitab/i, 'Amiri'],
    [/simplified|arial|tahoma|segoe|calibri|microsoftsans|andalus|geeza|sfarabic|aldhabi|urdu/i, NASKH_FAMILY]
  ]
  for (const [re, fam] of rules) if (re.test(name)) return { family: fam, exact: false }
  return { family: NASKH_FAMILY, exact: false }
}

function substituteFor(f: FontObj): Substitute {
  const original = (f.name ?? '').replace(/^[A-Z]{6}\+/, '')
  return {
    family: closestFont(original).family,
    bold: !!f.bold || !!f.black || /bold|black|heavy|semibold|demi|extrab/i.test(original),
    italic: !!f.italic || /italic|oblique/i.test(original),
    original
  }
}

const plans = new WeakMap<object, Map<number, Promise<RepairPlan | null>>>()

/** يحدد هل تحتاج الصفحة إصلاحًا (خطوط ناقصة تحمل عربية). النتيجة مخزّنة لكل محرك/صفحة. */
export function repairPlan(engine: PdfEngine, index: number): Promise<RepairPlan | null> {
  let byPage = plans.get(engine)
  if (!byPage) plans.set(engine, (byPage = new Map()))
  let p = byPage.get(index)
  if (!p) {
    p = (async () => {
      const page = await engine.page(index)
      const ops = await page.getOperatorList()
      const missing = new Map<string, FontObj>()
      ops.fnArray.forEach((fn, k) => {
        if (fn !== OPS.setFont) return
        const id = (ops.argsArray[k] as [string])[0]
        if (!id || missing.has(id) || !page.commonObjs.has(id)) return
        const f = page.commonObjs.get(id) as FontObj
        if (f.missingFile && !f.isType3Font) missing.set(id, f)
      })
      if (!missing.size) return null
      const content = await page.getTextContent()
      const items = (content.items as TextItemLike[]).filter((it) => typeof it.str === 'string' && missing.has(it.fontName))
      const arabicFonts = new Set(items.filter((it) => ARABIC.test(it.str)).map((it) => it.fontName))
      if (!arabicFonts.size) return null
      const targets = new Map<string, Substitute>()
      const cssNames = new Set<string>()
      for (const id of arabicFonts) {
        const f = missing.get(id)!
        targets.set(id, substituteFor(f))
        // pdf.js يضع في ctx.font إما "<loadedName>" أو systemFontInfo.css = "<الاسم>",<loadedName النظام>,…
        for (const n of [id, f.loadedName, f.systemFontInfo?.loadedName]) if (n) cssNames.add(n)
      }
      return { targets, items: items.filter((it) => targets.has(it.fontName) && it.str.trim()), cssNames: [...cssNames] }
    })().catch(() => null)
    byPage.set(index, p)
  }
  return p
}

interface Glyph { x: number; y: number; color: string }

/**
 * وسيط على سياق Canvas: يمرّر كل شيء كما هو، إلا رسم حروف الخطوط المستهدفة فيحجبه ويسجّل موضعه (بالبكسل) ولونه.
 * pdf.js يضبط ctx.font = `… "<loadedName>", <fallback>` قبل رسم كل مقطع.
 */
export function fontMatcher(names: string[]): (font: string) => boolean {
  const esc = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  // اسم كامل فقط (g_d0_s1 لا يطابق g_d0_s10)؛ WebKit قد يعيد ctx.font بلا علامات اقتباس
  const re = new RegExp(`(^|[\\s,"'])(${esc.join('|')})(?=[\\s,"']|$)`)
  return (font) => re.test(font)
}

function suppressingContext(ctx: CanvasRenderingContext2D, names: string[], glyphs: Glyph[]): CanvasRenderingContext2D {
  const hit = fontMatcher(names)
  const record = (x: number, y: number) => {
    const p = ctx.getTransform().transformPoint(new DOMPoint(x, y))
    glyphs.push({ x: p.x, y: p.y, color: typeof ctx.fillStyle === 'string' ? ctx.fillStyle : '#000000' })
  }
  return new Proxy(ctx, {
    get(target, prop) {
      if (prop === 'fillText' || prop === 'strokeText') {
        return (text: string, x: number, y: number, maxWidth?: number) => {
          if (hit(target.font)) {
            if (prop === 'fillText') record(x, y)
            return
          }
          return maxWidth === undefined ? target[prop](text, x, y) : target[prop](text, x, y, maxWidth)
        }
      }
      const v = Reflect.get(target, prop, target)
      return typeof v === 'function' ? v.bind(target) : v
    },
    set(target, prop, value) {
      return Reflect.set(target, prop, value, target)
    }
  })
}

function cssFont(s: Substitute, px: number): string {
  return `${s.italic ? 'italic ' : ''}${s.bold ? '700' : '400'} ${px}px "${s.family}", "${NASKH_FAMILY}", "Geeza Pro", serif`
}

/** يصيّر صفحة مع إصلاح العربية إن لزم؛ وإلا يستعمل التصيير العادي للمحرك. نفس واجهة PdfEngine.render. */
export async function renderPageRepaired(engine: PdfEngine, index: number, canvas: HTMLCanvasElement, scale: number): Promise<{ cancel: () => void; done: Promise<void>; repaired: boolean }> {
  const plan = await repairPlan(engine, index)
  if (!plan) return { ...(await engine.render(index, canvas, scale)), repaired: false }

  const page: PageProxy = await engine.page(index)
  const viewport = page.getViewport({ scale, rotation: page.rotate % 360 })
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.floor(viewport.width * dpr)
  canvas.height = Math.floor(viewport.height * dpr)
  canvas.style.width = `${Math.floor(viewport.width)}px`
  canvas.style.height = `${Math.floor(viewport.height)}px`
  const ctx = canvas.getContext('2d', { alpha: false })!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const glyphs: Glyph[] = []
  const subs = [...plan.targets.values()]
  // الخطوط البديلة تُحمَّل بالتوازي مع التصيير
  const fontsReady = Promise.all(subs.map((s) => ensureFamilyLoaded(s.family, s.bold))).catch(() => undefined)
  const task = page.render({ canvasContext: suppressingContext(ctx, plan.cssNames, glyphs), viewport })
  const done = task.promise.then(async () => {
    await fontsReady
    drawItems(ctx, plan, viewport.transform, scale, dpr, glyphs)
  }).catch(() => undefined)
  return { cancel: () => task.cancel(), done, repaired: true }
}

function drawItems(ctx: CanvasRenderingContext2D, plan: RepairPlan, vt: number[], scale: number, dpr: number, glyphs: Glyph[]): void {
  for (const it of plan.items) {
    const sub = plan.targets.get(it.fontName)!
    const [a, b, c, d, e, f] = Util.transform(vt, it.transform)
    const size = Math.hypot(c, d)
    const width = it.width * scale
    if (!size || !width) continue
    const angle = Math.atan2(b, a)
    // اللون: أول حرف محجوب داخل مستطيل المقطع (بالبكسل)
    const minX = Math.min(e, e + width * Math.cos(angle)) * dpr - 2
    const maxX = Math.max(e, e + width * Math.cos(angle)) * dpr + 2
    const color = glyphs.find((g) => g.x >= minX && g.x <= maxX && Math.abs(g.y - f * dpr) <= size * dpr * 0.6)?.color ?? '#000000'
    ctx.save()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.translate(e, f)
    if (angle) ctx.rotate(angle)
    ctx.font = cssFont(sub, size)
    ctx.direction = it.dir === 'ltr' ? 'ltr' : 'rtl'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = color
    const measured = ctx.measureText(it.str).width
    const sx = measured > 0 ? Math.min(2, Math.max(0.5, width / measured)) : 1
    ctx.scale(sx, 1)
    ctx.fillText(it.str, 0, 0)
    ctx.restore()
  }
}
