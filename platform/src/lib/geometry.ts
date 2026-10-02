/** أشكال هندسية بسيطة (نقاط، قطع، دوائر، مضلّعات، زوايا قائمة) ← SVG خالص للخادم والمتصفح */
import type { GeometryDefinition } from './exam-blocks'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function geometrySvg(f: GeometryDefinition): { svg: string; errors: string[]; width: number; height: number } {
  const errors: string[] = []
  const xMin = Math.min(f.xMin, f.xMax)
  const xMax = Math.max(f.xMin, f.xMax)
  const yMin = Math.min(f.yMin, f.yMax)
  const yMax = Math.max(f.yMin, f.yMax)
  const wMm = f.width ?? 90
  const PX = 4
  const pad = 14
  const plotW = wMm * PX - 2 * pad
  const s = plotW / (xMax - xMin || 1)
  const plotH = s * (yMax - yMin)
  const W = plotW + 2 * pad
  const H = plotH + 2 * pad
  const X = (x: number) => pad + (x - xMin) * s
  const Y = (y: number) => pad + (yMax - y) * s
  const pts = new Map(f.points.map((p) => [p.id, p]))
  const need = (id: string) => {
    const p = pts.get(id)
    if (!p) errors.push(`النقطة ${id} غير معرّفة`)
    return p
  }
  const parts: string[] = [`<rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>`]
  if (f.grid) {
    const gl: string[] = []
    for (let x = Math.ceil(xMin); x <= xMax; x++) gl.push(`M${X(x).toFixed(1)},${pad}V${(pad + plotH).toFixed(1)}`)
    for (let y = Math.ceil(yMin); y <= yMax; y++) gl.push(`M${pad},${Y(y).toFixed(1)}H${(pad + plotW).toFixed(1)}`)
    parts.push(`<path d="${gl.join('')}" stroke="#ddd" stroke-width="0.6" fill="none"/>`)
  }
  if (f.axes && xMin <= 0 && xMax >= 0 && yMin <= 0 && yMax >= 0) {
    parts.push(`<line x1="${pad}" y1="${Y(0).toFixed(1)}" x2="${(pad + plotW).toFixed(1)}" y2="${Y(0).toFixed(1)}" stroke="#000" stroke-width="1"/><line x1="${X(0).toFixed(1)}" y1="${(pad + plotH).toFixed(1)}" x2="${X(0).toFixed(1)}" y2="${pad}" stroke="#000" stroke-width="1"/>`)
  }
  for (const poly of f.polygons ?? []) {
    const ps = poly.points.map(need)
    if (ps.some((p) => !p)) continue
    parts.push(`<polygon points="${ps.map((p) => `${X(p!.x).toFixed(1)},${Y(p!.y).toFixed(1)}`).join(' ')}" fill="${poly.fill ? 'rgba(27,94,82,0.12)' : 'none'}" stroke="#000" stroke-width="1.3" stroke-linejoin="round"/>`)
  }
  for (const c of f.circles ?? []) {
    const p = need(c.center)
    if (!p) continue
    parts.push(`<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${(c.radius * s).toFixed(1)}" fill="none" stroke="#000" stroke-width="1.3" ${c.dashed ? 'stroke-dasharray="5 3"' : ''}/>`)
    if (c.label) parts.push(`<text x="${(X(p.x) + c.radius * s * 0.72).toFixed(1)}" y="${(Y(p.y) - c.radius * s * 0.72).toFixed(1)}" font-size="10" font-family="Arial" font-style="italic">${esc(c.label)}</text>`)
  }
  for (const sg of f.segments ?? []) {
    const a = need(sg.from)
    const b = need(sg.to)
    if (!a || !b) continue
    parts.push(`<line x1="${X(a.x).toFixed(1)}" y1="${Y(a.y).toFixed(1)}" x2="${X(b.x).toFixed(1)}" y2="${Y(b.y).toFixed(1)}" stroke="#000" stroke-width="1.3" ${sg.dashed ? 'stroke-dasharray="5 3"' : ''} ${sg.arrow ? 'marker-end="url(#garr)"' : ''}/>`)
    if (sg.label) parts.push(`<text x="${((X(a.x) + X(b.x)) / 2 + 4).toFixed(1)}" y="${((Y(a.y) + Y(b.y)) / 2 - 4).toFixed(1)}" font-size="10" font-family="Arial" font-style="italic">${esc(sg.label)}</text>`)
  }
  for (const ra of f.rightAngles ?? []) {
    const o = need(ra.at)
    const a = need(ra.from)
    const b = need(ra.to)
    if (!o || !a || !b) continue
    const ux = a.x - o.x
    const uy = a.y - o.y
    const vx = b.x - o.x
    const vy = b.y - o.y
    const lu = Math.hypot(ux, uy) || 1
    const lv = Math.hypot(vx, vy) || 1
    const k = 0.35
    const p1 = { x: o.x + (ux / lu) * k, y: o.y + (uy / lu) * k }
    const p2 = { x: o.x + (vx / lv) * k, y: o.y + (vy / lv) * k }
    const p3 = { x: p1.x + p2.x - o.x, y: p1.y + p2.y - o.y }
    parts.push(`<path d="M${X(p1.x).toFixed(1)},${Y(p1.y).toFixed(1)}L${X(p3.x).toFixed(1)},${Y(p3.y).toFixed(1)}L${X(p2.x).toFixed(1)},${Y(p2.y).toFixed(1)}" fill="none" stroke="#000" stroke-width="1"/>`)
  }
  for (const p of f.points) {
    if (p.hidden) continue
    parts.push(`<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="2.2" fill="#000"/>`)
    parts.push(`<text x="${(X(p.x) + 4).toFixed(1)}" y="${(Y(p.y) - 4).toFixed(1)}" font-size="11" font-family="Arial" font-style="italic">${esc(p.label ?? p.id)}</text>`)
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}" width="${wMm}mm" height="${(H / PX).toFixed(1)}mm" direction="ltr" role="img" aria-label="شكل هندسي"><defs><marker id="garr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#000"/></marker></defs>${parts.join('')}</svg>`
  return { svg, errors, width: wMm, height: H / PX }
}
