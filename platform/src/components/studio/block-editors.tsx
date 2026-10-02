'use client'

import { Minus, Plus, Trash2, Upload } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Alert } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import type { GeometryDefinition, GraphDefinition, StudioBlock, VariationTable } from '@/lib/exam-blocks'
import { graphErrors } from '@/lib/graph'
import { uploadViaTicket } from '@/lib/upload-client'
import { MathInput } from './math-input'

const BlockView = dynamic(() => import('./block-view').then((m) => m.BlockView), { ssr: false })

type Patch<T> = (p: Partial<T>) => void

/** محرّر كتلة حسب نوعها، بمعاينة حيّة أسفله (نفس المصيّر الذي يطبع) */
export function BlockEditor({ block, onChange, assets, preview = true }: { block: StudioBlock; onChange: (b: StudioBlock) => void; assets?: Record<string, string>; preview?: boolean }) {
  const set = (p: Record<string, unknown>) => onChange({ ...block, ...p } as StudioBlock)
  const [localAssets, setLocalAssets] = useState<Record<string, string>>({})
  const merged = useMemo(() => ({ ...(assets ?? {}), ...localAssets }), [assets, localAssets])
  return (
    <div className="space-y-3">
      <Fields block={block} set={set} onLocalAsset={(id, url) => setLocalAssets((a) => ({ ...a, [id]: url }))} />
      {preview ? (
        <div className="studio-paper rounded-lg border border-dashed bg-white p-3 text-[13px] text-black" dir="rtl">
          <BlockView block={block} assets={merged} />
        </div>
      ) : null}
    </div>
  )
}

function Fields({ block, set, onLocalAsset }: { block: StudioBlock; set: Patch<Record<string, unknown>>; onLocalAsset: (id: string, url: string) => void }) {
  switch (block.type) {
    case 'HEADING':
      return (
        <div className="grid gap-2 sm:grid-cols-[1fr_120px_120px]">
          <Input value={block.text} onChange={(e) => set({ text: e.target.value })} placeholder="نصّ العنوان" dir="auto" autoFocus />
          <Select value={String(block.level ?? 2)} onChange={(e) => set({ level: Number(e.target.value) })}>
            <option value="1">رئيسي</option>
            <option value="2">فرعي</option>
            <option value="3">صغير</option>
          </Select>
          <AlignSelect value={block.align} onChange={(v) => set({ align: v })} />
        </div>
      )
    case 'PARAGRAPH':
      return (
        <div className="space-y-2">
          <MathInput value={block.text} onChange={(v) => set({ text: v })} rows={5} previewDefault={false} autoFocus />
          <div className="grid grid-cols-3 gap-2">
            <AlignSelect value={block.align} onChange={(v) => set({ align: v })} justify />
            <Select value={block.size ?? 'normal'} onChange={(e) => set({ size: e.target.value })}>
              <option value="small">خطّ صغير</option>
              <option value="normal">خطّ عادي</option>
              <option value="large">خطّ كبير</option>
            </Select>
            <Select value={block.dir ?? 'auto'} onChange={(e) => set({ dir: e.target.value })}>
              <option value="auto">الاتجاه تلقائي</option>
              <option value="rtl">عربي (يمين)</option>
              <option value="ltr">فرنسي (يسار)</option>
            </Select>
          </div>
        </div>
      )
    case 'EQUATION':
      return (
        <div className="space-y-2">
          <MathInput value={block.latex} onChange={(v) => set({ latex: v })} mode="latex" rows={3} previewDefault={false} autoFocus />
          <div className="grid grid-cols-2 gap-2">
            <Input value={block.label ?? ''} onChange={(e) => set({ label: e.target.value || undefined })} placeholder="رقم/اسم المعادلة (1)" dir="auto" />
            <Input value={block.caption ?? ''} onChange={(e) => set({ caption: e.target.value || undefined })} placeholder="تعليق تحت المعادلة" dir="auto" />
          </div>
        </div>
      )
    case 'GRAPH':
      return <GraphFields g={block.graph} onChange={(graph) => set({ graph })} caption={block.caption} setCaption={(c) => set({ caption: c || undefined })} />
    case 'GEOMETRY':
      return <GeometryFields f={block.figure} onChange={(figure) => set({ figure })} caption={block.caption} setCaption={(c) => set({ caption: c || undefined })} />
    case 'TABLE':
      return <TableFields block={block} set={set} />
    case 'VARIATION_TABLE':
      return <VariationFields t={block.table} onChange={(table) => set({ table })} />
    case 'POETRY':
      return <PoetryFields block={block} set={set} />
    case 'IMAGE':
      return <ImageFields block={block} set={set} onLocalAsset={onLocalAsset} />
    case 'ANSWER_SPACE':
      return (
        <div className="grid grid-cols-3 gap-2">
          <Field label="عدد الأسطر" htmlFor="as-lines">
            <Input id="as-lines" type="number" min={1} max={40} value={block.lines} onChange={(e) => set({ lines: Math.max(1, Math.min(40, Number(e.target.value) || 1)) })} dir="ltr" />
          </Field>
          <Field label="الشكل" htmlFor="as-style">
            <Select id="as-style" value={block.style ?? 'lines'} onChange={(e) => set({ style: e.target.value })}>
              <option value="lines">أسطر</option>
              <option value="blank">فراغ</option>
              <option value="grid">مربّعات</option>
              <option value="box">إطار</option>
            </Select>
          </Field>
          <Field label="تسمية" htmlFor="as-label">
            <Input id="as-label" value={block.label ?? ''} onChange={(e) => set({ label: e.target.value || undefined })} placeholder="الإجابة" />
          </Field>
        </div>
      )
    case 'SEPARATOR':
      return (
        <div className="grid grid-cols-2 gap-2">
          <Select value={block.style ?? 'line'} onChange={(e) => set({ style: e.target.value })}>
            <option value="line">خطّ</option>
            <option value="dots">نقاط</option>
            <option value="space">فراغ فقط</option>
          </Select>
          <Input type="number" min={1} max={40} value={block.size ?? (block.style === 'space' ? 6 : 4)} onChange={(e) => set({ size: Number(e.target.value) || 4 })} dir="ltr" placeholder="الحجم (مم)" />
        </div>
      )
    case 'NOTE':
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input value={block.title ?? ''} onChange={(e) => set({ title: e.target.value || undefined })} placeholder="عنوان (اختياري): ملاحظة" dir="auto" />
            <Select value={block.style ?? 'box'} onChange={(e) => set({ style: e.target.value })}>
              <option value="box">إطار</option>
              <option value="warning">تنبيه</option>
              <option value="quote">اقتباس</option>
              <option value="plain">بلا إطار</option>
            </Select>
          </div>
          <MathInput value={block.text} onChange={(v) => set({ text: v })} rows={3} previewDefault={false} autoFocus />
        </div>
      )
  }
}

