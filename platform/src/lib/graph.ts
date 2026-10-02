/**
 * محرّك المنحنيات: محلّل تعابير رياضية آمن (بلا eval) + راسم SVG خالص يعمل في الخادم والمتصفح.
 * يقبل تعبيراً عادياً (x^2 - 2x + 1, ln(x)/x, e^x) أو LaTeX بسيطاً (\frac{1}{x}, e^{-x}, \sqrt{x+1}).
 */
import type { GraphDefinition } from './exam-blocks'

/* ------------------------------- المحلّل ------------------------------- */

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string }
type Node = { k: 'num'; v: number } | { k: 'x' } | { k: 'const'; v: number } | { k: 'un'; op: '-'; a: Node } | { k: 'bin'; op: '+' | '-' | '*' | '/' | '^'; a: Node; b: Node } | { k: 'fn'; f: string; args: Node[] }

const FUNCS: Record<string, (...a: number[]) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  arcsin: Math.asin,
  arccos: Math.acos,
  arctan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  exp: Math.exp,
  ln: Math.log,
  log: Math.log10,
  log10: Math.log10,
  log2: Math.log2,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sign: Math.sign,
  min: Math.min,
  max: Math.max,
  pow: Math.pow
}
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E }

/** LaTeX بسيط ← تعبير عادي: \frac{a}{b}، \sqrt{a}، e^{x}، \ln، \cdot، \pi، \left/\right */
export function latexToExpr(src: string): string {
  let s = src.trim()
  if (!s.includes('\\') && !s.includes('{')) return s
  // \frac{a}{b} ← ((a)/(b)) — تكرار لمعالجة التداخل
  const frac = /\\(?:d|t)?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/
  for (let i = 0; i < 20 && frac.test(s); i++) s = s.replace(frac, '(($1)/($2))')
  const sqrt = /\\sqrt\s*(?:\[(\d+)\])?\s*\{([^{}]*)\}/
  for (let i = 0; i < 20 && sqrt.test(s); i++) s = s.replace(sqrt, (_m, n: string | undefined, a: string) => (n ? `(($${a}))^(1/${n})`.replace('$', '') : `sqrt(${a})`))
  s = s
    .replace(/\\left|\\right/g, '')
    .replace(/\\cdot|\\times/g, '*')
    .replace(/\\pi/g, 'pi')
    .replace(/\\infty/g, '1e308')
    .replace(/\\(ln|log|exp|sin|cos|tan|sqrt|arcsin|arccos|arctan|sinh|cosh|tanh)\b/g, '$1')
    .replace(/\\mathrm\{e\}|\\operatorname\{e\}/g, 'e')
    .replace(/[{]/g, '(')
    .replace(/[}]/g, ')')
    .replace(/\\,|\;|\\!|\\ /g, ' ')
  return s
}

function tokenize(src: string): Tok[] {
  const out: Tok[] = []
  let i = 0
  const s = src.replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/').replace(/²/g, '^2').replace(/³/g, '^3').replace(/√/g, 'sqrt').replace(/π/g, 'pi')
  while (i < s.length) {
    const c = s[i]!
    if (/\s/.test(c)) {
      i++
      continue
    }
    if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i))
      if (!m) throw new Error('رقم غير صالح')
      out.push({ t: 'num', v: Number(m[0]) })
      i += m[0].length
      continue
    }
    if (/[a-zA-Z_]/.test(c)) {
      const m = /^[a-zA-Z_][a-zA-Z_0-9]*/.exec(s.slice(i))!
      out.push({ t: 'id', v: m[0] })
      i += m[0].length
      continue
    }
    if ('+-*/^(),'.includes(c)) {
      out.push({ t: 'op', v: c })
      i++
      continue
    }
    throw new Error(`رمز غير مفهوم: ${c}`)
  }
  return out
}

