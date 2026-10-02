'use client'

import { AlertTriangle, FileCheck2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ExamPrint } from '@/components/domain/exam-print'
import { Alert } from '@/components/ui/misc'
import { resolveLayout } from '@/lib/exam-blocks'
import { paginate, type MeasuredBlock } from '@/lib/paginate'
import type { ExamView } from '@/server/services/exams.service'

const A4_HEIGHT = 297

/**
 * معاينة A4 حيّة بنفس مصيّر الطباعة: تقيس ارتفاع الترويسة وكل عنصر فتقدّر الصفحات وتعلّم التجاوزات،
 * وترسم حدود الصفحات فوق الورقة. تقدير قريب من طابعة المتصفح (التي تقسم الكتل الطويلة وحدها).
 */
export function A4Preview({ exam, mode = 'subject' }: { exam: ExamView; mode?: 'subject' | 'correction' | 'marking' }) {
  const ref = useRef<HTMLDivElement>(null)
  const [info, setInfo] = useState<{ pages: number; marks: { top: number; n: number }[]; overflow: string[]; pushed: string[] } | null>(null)
  const L = resolveLayout(exam.layout)
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const measure = () => {
      const sheet = root.querySelector<HTMLElement>('.sheet')
      if (!sheet) return
      const ruler = root.querySelector<HTMLElement>('.mm-ruler')
      const pxPerMm = ruler ? ruler.getBoundingClientRect().height / 100 : 3.78
      const sheetTop = sheet.getBoundingClientRect().top
      const toMm = (px: number) => px / pxPerMm
      const nodes: { el: HTMLElement; id: string; label?: string; forceBreak?: boolean }[] = []
      const head = sheet.querySelector<HTMLElement>('.head')
      if (head) nodes.push({ el: head, id: 'head', label: 'الترويسة' })
      sheet.querySelectorAll<HTMLElement>(':scope > .bareme-summary, :scope > .marking, :scope > .items > li, :scope > footer').forEach((el, i) => {
        const id = el.id || `n${i}`
        el.dataset.pv = id
        const isBreak = el.classList.contains('page-break')
        const label = el.querySelector('h2 span')?.textContent ?? el.querySelector('.blk-heading')?.textContent?.slice(0, 30) ?? undefined
        nodes.push({ el, id, label: label ?? undefined, forceBreak: isBreak })
      })
      const blocks: MeasuredBlock[] = nodes.map((n) => {
        const r = n.el.getBoundingClientRect()
        const style = getComputedStyle(n.el)
        return { id: n.id, height: toMm(r.height + parseFloat(style.marginTop) + parseFloat(style.marginBottom)), forceBreak: n.forceBreak, label: n.label }
      })
      const pageH = A4_HEIGHT - L.margins.top - L.margins.bottom
      const r = paginate(blocks, pageH)
      // علامات حدود الصفحات: أعلى أول عنصر في كل صفحة بعد الأولى
      const marks: { top: number; n: number }[] = []
      r.pages.slice(1).forEach((p, i) => {
        const first = p.ids[0]
        const node = first ? nodes.find((n) => n.id === first) : null
        if (node) marks.push({ top: node.el.getBoundingClientRect().top - sheetTop, n: i + 2 })
      })
      setInfo({ pages: r.pages.filter((p) => p.ids.length).length || 1, marks, overflow: r.overflow.map((o) => `${o.label ?? 'عنصر'} (${Math.round(o.height)} مم) أطول من صفحة: ستقسمه الطابعة`), pushed: r.pushed.map((p) => `${p.label ?? 'عنصر'} نزل إلى صفحة جديدة وترك ${p.gapLeft} مم فارغة قبله`) })
    }
    const t = setTimeout(measure, 150)
    const ro = new ResizeObserver(() => measure())
    ro.observe(root)
    return () => {
      clearTimeout(t)
      ro.disconnect()
    }
  }, [exam, mode, L.margins.top, L.margins.bottom])
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5">
          <FileCheck2 className="size-3.5 text-primary" /> تقدير: {info?.pages ?? '…'} صفحة A4
        </span>
        <span className="text-muted-foreground">نفس مصيّر الطباعة؛ الحدود المتقطّعة تقدير قبل الطباعة.</span>
      </div>
      {info?.overflow.map((w) => (
        <Alert key={w} tone="warning" className="text-xs">
          <AlertTriangle className="me-1 inline size-3.5" /> {w}
        </Alert>
      ))}
      {info?.pushed.map((w) => (
        <Alert key={w} tone="info" className="text-xs">
          {w} — فكّر في فاصل صفحة أو تقصير ما قبله.
        </Alert>
      ))}
      <div ref={ref} className="relative overflow-auto rounded-xl bg-neutral-200 p-2 dark:bg-neutral-800" dir="rtl">
        <div className="mm-ruler pointer-events-none absolute h-[100mm] w-0 opacity-0" aria-hidden />
        <div className="relative mx-auto bg-white" style={{ width: '210mm' }}>
          <ExamPrint exam={exam} mode={mode} />
          {info?.marks.map((m) => (
            <div key={m.n} className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-primary/60" style={{ top: m.top - 4 }}>
              <span className="absolute -top-2.5 end-2 rounded bg-primary px-1.5 text-[10px] text-primary-foreground">صفحة {m.n}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