function AlignSelect({ value, onChange, justify = false }: { value?: string; onChange: (v: string) => void; justify?: boolean }) {
  return (
    <Select value={value ?? 'start'} onChange={(e) => onChange(e.target.value)}>
      <option value="start">محاذاة البداية</option>
      <option value="center">توسيط</option>
      <option value="end">محاذاة النهاية</option>
      {justify ? <option value="justify">ضبط</option> : null}
    </Select>
  )
}

const num = (v: string, d: number) => (v.trim() === '' || Number.isNaN(Number(v)) ? d : Number(v))

/* ------------------------------- المنحنى ------------------------------- */

function GraphFields({ g, onChange, caption, setCaption }: { g: GraphDefinition; onChange: (g: GraphDefinition) => void; caption?: string; setCaption: (c: string) => void }) {
  const set = (p: Partial<GraphDefinition>) => onChange({ ...g, ...p })
  const errors = graphErrors(g)
  const setFn = (i: number, p: Partial<GraphDefinition['functions'][number]>) => set({ functions: g.functions.map((f, k) => (k === i ? { ...f, ...p } : f)) })
  return (
    <div className="space-y-2 text-sm">
      <div className="space-y-1">
        {g.functions.map((f, i) => (
          <div key={i} className="grid grid-cols-[1fr_90px_auto] items-center gap-1">
            <Input value={f.expr} onChange={(e) => setFn(i, { expr: e.target.value })} dir="ltr" className="font-mono" placeholder="x^2 - 2x + 1  أو  \frac{1}{x}" />
            <Input value={f.label ?? ''} onChange={(e) => setFn(i, { label: e.target.value || undefined })} dir="ltr" placeholder="(C_f)" />
            <div className="flex items-center gap-1">
              <label className="flex items-center gap-1 text-xs" title="متقطّع">
                <input type="checkbox" checked={Boolean(f.dashed)} onChange={(e) => setFn(i, { dashed: e.target.checked })} /> ---
              </label>
              <input type="color" value={f.color ?? ['#1b5e52', '#b3261e', '#1a4fa0', '#b8860b', '#6a1b9a', '#00695c'][i % 6]} onChange={(e) => setFn(i, { color: e.target.value })} className="size-7 cursor-pointer rounded border" title="اللون" />
              <Button type="button" size="sm" variant="ghost" onClick={() => set({ functions: g.functions.filter((_, k) => k !== i) })} disabled={g.functions.length <= 1} title="حذف">
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
        {g.functions.length < 6 ? (
          <Button type="button" size="sm" variant="outline" onClick={() => set({ functions: [...g.functions, { expr: 'x' }] })}>
            <Plus className="size-4" /> دالة أخرى
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{'المتغيّر x · دوال: sin cos tan exp ln log sqrt abs · ثوابت: pi e · يقبل LaTeX بسيطاً (\\frac، \\sqrt، e^{x}).'}</p>
      {errors.length ? <Alert tone="warning">{errors.join(' · ')}</Alert> : null}
      <div className="grid grid-cols-4 gap-1">
        {(['xMin', 'xMax', 'yMin', 'yMax'] as const).map((k) => (
          <Field key={k} label={k} htmlFor={`g-${k}`}>
            <Input id={`g-${k}`} type="number" step="0.5" value={g[k]} onChange={(e) => set({ [k]: num(e.target.value, g[k]) })} dir="ltr" />
          </Field>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1">
        <Field label="خطوة x" htmlFor="g-sx">
          <Input id="g-sx" type="number" step="0.5" min={0.1} value={g.stepX ?? ''} onChange={(e) => set({ stepX: e.target.value ? num(e.target.value, 1) : undefined })} dir="ltr" placeholder="تلقائي" />
        </Field>
        <Field label="خطوة y" htmlFor="g-sy">
          <Input id="g-sy" type="number" step="0.5" min={0.1} value={g.stepY ?? ''} onChange={(e) => set({ stepY: e.target.value ? num(e.target.value, 1) : undefined })} dir="ltr" placeholder="تلقائي" />
        </Field>
        <Field label="العرض (مم)" htmlFor="g-w">
          <Input id="g-w" type="number" min={40} max={180} value={g.width ?? 110} onChange={(e) => set({ width: Math.max(40, Math.min(180, num(e.target.value, 110))) })} dir="ltr" />
        </Field>
        <Field label="الارتفاع (مم)" htmlFor="g-h">
          <Input id="g-h" type="number" min={30} max={200} value={g.height ?? ''} onChange={(e) => set({ height: e.target.value ? Math.max(30, Math.min(200, num(e.target.value, 80))) : undefined })} dir="ltr" placeholder="نفس المقياس" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <Field label="مقاربات عمودية x =" htmlFor="g-va">
          <Input id="g-va" value={(g.verticalAsymptotes ?? []).join(', ')} onChange={(e) => set({ verticalAsymptotes: e.target.value.split(/[,، ]+/).filter((v) => v !== '').map(Number).filter(Number.isFinite).slice(0, 8) })} dir="ltr" placeholder="0, 2" />
        </Field>
        <Field label="مقاربات أفقية y =" htmlFor="g-ha">
          <Input id="g-ha" value={(g.horizontalAsymptotes ?? []).join(', ')} onChange={(e) => set({ horizontalAsymptotes: e.target.value.split(/[,، ]+/).filter((v) => v !== '').map(Number).filter(Number.isFinite).slice(0, 8) })} dir="ltr" placeholder="1" />
        </Field>
      </div>
      <PointsList points={g.points ?? []} onChange={(points) => set({ points })} />
      <div className="flex flex-wrap gap-3 text-xs">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={g.grid !== false} onChange={(e) => set({ grid: e.target.checked })} /> شبكة
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={g.frameLabels !== false} onChange={(e) => set({ frameLabels: e.target.checked })} /> O، i⃗، j⃗
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={g.showLegend !== false} onChange={(e) => set({ showLegend: e.target.checked })} /> مفتاح الرسم
        </label>
      </div>
      <Input value={caption ?? ''} onChange={(e) => setCaption(e.target.value)} placeholder="تعليق تحت الشكل (اختياري)" dir="auto" />
    </div>
  )
}

function PointsList({ points, onChange }: { points: { x: number; y: number; label?: string }[]; onChange: (p: { x: number; y: number; label?: string }[]) => void }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold">نقاط مميّزة</p>
      {points.map((p, i) => (
        <div key={i} className="grid grid-cols-[70px_70px_1fr_auto] gap-1">
          <Input type="number" step="0.5" value={p.x} onChange={(e) => onChange(points.map((q, k) => (k === i ? { ...q, x: num(e.target.value, 0) } : q)))} dir="ltr" />
          <Input type="number" step="0.5" value={p.y} onChange={(e) => onChange(points.map((q, k) => (k === i ? { ...q, y: num(e.target.value, 0) } : q)))} dir="ltr" />
          <Input value={p.label ?? ''} onChange={(e) => onChange(points.map((q, k) => (k === i ? { ...q, label: e.target.value || undefined } : q)))} dir="ltr" placeholder="A" />
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(points.filter((_, k) => k !== i))}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      {points.length < 30 ? (
        <Button type="button" size="sm" variant="ghost" onClick={() => onChange([...points, { x: 0, y: 0, label: String.fromCharCode(65 + points.length) }])}>
          <Plus className="size-4" /> نقطة
        </Button>
      ) : null}
    </div>
  )
}

/* ------------------------------- الهندسة ------------------------------- */

function GeometryFields({ f, onChange, caption, setCaption }: { f: GeometryDefinition; onChange: (f: GeometryDefinition) => void; caption?: string; setCaption: (c: string) => void }) {
  const set = (p: Partial<GeometryDefinition>) => onChange({ ...f, ...p })
  const ids = f.points.map((p) => p.id)
  const nextId = () => {
    for (let i = 0; i < 26; i++) {
      const c = String.fromCharCode(65 + i)
      if (!ids.includes(c)) return c
    }
    return `P${ids.length}`
  }
  return (
    <div className="space-y-2 text-sm">
      <div className="space-y-1">
        <p className="text-xs font-semibold">النقاط (الاسم، x، y)</p>
        {f.points.map((p, i) => (
          <div key={i} className="grid grid-cols-[60px_70px_70px_auto] gap-1">
            <Input value={p.id} onChange={(e) => set({ points: f.points.map((q, k) => (k === i ? { ...q, id: e.target.value.slice(0, 12) } : q)) })} dir="ltr" />
            <Input type="number" step="0.5" value={p.x} onChange={(e) => set({ points: f.points.map((q, k) => (k === i ? { ...q, x: num(e.target.value, 0) } : q)) })} dir="ltr" />
            <Input type="number" step="0.5" value={p.y} onChange={(e) => set({ points: f.points.map((q, k) => (k === i ? { ...q, y: num(e.target.value, 0) } : q)) })} dir="ltr" />
            <Button type="button" size="sm" variant="ghost" onClick={() => set({ points: f.points.filter((_, k) => k !== i) })}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button type="button" size="sm" variant="ghost" onClick={() => set({ points: [...f.points, { id: nextId(), x: 1, y: 1 }] })}>
          <Plus className="size-4" /> نقطة
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs font-semibold">القطع [AB]</p>
          {(f.segments ?? []).map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-1">
              <PointSelect ids={ids} value={s.from} onChange={(v) => set({ segments: f.segments!.map((x, k) => (k === i ? { ...x, from: v } : x)) })} />
              <PointSelect ids={ids} value={s.to} onChange={(v) => set({ segments: f.segments!.map((x, k) => (k === i ? { ...x, to: v } : x)) })} />
              <label className="text-xs" title="متقطّع">
                <input type="checkbox" checked={Boolean(s.dashed)} onChange={(e) => set({ segments: f.segments!.map((x, k) => (k === i ? { ...x, dashed: e.target.checked } : x)) })} /> ---
              </label>
              <Button type="button" size="sm" variant="ghost" onClick={() => set({ segments: f.segments!.filter((_, k) => k !== i) })}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="ghost" onClick={() => set({ segments: [...(f.segments ?? []), { from: ids[0] ?? 'A', to: ids[1] ?? 'B' }] })} disabled={ids.length < 2}>
            <Plus className="size-4" /> قطعة
          </Button>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold">الدوائر (المركز، نصف القطر)</p>
          {(f.circles ?? []).map((c, i) => (
            <div key={i} className="grid grid-cols-[1fr_70px_auto] items-center gap-1">
              <PointSelect ids={ids} value={c.center} onChange={(v) => set({ circles: f.circles!.map((x, k) => (k === i ? { ...x, center: v } : x)) })} />
              <Input type="number" step="0.5" min={0.1} value={c.radius} onChange={(e) => set({ circles: f.circles!.map((x, k) => (k === i ? { ...x, radius: Math.max(0.1, num(e.target.value, 1)) } : x)) })} dir="ltr" />
              <Button type="button" size="sm" variant="ghost" onClick={() => set({ circles: f.circles!.filter((_, k) => k !== i) })}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="ghost" onClick={() => set({ circles: [...(f.circles ?? []), { center: ids[0] ?? 'A', radius: 1 }] })} disabled={ids.length < 1}>
            <Plus className="size-4" /> دائرة
          </Button>
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold">مضلّعات (أسماء النقاط مفصولة بمسافة) · زوايا قائمة (الرأس، الطرفان)</p>
        {(f.polygons ?? []).map((p, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto_auto] items-center gap-1">
            <Input value={p.points.join(' ')} onChange={(e) => set({ polygons: f.polygons!.map((x, k) => (k === i ? { ...x, points: e.target.value.split(/[\s,،]+/).filter(Boolean).slice(0, 20) } : x)) })} dir="ltr" placeholder="A B C D" />
            <label className="text-xs">
              <input type="checkbox" checked={Boolean(p.fill)} onChange={(e) => set({ polygons: f.polygons!.map((x, k) => (k === i ? { ...x, fill: e.target.checked } : x)) })} /> تظليل
            </label>
            <Button type="button" size="sm" variant="ghost" onClick={() => set({ polygons: f.polygons!.filter((_, k) => k !== i) })}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        {(f.rightAngles ?? []).map((r, i) => (
          <div key={`r${i}`} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-1">
            <PointSelect ids={ids} value={r.at} onChange={(v) => set({ rightAngles: f.rightAngles!.map((x, k) => (k === i ? { ...x, at: v } : x)) })} />
            <PointSelect ids={ids} value={r.from} onChange={(v) => set({ rightAngles: f.rightAngles!.map((x, k) => (k === i ? { ...x, from: v } : x)) })} />
            <PointSelect ids={ids} value={r.to} onChange={(v) => set({ rightAngles: f.rightAngles!.map((x, k) => (k === i ? { ...x, to: v } : x)) })} />
            <Button type="button" size="sm" variant="ghost" onClick={() => set({ rightAngles: f.rightAngles!.filter((_, k) => k !== i) })}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <div className="flex gap-1">
          <Button type="button" size="sm" variant="ghost" onClick={() => set({ polygons: [...(f.polygons ?? []), { points: ids.slice(0, 3) }] })} disabled={ids.length < 3}>
            <Plus className="size-4" /> مضلّع
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => set({ rightAngles: [...(f.rightAngles ?? []), { at: ids[1] ?? 'B', from: ids[0] ?? 'A', to: ids[2] ?? 'C' }] })} disabled={ids.length < 3}>
            <Plus className="size-4" /> زاوية قائمة
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {(['xMin', 'xMax', 'yMin', 'yMax'] as const).map((k) => (
          <Field key={k} label={k} htmlFor={`geo-${k}`}>
            <Input id={`geo-${k}`} type="number" step="0.5" value={f[k]} onChange={(e) => set({ [k]: num(e.target.value, f[k]) })} dir="ltr" />
          </Field>
        ))}
        <Field label="العرض (مم)" htmlFor="geo-w">
          <Input id="geo-w" type="number" min={40} max={180} value={f.width ?? 90} onChange={(e) => set({ width: Math.max(40, Math.min(180, num(e.target.value, 90))) })} dir="ltr" />
        </Field>
      </div>
      <div className="flex gap-3 text-xs">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={Boolean(f.grid)} onChange={(e) => set({ grid: e.target.checked })} /> شبكة
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={Boolean(f.axes)} onChange={(e) => set({ axes: e.target.checked })} /> محاور
        </label>
      </div>
      <Input value={caption ?? ''} onChange={(e) => setCaption(e.target.value)} placeholder="تعليق تحت الشكل (اختياري)" dir="auto" />
    </div>
  )
}

function PointSelect({ ids, value, onChange }: { ids: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} dir="ltr">
      {!ids.includes(value) ? <option value={value}>{value}?</option> : null}
      {ids.map((id) => (
        <option key={id} value={id}>
          {id}
        </option>
      ))}
    </Select>
  )
}

/* -------------------------------- الجدول -------------------------------- */

function TableFields({ block, set }: { block: Extract<StudioBlock, { type: 'TABLE' }>; set: Patch<Record<string, unknown>> }) {
  const rows = block.rows
  const cols = Math.max(...rows.map((r) => r.length))
  const setCell = (r: number, c: number, v: string) => set({ rows: rows.map((row, i) => (i === r ? Array.from({ length: cols }, (_, k) => (k === c ? v : (row[k] ?? ''))) : row)) })
  return (
    <div className="space-y-2 text-sm">
      <div className="overflow-auto">
        <table className="border-collapse">
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {Array.from({ length: cols }, (_, c) => (
                  <td key={c} className="p-0.5">
                    <Input value={row[c] ?? ''} onChange={(e) => setCell(r, c, e.target.value)} dir="auto" className={`h-8 min-w-[6rem] text-center ${(block.headerRow && r === 0) || (block.headerCol && c === 0) ? 'font-bold' : ''}`} />
                  </td>
                ))}
                <td className="p-0.5">
                  <Button type="button" size="sm" variant="ghost" onClick={() => set({ rows: rows.filter((_, i) => i !== r) })} disabled={rows.length <= 1} title="حذف الصفّ">
                    <Minus className="size-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-1">
        <Button type="button" size="sm" variant="outline" onClick={() => set({ rows: [...rows, Array.from({ length: cols }, () => '')] })} disabled={rows.length >= 40}>
          <Plus className="size-4" /> صفّ
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => set({ rows: rows.map((r) => [...Array.from({ length: cols }, (_, k) => r[k] ?? ''), '']) })} disabled={cols >= 12}>
          <Plus className="size-4" /> عمود
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => set({ rows: rows.map((r) => r.slice(0, cols - 1)) })} disabled={cols <= 1}>
          <Minus className="size-4" /> عمود
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={Boolean(block.headerRow)} onChange={(e) => set({ headerRow: e.target.checked })} /> صفّ عناوين
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={Boolean(block.headerCol)} onChange={(e) => set({ headerCol: e.target.checked })} /> عمود عناوين
        </label>
        <Select value={block.borders ?? 'all'} onChange={(e) => set({ borders: e.target.value })} className="h-8 w-auto">
          <option value="all">حدود كاملة</option>
          <option value="outer">إطار فقط</option>
          <option value="none">بلا حدود</option>
        </Select>
        <Select value={String(block.width ?? '')} onChange={(e) => set({ width: e.target.value ? Number(e.target.value) : undefined })} className="h-8 w-auto">
          <option value="">عرض تلقائي</option>
          <option value="50">50%</option>
          <option value="75">75%</option>
          <option value="100">100%</option>
        </Select>
        <AlignSelect value={block.align ?? 'center'} onChange={(v) => set({ align: v })} />
      </div>
      <Input value={block.caption ?? ''} onChange={(e) => set({ caption: e.target.value || undefined })} placeholder="عنوان الجدول (اختياري)" dir="auto" />
      <p className="text-xs text-muted-foreground">الخلايا تقبل المعادلات بين $…$.</p>
    </div>
  )
}

/* ---------------------------- جدول التغيّرات ---------------------------- */

function VariationFields({ t, onChange }: { t: VariationTable; onChange: (t: VariationTable) => void }) {
  const n = t.xs.length
  const set = (p: Partial<VariationTable>) => onChange({ ...t, ...p })
  const sign = t.sign ?? { label: "f'(x)", signs: Array.from({ length: n - 1 }, () => '' as const), marks: Array.from({ length: n }, () => '') }
  const pad = <T,>(arr: T[], len: number, fill: T): T[] => Array.from({ length: len }, (_, i) => arr[i] ?? fill)
  const setXs = (xs: string[]) => {
    const m = xs.length
    onChange({ ...t, xs, sign: t.sign ? { ...t.sign, signs: pad(t.sign.signs, m - 1, ''), marks: pad(t.sign.marks ?? [], m, '') } : undefined, variation: { ...t.variation, values: pad(t.variation.values, m, ''), arrows: pad(t.variation.arrows, m - 1, '') } })
  }
  return (
    <div className="space-y-2 text-sm" dir="ltr">
      <div className="grid gap-1" style={{ gridTemplateColumns: `90px repeat(${n}, minmax(0, 1fr))` }}>
        <Input value={t.variable ?? 'x'} onChange={(e) => set({ variable: e.target.value })} className="h-8 font-mono" />
        {t.xs.map((x, i) => (
          <div key={i} className="flex gap-0.5">
            <Input value={x} onChange={(e) => setXs(t.xs.map((v, k) => (k === i ? e.target.value : v)))} className="h-8 font-mono" placeholder={i === 0 ? '-\\infty' : i === n - 1 ? '+\\infty' : '0'} />
            {n > 2 ? (
              <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => setXs(t.xs.filter((_, k) => k !== i))} title="حذف الحدّ">
                ×
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <Button type="button" size="sm" variant="ghost" onClick={() => setXs([...t.xs.slice(0, -1), '', t.xs[n - 1]!])} disabled={n >= 10}>
        <Plus className="size-4" /> حدّ
      </Button>
      <label className="flex items-center gap-1 text-xs" dir="rtl">
        <input type="checkbox" checked={Boolean(t.sign)} onChange={(e) => set({ sign: e.target.checked ? sign : undefined })} /> صفّ إشارة المشتقّة
      </label>
      {t.sign ? (
        <div className="grid gap-1" style={{ gridTemplateColumns: `90px repeat(${2 * n - 1}, minmax(0, 1fr))` }}>
          <Input value={sign.label ?? ''} onChange={(e) => set({ sign: { ...sign, label: e.target.value } })} className="h-8 font-mono" placeholder="f'(x)" />
          {Array.from({ length: 2 * n - 1 }, (_, k) => {
            if (k % 2 === 0) {
              const i = k / 2
              return (
                <Select key={k} value={sign.marks?.[i] ?? ''} onChange={(e) => set({ sign: { ...sign, marks: pad(sign.marks ?? [], n, '').map((m, j) => (j === i ? e.target.value : m)) } })} className="h-8 text-center">
                  <option value=""> </option>
                  <option value="0">0</option>
                  <option value="||">‖</option>
                </Select>
              )
            }
            const i = (k - 1) / 2
            return (
              <Select key={k} value={sign.signs[i] ?? ''} onChange={(e) => set({ sign: { ...sign, signs: pad(sign.signs, n - 1, '' as const).map((s, j) => (j === i ? (e.target.value as '+' | '-' | '') : s)) } })} className="h-8 text-center font-bold">
                <option value=""> </option>
                <option value="+">+</option>
                <option value="-">−</option>
              </Select>
            )
          })}
        </div>
      ) : null}
      <div className="grid gap-1" style={{ gridTemplateColumns: `90px repeat(${2 * n - 1}, minmax(0, 1fr))` }}>
        <Input value={t.variation.label ?? ''} onChange={(e) => set({ variation: { ...t.variation, label: e.target.value } })} className="h-8 font-mono" placeholder="f(x)" />
        {Array.from({ length: 2 * n - 1 }, (_, k) => {
          if (k % 2 === 0) {
            const i = k / 2
            return <Input key={k} value={t.variation.values[i] ?? ''} onChange={(e) => set({ variation: { ...t.variation, values: pad(t.variation.values, n, '').map((v, j) => (j === i ? e.target.value : v)) } })} className="h-8 font-mono" placeholder="قيمة" />
          }
          const i = (k - 1) / 2
          return (
            <Select key={k} value={t.variation.arrows[i] ?? ''} onChange={(e) => set({ variation: { ...t.variation, arrows: pad(t.variation.arrows, n - 1, '' as const).map((a, j) => (j === i ? (e.target.value as 'up' | 'down' | 'flat' | '') : a)) } })} className="h-8 text-center">
              <option value=""> </option>
              <option value="up">↗</option>
              <option value="down">↘</option>
              <option value="flat">→</option>
            </Select>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground" dir="rtl">
        {'الحدود والقيم تقبل LaTeX: -\\infty، +\\infty، \\frac{1}{e}.'}
      </p>
    </div>
  )
}

/* -------------------------------- الشعر -------------------------------- */

function PoetryFields({ block, set }: { block: Extract<StudioBlock, { type: 'POETRY' }>; set: Patch<Record<string, unknown>> }) {
  const verses = block.verses
  return (
    <div className="space-y-2 text-sm">
      <div className="grid grid-cols-3 gap-1">
        <Input value={block.poet ?? ''} onChange={(e) => set({ poet: e.target.value || undefined })} placeholder="الشاعر" />
        <Input value={block.title ?? ''} onChange={(e) => set({ title: e.target.value || undefined })} placeholder="عنوان القصيدة" />
        <Input value={block.meter ?? ''} onChange={(e) => set({ meter: e.target.value || undefined })} placeholder="البحر (اختياري)" />
      </div>
      <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-1 text-xs font-semibold text-muted-foreground">
        <span className="w-5" />
        <span>الصدر</span>
        <span>العجز</span>
        <span />
      </div>
      {verses.map((v, i) => (
        <div key={i} className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-1">
          <span className="w-5 text-xs text-muted-foreground">{i + 1}</span>
          <Input value={v.sadr} onChange={(e) => set({ verses: verses.map((x, k) => (k === i ? { ...x, sadr: e.target.value } : x)) })} className="font-serif" />
          <Input value={v.ajz} onChange={(e) => set({ verses: verses.map((x, k) => (k === i ? { ...x, ajz: e.target.value } : x)) })} className="font-serif" />
          <Button type="button" size="sm" variant="ghost" onClick={() => set({ verses: verses.filter((_, k) => k !== i) })} disabled={verses.length <= 1} title="حذف البيت">
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => set({ verses: [...verses, { sadr: '', ajz: '' }] })} disabled={verses.length >= 60}>
        <Plus className="size-4" /> بيت
      </Button>
      <Input value={block.source ?? ''} onChange={(e) => set({ source: e.target.value || undefined })} placeholder="المصدر: الديوان، الصفحة… (اختياري)" />
      <MathInput value={block.notes ?? ''} onChange={(v) => set({ notes: v || undefined })} rows={2} placeholder="شرح المفردات (اختياري): **الفِجاج:** الطرق الواسعة…" previewDefault={false} />
    </div>
  )
}

/* -------------------------------- الصورة -------------------------------- */

function ImageFields({ block, set, onLocalAsset }: { block: Extract<StudioBlock, { type: 'IMAGE' }>; set: Patch<Record<string, unknown>>; onLocalAsset: (id: string, url: string) => void }) {
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const pick = async (file: File | undefined) => {
    if (!file) return
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast('error', 'الصيغ المقبولة: jpg، png، webp')
    setBusy(true)
    try {
      const up = await uploadViaTicket(file)
      onLocalAsset(up.id, URL.createObjectURL(file))
      set({ fileId: up.id, alt: block.alt ?? file.name.replace(/\.[^.]+$/, '') })
      toast('success', 'رُفعت الصورة')
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'تعذّر الرفع')
    } finally {
      setBusy(false)
    }
  }
  const placeholder = block.fileId === '00000000-0000-4000-8000-000000000000'
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
        <Button type="button" size="sm" variant="outline" loading={busy} onClick={() => inputRef.current?.click()}>
          <Upload className="size-4" /> {placeholder ? 'اختر صورة' : 'استبدال الصورة'}
        </Button>
        {placeholder ? <span className="text-xs text-warning">لم تُرفع صورة بعد</span> : null}
      </div>
      <div className="grid grid-cols-3 gap-1">
        <Field label="العرض %" htmlFor="img-w">
          <Input id="img-w" type="number" min={10} max={100} value={block.widthPercent ?? 60} onChange={(e) => set({ widthPercent: Math.max(10, Math.min(100, num(e.target.value, 60))) })} dir="ltr" />
        </Field>
        <Field label="المحاذاة" htmlFor="img-a">
          <AlignSelect value={block.align ?? 'center'} onChange={(v) => set({ align: v })} />
        </Field>
        <Field label="وصف بديل" htmlFor="img-alt">
          <Input id="img-alt" value={block.alt ?? ''} onChange={(e) => set({ alt: e.target.value || undefined })} />
        </Field>
      </div>
      <Input value={block.caption ?? ''} onChange={(e) => set({ caption: e.target.value || undefined })} placeholder="تعليق تحت الصورة (اختياري)" dir="auto" />
    </div>
  )
}
