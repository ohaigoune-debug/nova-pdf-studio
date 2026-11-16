/** شريط أدوات التحرير السفلي (مناسب للإبهام) + لوحة الخيارات (اللون/الحجم) للأداة المختارة. */
import clsx from 'clsx'
import { Eraser, Highlighter, ImagePlus, MessageSquarePlus, MousePointer2, PenLine, Redo2, Signature, Square, Trash2, Type, Undo2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { PALETTE, type Tool, useEditor } from './editorState'
import { usePro } from '../../stores/proInstance'
import { isFeatureAllowed, type Feature } from '../../lib/features'

const TOOLS: { id: Tool; icon: ReactNode; feature?: Feature }[] = [
  { id: 'select', icon: <MousePointer2 className="h-[22px] w-[22px]" /> },
  { id: 'pen', icon: <PenLine className="h-[22px] w-[22px]" />, feature: 'ink' },
  { id: 'text', icon: <Type className="h-[22px] w-[22px]" />, feature: 'editText' },
  { id: 'highlight', icon: <Highlighter className="h-[22px] w-[22px]" />, feature: 'highlight' },
  { id: 'signature', icon: <Signature className="h-[22px] w-[22px]" />, feature: 'signature' },
  { id: 'note', icon: <MessageSquarePlus className="h-[22px] w-[22px]" />, feature: 'comments' },
  { id: 'image', icon: <ImagePlus className="h-[22px] w-[22px]" />, feature: 'editImage' },
  { id: 'shape', icon: <Square className="h-[22px] w-[22px]" />, feature: 'shapes' },
  { id: 'whiteout', icon: <Eraser className="h-[22px] w-[22px]" />, feature: 'whiteout' }
]

export function EditToolbar({ onTool }: { onTool: (tool: Tool) => void }) {
  const { t } = useTranslation()
  const ed = useEditor()
  const isPro = usePro((s) => s.isPro)
  const showOptions = ed.tool === 'pen' || ed.tool === 'text' || ed.tool === 'shape' || (ed.tool === 'select' && !!ed.selectedId)
  const hint = ed.tool === 'pen' ? t('ios.edit.drawWithPencil') : ed.tool === 'highlight' || ed.tool === 'whiteout' || ed.tool === 'shape' ? t('ios.edit.dragToDraw') : ed.tool === 'text' || ed.tool === 'note' || ed.pending ? t('ios.edit.tapToPlace') : null
  return (
    <div className="glass shrink-0 border-t hairline" style={{ paddingBottom: 'var(--safe-bottom)' }}>
      {hint && <div className="pt-1.5 text-center text-[12px] text-muted">{hint}</div>}
      {showOptions && (
        <div className="flex items-center gap-2 overflow-x-auto px-3 pt-2">
          {PALETTE.map((c) => (
            <button key={c} aria-label={`${t('ios.edit.color')} ${c}`} onClick={() => ed.setColor(c)} className={clsx('h-7 w-7 shrink-0 rounded-full border', ed.color === c ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : 'border-black/10')} style={{ background: c }} />
          ))}
          <span className="mx-1 h-6 w-px bg-line/20" />
          {ed.tool === 'text' || (ed.tool === 'select' && ed.present.objects.find((o) => o.id === ed.selectedId)?.kind === 'text')
            ? [10, 14, 18, 24, 32].map((s) => <button key={s} onClick={() => ed.setFontSize(s)} className={clsx('h-7 min-w-8 shrink-0 rounded-full px-2 text-[13px] font-semibold', ed.fontSize === s ? 'bg-accent text-accent-fg' : 'bg-surface-2')}>{s}</button>)
            : [1.5, 2.5, 4, 7].map((w) => <button key={w} aria-label={`${t('ios.edit.size')} ${w}`} onClick={() => ed.setStrokeWidth(w)} className={clsx('grid h-7 w-9 shrink-0 place-items-center rounded-full', ed.strokeWidth === w ? 'bg-accent/20' : 'bg-surface-2')}><span className="rounded-full bg-fg" style={{ width: 22, height: Math.max(1.5, w) }} /></button>)}
          {ed.selectedId && (
            <button onClick={ed.removeSelected} className="ms-auto flex h-8 shrink-0 items-center gap-1 rounded-full bg-danger/12 px-3 text-[14px] font-semibold text-danger"><Trash2 className="h-4 w-4" />{t('ios.edit.delete')}</button>
          )}
        </div>
      )}
      <div className="flex items-center gap-0.5 overflow-x-auto px-2 py-1.5">
        <button aria-label={t('ios.edit.undo')} disabled={!ed.past.length} onClick={ed.undo} className="grid h-11 w-10 shrink-0 place-items-center text-accent disabled:opacity-30"><Undo2 className="flip-rtl h-[22px] w-[22px]" /></button>
        <button aria-label={t('ios.edit.redo')} disabled={!ed.future.length} onClick={ed.redo} className="grid h-11 w-10 shrink-0 place-items-center text-accent disabled:opacity-30"><Redo2 className="flip-rtl h-[22px] w-[22px]" /></button>
        <span className="mx-1 h-7 w-px shrink-0 bg-line/20" />
        {TOOLS.map((tool) => {
          const locked = tool.feature ? !isFeatureAllowed(tool.feature, isPro) : false
          return (
            <button
              key={tool.id}
              onClick={() => (tool.feature && !usePro.getState().require(tool.feature) ? undefined : onTool(tool.id))}
              className={clsx('relative flex h-12 min-w-[54px] shrink-0 flex-col items-center justify-center rounded-[10px] px-1 text-[10.5px] font-medium', ed.tool === tool.id ? 'bg-accent text-accent-fg' : 'text-fg')}
            >
              {tool.icon}
              <span className="mt-0.5 leading-none">{t(`ios.edit.${tool.id}`)}</span>
              {locked && <span className="absolute end-0.5 top-0.5 h-2 w-2 rounded-full bg-accent" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