/** تعبير ← شجرة؛ يرمي خطأً عربياً مفهوماً */
export function parseExpr(src: string): Node {
  const toks = tokenize(latexToExpr(src))
  let p = 0
  const peek = () => toks[p]
  const take = () => toks[p++]
  const isOp = (v: string) => peek()?.t === 'op' && (peek() as { v: string }).v === v
  const startsFactor = () => {
    const t = peek()
    return !!t && (t.t === 'num' || t.t === 'id' || (t.t === 'op' && t.v === '('))
  }
  const expr = (): Node => {
    let a = term()
    while (isOp('+') || isOp('-')) {
      const op = (take() as { v: '+' | '-' }).v
      a = { k: 'bin', op, a, b: term() }
    }
    return a
  }
  const term = (): Node => {
    let a = unary()
    for (;;) {
      if (isOp('*') || isOp('/')) {
        const op = (take() as { v: '*' | '/' }).v
        a = { k: 'bin', op, a, b: unary() }
      } else if (startsFactor() && !(peek()!.t === 'num' && a.k === 'num')) {
        // ضرب ضمني: 2x، 3(x+1)، x sin(x)
        a = { k: 'bin', op: '*', a, b: unary() }
      } else return a
    }
  }
  const unary = (): Node => {
    if (isOp('-')) {
      take()
      return { k: 'un', op: '-', a: unary() }
    }
    if (isOp('+')) {
      take()
      return unary()
    }
    return power()
  }
  const power = (): Node => {
    const a = atom()
    if (isOp('^')) {
      take()
      return { k: 'bin', op: '^', a, b: unary() }
    }
    return a
  }
  const atom = (): Node => {
    const t = take()
    if (!t) throw new Error('التعبير ناقص')
    if (t.t === 'num') return { k: 'num', v: t.v }
    if (t.t === 'id') {
      const name = t.v.toLowerCase()
      if (isOp('(')) {
        if (!FUNCS[name]) throw new Error(`دالة غير معروفة: ${t.v}`)
        take()
        const args: Node[] = [expr()]
        while (isOp(',')) {
          take()
          args.push(expr())
        }
        if (!isOp(')')) throw new Error('قوس غير مغلق')
        take()
        return { k: 'fn', f: name, args }
      }
      if (name === 'x') return { k: 'x' }
      if (name in CONSTS) return { k: 'const', v: CONSTS[name]! }
      if (FUNCS[name]) {
        // دالة بلا قوس: sin x، ln x
        return { k: 'fn', f: name, args: [unary()] }
      }
      throw new Error(`متغيّر غير معروف: ${t.v} (المتغيّر الوحيد x)`)
    }
    if (t.v === '(') {
      const e = expr()
      if (!isOp(')')) throw new Error('قوس غير مغلق')
      take()
      return e
    }
    throw new Error(`رمز في غير موضعه: ${t.v}`)
  }
  const tree = expr()
  if (p < toks.length) throw new Error('زيادة في آخر التعبير')
  return tree
}

function evalNode(n: Node, x: number): number {
  switch (n.k) {
    case 'num':
    case 'const':
      return n.v
    case 'x':
      return x
    case 'un':
      return -evalNode(n.a, x)
    case 'bin': {
      const a = evalNode(n.a, x)
      const b = evalNode(n.b, x)
      switch (n.op) {
        case '+':
          return a + b
        case '-':
          return a - b
        case '*':
          return a * b
        case '/':
          return b === 0 ? NaN : a / b
        case '^':
          return Math.pow(a, b)
      }
    }
    case 'fn':
      return FUNCS[n.f]!(...n.args.map((a) => evalNode(a, x)))
  }
}

/** يحوّل التعبير إلى دالة عددية؛ يرمي خطأً إن كان غير صالح */
export function compileExpr(src: string): (x: number) => number {
  const tree = parseExpr(src)
  return (x) => evalNode(tree, x)
}

/* -------------------------------- الراسم -------------------------------- */

const PALETTE = ['#1b5e52', '#b3261e', '#1a4fa0', '#b8860b', '#6a1b9a', '#00695c']
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const fmt = (v: number) => {
  const r = Math.round(v * 1000) / 1000
  return Number.isInteger(r) ? String(r) : String(r).replace(/^(-?)0\./, '$10.')
}

export interface PlotResult {
  svg: string
  errors: string[]
  width: number
  height: number
}

function niceStep(range: number): number {
  const raw = range / 8
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  const m = raw / p
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p
}

