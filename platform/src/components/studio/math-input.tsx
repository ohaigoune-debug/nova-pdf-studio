'use client'

import { Eye, EyeOff, Sigma } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const RichText = dynamic(() => import('./block-view').then((m) => m.RichText), { ssr: false })

/** لوحة LaTeX: [التسمية، المقتطف، إزاحة المؤشّر من آخر المقتطف] */
const PALETTE: { group: string; items: [string, string, number][] }[] = [
  { group: 'أساسي', items: [['كسر', '\\frac{a}{b}', 0], ['جذر', '\\sqrt{x}', 1], ['أسّ', 'x^{n}', 1], ['مؤشّر', 'u_{n}', 1], ['قيمة مطلقة', '\\left| x \\right|', 0], ['أقواس', '\\left( x \\right)', 0]] },
  { group: 'تحليل', items: [['نهاية', '\\lim_{x \\to +\\infty}', 0], ['مشتقّة', "f'(x)", 0], ['تكامل', '\\int_{a}^{b} f(x)\\,dx', 0], ['مجموع', '\\sum_{k=0}^{n}', 0], ['ln', '\\ln(x)', 1], ['e^x', 'e^{x}', 1], ['∞', '\\infty', 0]] },
  { group: 'رموز', items: [['ℝ', '\\mathbb{R}', 0], ['ℕ', '\\mathbb{N}', 0], ['ℤ', '\\mathbb{Z}', 0], ['ℂ', '\\mathbb{C}', 0], ['∈', '\\in', 0], ['≤', '\\leq', 0], ['≥', '\\geq', 0], ['≠', '\\neq', 0], ['×', '\\times', 0], ['±', '\\pm', 0], ['→', '\\to', 0], ['⇔', '\\Leftrightarrow', 0]] },
  { group: 'هندسة وأشعة', items: [['شعاع', '\\vec{u}', 0], ['AB⃗', '\\overrightarrow{AB}', 0], ['مرافق', '\\overline{z}', 0], ['زاوية', '\\widehat{ABC}', 0], ['π', '\\pi', 0], ['θ', '\\theta', 0], ['α', '\\alpha', 0], ['Δ', '\\Delta', 0]] },
  { group: 'مجالات وأنظمة', items: [[']a;b[', '\\left] a ; b \\right[', 0], ['[a;b]', '\\left[ a ; b \\right]', 0], ['نظام', '\\begin{cases} x + y = 1 \\\\ x - y = 3 \\end{cases}', 0], ['مصفوفة', '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', 0]] }
]

/**
 * حقل نصّ بشريط رياضيات ومعاينة حيّة.
 * mode=text: نصّ عادي والمعادلات بين $…$ (المقتطف يُدرج بين $). mode=latex: المحتوى كله LaTeX.
 */
export function MathInput({ value, onChange, mode = 'text', rows = 4, placeholder, id, className, autoFocus, previewDefault = true }: { value: string; onChange: (v: string) => void; mode?: 'text' | 'latex'; rows?: number; placeholder?: string; id?: string; className?: string; autoFocus?: boolean; previewDefault?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [palette, setPalette] = useState(false)
  const [preview, setPreview] = useState(previewDefault)
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), 250)
    return () => clearTimeout(t)
  }, [value])
  const insert = (snippet: string, back: number) => {
    const el = ref.current
    const text = mode === 'text' ? `$${snippet}$` : snippet
    if (!el) return onChange(value + text)
    const start = el.selectionStart ?? value.length
    const end = el.selectionEnd ?? start
    const next = value.slice(0, start) + text + value.slice(end)
    onChange(next)
    const pos = start + text.length - back - (mode === 'text' ? 1 : 0)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(pos, pos)
    })
  }
  const hasMath = mode === 'latex' || /\$[^$]+\$|\*\*/.test(debounced)
  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex flex-wrap items-center gap-1 text-xs">
        <Button type="button" size="sm" variant={palette ? 'default' : 'outline'} className="h-7 px-2" onClick={() => setPalette((v) => !v)} title="رموز ومعادلات">
          <Sigma className="size-3.5" /> رياضيات
        </Button>
        {mode === 'text' ? <span className="text-muted-foreground">المعادلات بين $…$ · **غامق** · سطر فارغ = فقرة</span> : <span className="text-muted-foreground">LaTeX (KaTeX)</span>}
        <Button type="button" size="sm" variant="ghost" className="ms-auto h-7 px-2" onClick={() => setPreview((v) => !v)} title="معاينة">
          {preview ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </Button>
      </div>
      {palette ? (
        <div className="rounded-lg border bg-muted/40 p-2 text-xs">
          {PALETTE.map((g) => (
            <div key={g.group} className="mb-1 flex flex-wrap items-center gap-1">
              <span className="w-24 shrink-0 text-muted-foreground">{g.group}</span>
              {g.items.map(([label, snippet, back]) => (
                <button key={label} type="button" onClick={() => insert(snippet, back)} className="rounded border bg-background px-1.5 py-0.5 font-mono hover:border-primary" dir="ltr" title={snippet}>
                  {label}
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}
      <Textarea ref={ref} id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} dir={mode === 'latex' ? 'ltr' : 'auto'} className={mode === 'latex' ? 'font-mono text-sm' : undefined} autoFocus={autoFocus} />
      {preview && hasMath && debounced.trim() ? (
        <div className="studio-paper rounded-lg border border-dashed bg-background p-2 text-sm" dir={mode === 'latex' ? 'ltr' : 'rtl'}>
          <RichText text={mode === 'latex' ? `$$${debounced}$$` : debounced} />
        </div>
      ) : null}
    </div>
  )
}
