/** إدارة الصفحات: مصغرات، تحديد متعدد، تدوير (مجاني)، حذف/استخراج/نقل (Pro). */
import clsx from 'clsx'
import { CheckCircle2, Circle, FileOutput, MoveLeft, MoveRight, RotateCw, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PdfEngine } from '@modules/pdf/renderer/pdfEngine'
import { deletePages, extractPages, reorderPages, rotatePages } from '@modules/pdf/shared/pdfTools'
import { usePro } from '../../stores/proInstance'
import { Sheet, errorText, toast } from '../../ui/overlays'
import { useIsRtl } from '../../ui/kit'

function PageThumb({ engine, index, selected, onToggle, onOpen }: { engine: PdfEngine; index: number; selected: boolean; onToggle: () => void; onOpen: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let cancel: (() => void) | undefined
    void engine.pageInfo(index).then(async (info) => {
      if (!ref.current) return
      const task = await engine.render(index, ref.current, 150 / info.widthPt)
      cancel = task.cancel
    })
    return () => cancel?.()
  }, [engine, index])
  return (
    <div className="flex flex-col items-center gap-1">
      <button onClick={onOpen} className={clsx('pdf-page relative overflow-hidden rounded-[4px]', selected && 'ring-[3px] ring-accent')}>
        <canvas ref={ref} />
      </button>
      <button onClick={onToggle} className="flex items-center gap-1 text-[13px] tabular">
        {selected ? <CheckCircle2 className="h-5 w-5 text-accent" /> : <Circle className="h-5 w-5 text-muted" />}
        {index + 1}
      </button>
    </div>
  )
}

export function PagesSheet({ open, onClose, engine, bytes, onApply, onExtract, onOpenPage, blocked }: {
  open: boolean
  onClose: () => void
  engine: PdfEngine
  bytes: Uint8Array
  onApply: (bytes: Uint8Array) => Promise<void>
  onExtract: (bytes: Uint8Array) => Promise<void>
  onOpenPage: (index: number) => void
  blocked: boolean
}) {
  const { t } = useTranslation()
  const rtl = useIsRtl()
  const [sel, setSel] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  useEffect(() => setSel([]), [open, engine])
  const count = engine.pageCount
  const toggle = (i: number) => setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i].sort((a, b) => a - b)))
  const guard = (feature: 'deletePages' | 'extract' | 'reorder') => usePro.getState().require(feature)
  const act = async (fn: () => Promise<void>) => {
    if (blocked) {
      toast(t('ios.viewer.unsaved'), 'info')
      return
    }
    setBusy(true)
    try {
      await fn()
      toast(t('ios.pages.applied'))
    } catch (e) {
      toast(errorText(e, t), 'error')
    } finally {
      setBusy(false)
    }
  }
  const move = (dir: -1 | 1) => act(async () => {
    if (!guard('reorder')) return
    const order = Array.from({ length: count }, (_, i) => i)
    const moving = dir < 0 ? sel : [...sel].reverse()
    for (const i of moving) {
      const pos = order.indexOf(i)
      const target = pos + dir
      if (target < 0 || target >= count || sel.includes(order[target])) continue
      ;[order[pos], order[target]] = [order[target], order[pos]]
    }
    await onApply(await reorderPages(bytes, order))
    setSel(sel.map((i) => Math.min(count - 1, Math.max(0, i + dir))))
  })
  return (
    <Sheet open={open} onClose={onClose} full title={t('ios.pages.title')} leading={sel.length ? <span className="text-[13px] text-muted">{t('ios.pages.selected', { count: sel.length })}</span> : undefined} trailing={<button className="font-semibold text-accent" onClick={onClose}>{t('ios.common.done')}</button>}>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-4 px-4 pb-28">
        {Array.from({ length: count }, (_, i) => (
          <PageThumb key={`${i}-${bytes.length}`} engine={engine} index={i} selected={sel.includes(i)} onToggle={() => toggle(i)} onOpen={() => { onOpenPage(i); onClose() }} />
        ))}
      </div>
      <div className="glass fixed inset-x-0 bottom-0 flex justify-around border-t hairline px-2 py-2 md:absolute" style={{ paddingBottom: 'calc(var(--safe-bottom) + 6px)' }}>
        {[
          { icon: <RotateCw className="h-6 w-6" />, label: t('ios.pages.rotate'), on: () => act(async () => onApply(await rotatePages(bytes, sel, 90))) },
          { icon: rtl ? <MoveRight className="h-6 w-6" /> : <MoveLeft className="h-6 w-6" />, label: t('ios.pages.moveBack'), on: () => move(-1) },
          { icon: rtl ? <MoveLeft className="h-6 w-6" /> : <MoveRight className="h-6 w-6" />, label: t('ios.pages.moveForward'), on: () => move(1) },
          { icon: <FileOutput className="h-6 w-6" />, label: t('ios.pages.extract'), on: () => act(async () => { if (guard('extract')) await onExtract(await extractPages(bytes, sel)) }) },
          { icon: <Trash2 className="h-6 w-6" />, label: t('ios.pages.delete'), danger: true, on: () => act(async () => { if (guard('deletePages')) { await onApply(await deletePages(bytes, sel)); setSel([]) } }) }
        ].map((b) => (
          <button key={b.label} disabled={!sel.length || busy} onClick={() => void b.on()} className={clsx('flex flex-col items-center gap-0.5 px-2 text-[11px] font-medium disabled:opacity-30', b.danger ? 'text-danger' : 'text-accent')}>
            {b.icon}
            {b.label}
          </button>
        ))}
      </div>
    </Sheet>
  )
}