/** يرسم المعلم والدوال والمقاربات والنقاط؛ أبعاد SVG بالملمتر لتطابق الشاشة والطباعة */
export function plotSvg(g: GraphDefinition): PlotResult {
  const errors: string[] = []
  const xMin = Math.min(g.xMin, g.xMax)
  const xMax = Math.max(g.xMin, g.xMax)
  const yMin = Math.min(g.yMin, g.yMax)
  const yMax = Math.max(g.yMin, g.yMax)
  const wMm = g.width ?? 110
  const PX = 4 // وحدات SVG لكل ملمتر
  const pad = { l: 34, r: 24, t: 20, b: 26 }
  const plotW = wMm * PX - pad.l - pad.r
  const sx = plotW / (xMax - xMin || 1)
  const sy = g.height ? (g.height * PX - pad.t - pad.b) / (yMax - yMin || 1) : sx
  const plotH = sy * (yMax - yMin)
  const W = plotW + pad.l + pad.r
  const H = plotH + pad.t + pad.b
  const X = (x: number) => pad.l + (x - xMin) * sx
  const Y = (y: number) => pad.t + (yMax - y) * sy
  const stepX = g.stepX ?? niceStep(xMax - xMin)
  const stepY = g.stepY ?? niceStep(yMax - yMin)
  const parts: string[] = []
  const clipId = `c${Math.abs(Math.round((xMin * 31 + xMax * 17 + yMin * 7 + yMax) * 1000))}`
  parts.push(`<defs><clipPath id="${clipId}"><rect x="${pad.l}" y="${pad.t}" width="${plotW}" height="${plotH}"/></clipPath><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#000"/></marker></defs>`)
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>`)
  // الشبكة
  if (g.grid !== false) {
    const gl: string[] = []
    for (let x = Math.ceil(xMin / stepX) * stepX; x <= xMax + 1e-9; x += stepX) gl.push(`M${X(x).toFixed(1)},${pad.t}V${(pad.t + plotH).toFixed(1)}`)
    for (let y = Math.ceil(yMin / stepY) * stepY; y <= yMax + 1e-9; y += stepY) gl.push(`M${pad.l},${Y(y).toFixed(1)}H${(pad.l + plotW).toFixed(1)}`)
    parts.push(`<path d="${gl.join('')}" stroke="#d9d9d9" stroke-width="0.6" fill="none"/>`)
  }
  // المحاور
  const axX = yMin <= 0 && yMax >= 0 ? Y(0) : yMax < 0 ? pad.t : pad.t + plotH
  const axY = xMin <= 0 && xMax >= 0 ? X(0) : xMin > 0 ? pad.l : pad.l + plotW
  parts.push(`<line x1="${pad.l - 6}" y1="${axX.toFixed(1)}" x2="${(pad.l + plotW + 10).toFixed(1)}" y2="${axX.toFixed(1)}" stroke="#000" stroke-width="1.2" marker-end="url(#arr)"/>`)
  parts.push(`<line x1="${axY.toFixed(1)}" y1="${(pad.t + plotH + 6).toFixed(1)}" x2="${axY.toFixed(1)}" y2="${pad.t - 10}" stroke="#000" stroke-width="1.2" marker-end="url(#arr)"/>`)
  // التدريج
  const ticks: string[] = []
  for (let x = Math.ceil(xMin / stepX) * stepX; x <= xMax + 1e-9; x += stepX) {
    if (Math.abs(x) < 1e-9) continue
    ticks.push(`<line x1="${X(x).toFixed(1)}" y1="${(axX - 3).toFixed(1)}" x2="${X(x).toFixed(1)}" y2="${(axX + 3).toFixed(1)}" stroke="#000" stroke-width="1"/><text x="${X(x).toFixed(1)}" y="${(axX + 13).toFixed(1)}" font-size="9" text-anchor="middle">${fmt(x)}</text>`)
  }
  for (let y = Math.ceil(yMin / stepY) * stepY; y <= yMax + 1e-9; y += stepY) {
    if (Math.abs(y) < 1e-9) continue
    ticks.push(`<line x1="${(axY - 3).toFixed(1)}" y1="${Y(y).toFixed(1)}" x2="${(axY + 3).toFixed(1)}" y2="${Y(y).toFixed(1)}" stroke="#000" stroke-width="1"/><text x="${(axY - 6).toFixed(1)}" y="${(Y(y) + 3).toFixed(1)}" font-size="9" text-anchor="end">${fmt(y)}</text>`)
  }
  parts.push(`<g font-family="Arial, Helvetica, sans-serif">${ticks.join('')}</g>`)
  if (g.frameLabels !== false && xMin <= 0 && xMax >= 0 && yMin <= 0 && yMax >= 0) {
    parts.push(`<text x="${(X(0) - 5).toFixed(1)}" y="${(Y(0) + 12).toFixed(1)}" font-size="10" text-anchor="end" font-family="Arial" font-style="italic">O</text>`)
    if (xMax >= 1 && yMax >= 1) {
      parts.push(`<line x1="${X(0).toFixed(1)}" y1="${Y(0).toFixed(1)}" x2="${X(1).toFixed(1)}" y2="${Y(0).toFixed(1)}" stroke="#000" stroke-width="2.4"/><text x="${((X(0) + X(1)) / 2).toFixed(1)}" y="${(Y(0) + 12).toFixed(1)}" font-size="10" text-anchor="middle" font-family="Arial" font-style="italic">i⃗</text>`)
      parts.push(`<line x1="${X(0).toFixed(1)}" y1="${Y(0).toFixed(1)}" x2="${X(0).toFixed(1)}" y2="${Y(1).toFixed(1)}" stroke="#000" stroke-width="2.4"/><text x="${(X(0) - 6).toFixed(1)}" y="${((Y(0) + Y(1)) / 2 + 3).toFixed(1)}" font-size="10" text-anchor="end" font-family="Arial" font-style="italic">j⃗</text>`)
    }
  }
  if (g.axisLabels?.x) parts.push(`<text x="${(pad.l + plotW + 10).toFixed(1)}" y="${(axX - 5).toFixed(1)}" font-size="10" text-anchor="end" font-family="Arial" font-style="italic">${esc(g.axisLabels.x)}</text>`)
  if (g.axisLabels?.y) parts.push(`<text x="${(axY + 5).toFixed(1)}" y="${pad.t - 4}" font-size="10" font-family="Arial" font-style="italic">${esc(g.axisLabels.y)}</text>`)
  // المقاربات
  for (const a of g.verticalAsymptotes ?? []) if (a > xMin && a < xMax) parts.push(`<line x1="${X(a).toFixed(1)}" y1="${pad.t}" x2="${X(a).toFixed(1)}" y2="${(pad.t + plotH).toFixed(1)}" stroke="#555" stroke-width="0.9" stroke-dasharray="4 3"/>`)
  for (const a of g.horizontalAsymptotes ?? []) if (a > yMin && a < yMax) parts.push(`<line x1="${pad.l}" y1="${Y(a).toFixed(1)}" x2="${(pad.l + plotW).toFixed(1)}" y2="${Y(a).toFixed(1)}" stroke="#555" stroke-width="0.9" stroke-dasharray="4 3"/>`)
  // الدوال
  const legend: { label: string; color: string; dashed: boolean }[] = []
  g.functions.forEach((f, i) => {
    const color = f.color ?? PALETTE[i % PALETTE.length]!
    let fn: (x: number) => number
    try {
      fn = compileExpr(f.expr)
    } catch (e) {
      errors.push(`${f.label ?? f.expr}: ${e instanceof Error ? e.message : 'تعبير غير صالح'}`)
      return
    }
    const d0 = Math.max(xMin, f.domain?.[0] ?? xMin)
    const d1 = Math.min(xMax, f.domain?.[1] ?? xMax)
    if (!(d1 > d0)) return
    const N = 600
    const span = yMax - yMin
    let d = ''
    let pen = false
    let prevY: number | null = null
    for (let k = 0; k <= N; k++) {
      const x = d0 + ((d1 - d0) * k) / N
      let y = fn(x)
      if (!Number.isFinite(y) || Math.abs(y) > span * 50 + Math.abs(yMax) + Math.abs(yMin)) {
        pen = false
        prevY = null
        continue
      }
      // قطع عند قفزة كبيرة (مقاربة عمودية داخل المجال)
      if (prevY != null && Math.abs(y - prevY) > span * 3) {
        pen = false
      }
      y = Math.max(yMin - span, Math.min(yMax + span, y))
      d += `${pen ? 'L' : 'M'}${X(x).toFixed(1)},${Y(y).toFixed(1)}`
      pen = true
      prevY = y
    }
    if (d) parts.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" ${f.dashed ? 'stroke-dasharray="6 4"' : ''} clip-path="url(#${clipId})"/>`)
    if (f.label) legend.push({ label: f.label, color, dashed: Boolean(f.dashed) })
  })
  // النقاط
  for (const p of g.points ?? []) {
    if (p.x < xMin || p.x > xMax || p.y < yMin || p.y > yMax) continue
    parts.push(`<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="2.4" fill="#000"/>`)
    if (p.label) parts.push(`<text x="${(X(p.x) + 5).toFixed(1)}" y="${(Y(p.y) - 5).toFixed(1)}" font-size="10" font-family="Arial" font-style="italic">${esc(p.label)}</text>`)
  }
  // المفتاح
  if (g.showLegend !== false && legend.length) {
    legend.forEach((l, i) => {
      const y = pad.t + 10 + i * 13
      const x = pad.l + plotW - 8
      parts.push(`<line x1="${(x - 22).toFixed(1)}" y1="${y}" x2="${(x - 6).toFixed(1)}" y2="${y}" stroke="${l.color}" stroke-width="2" ${l.dashed ? 'stroke-dasharray="5 3"' : ''}/><text x="${(x - 26).toFixed(1)}" y="${y + 3.5}" font-size="10" text-anchor="end" font-family="Arial" font-style="italic">${esc(l.label)}</text>`)
    })
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}" width="${wMm}mm" height="${(H / PX).toFixed(1)}mm" direction="ltr" role="img" aria-label="منحنى">${parts.join('')}</svg>`
  return { svg, errors, width: wMm, height: H / PX }
}

/** فحص سريع لتعابير الدوال (للواجهة): أخطاء بالعربية لكل دالة */
export function graphErrors(g: GraphDefinition): string[] {
  const out: string[] = []
  for (const f of g.functions) {
    try {
      compileExpr(f.expr)
    } catch (e) {
      out.push(`${f.label ?? f.expr}: ${e instanceof Error ? e.message : 'تعبير غير صالح'}`)
    }
  }
  if (!(g.xMax > g.xMin)) out.push('مجال x غير صالح')
  if (!(g.yMax > g.yMin)) out.push('مجال y غير صالح')
  return out
}
