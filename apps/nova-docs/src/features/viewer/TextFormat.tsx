/**
 * لوحة تنسيق النص (أسلوب تطبيق Pages): الخط — مع «خطوط هذا المستند» أولًا — والحجم والنمط والمحاذاة واللون.
 * تُطبَّق على النص المحدد، وتصبح الإعداد الافتراضي للنص الجديد.
 */
import clsx from 'clsx'
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Minus, Plus, Type, Underline } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TextObject } from '@modules/pdf/shared/editModel'
import { EDITOR_FONTS, fontNameOf, preloadEditorFonts } from '../../lib/editorFonts'
import { Sheet } from '../../ui/overlays'
import { PALETTE, useEditor } from './editorState'

export const SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 60, 72]
const clampSize = (n: number) => Math.max(6, Math.min(96, Math.round(n)))

/** الحالة الحالية: من النص المحدد إن وُجد، وإلا الإعداد الافتراضي للنص الجديد */
export function useCurrentText() {
  const ed = useEditor()
  const sel = ed.present.objects.find((o) => o.id === ed.selectedId)
  const o = sel?.kind === 'text' ? (sel as TextObject) : null
  return {
    o,
    font: o ? fontNameOf(o) ?? null : ed.fontName,
    size: o ? o.fontSize : ed.fontSize,
    bold: o ? o.bold : ed.textStyle.bold,
    italic: o ? o.italic : ed.textStyle.italic,
    underline: o ? o.underline : ed.textStyle.underline,
    align: o ? o.align : ed.textStyle.align,
    color: o ? o.color : ed.color
  }
}

export function fontLabel(family: string | null, systemLabel: string): string {
  if (!family) return systemLabel
  return EDITOR_FONTS.find((f) => f.family === family)?.label.split(' — ')[1] ?? family
}

const chip = (on: boolean) => clsx('grid h-8 w-8 shrink-0 place-items-center rounded-[9px]', on ? 'bg-accent text-accent-fg' : 'bg-surface-2')

/** الصف السريع فوق شريط الأدوات (للنص) */
export function TextQuickBar({ onOpenFormat }: { onOpenFormat: () => void }) {
  const { t } = useTranslation()
  const ed = useEditor()
  const cur = useCurrentText()
  const cycleAlign = () => ed.setTextStyle({ align: cur.align === 'right' ? 'center' : cur.align === 'center' ? 'left' : 'right' })
  const AlignIcon = cur.align === 'center' ? AlignCenter : cur.align === 'left' ? AlignLeft : AlignRight
  return (
    <>
      <button onClick={() => { preloadEditorFonts(); onOpenFormat() }} className="flex h-8 max-w-[140px] shrink-0 items-center gap-1.5 rounded-[9px] bg-surface-2 px-2.5 text-[14px] font-semibold" style={cur.font ? { fontFamily: `"${cur.font}"` } : undefined} aria-label={t('ios.edit.format')}>
        <Type className="h-4 w-4 shrink-0 text-accent" />
        <span className="truncate">{fontLabel(cur.font, t('ios.edit.font'))}</span>
      </button>
      <div className="flex h-8 shrink-0 items-center rounded-[9px] bg-surface-2">
        <button aria-label={t('ios.edit.smaller')} onClick={() => ed.setFontSize(clampSize(cur.size - 1))} className="grid h-8 w-8 place-items-center"><Minus className="h-4 w-4" /></button>
        <button onClick={() => { preloadEditorFonts(); onOpenFormat() }} className="min-w-[34px] text-center text-[14px] font-semibold tabular">{Math.round(cur.size)}</button>
        <button aria-label={t('ios.edit.larger')} onClick={() => ed.setFontSize(clampSize(cur.size + 1))} className="grid h-8 w-8 place-items-center"><Plus className="h-4 w-4" /></button>
      </div>
      <button aria-label={t('ios.edit.bold')} aria-pressed={cur.bold} onClick={() => ed.setTextStyle({ bold: !cur.bold })} className={chip(cur.bold)}><Bold className="h-4 w-4" /></button>
      <button aria-label={t('ios.edit.italic')} aria-pressed={cur.italic} onClick={() => ed.setTextStyle({ italic: !cur.italic })} className={chip(cur.italic)}><Italic className="h-4 w-4" /></button>
      <button aria-label={t('ios.edit.underline')} aria-pressed={cur.underline} onClick={() => ed.setTextStyle({ underline: !cur.underline })} className={chip(cur.underline)}><Underline className="h-4 w-4" /></button>
      <button aria-label={t('ios.edit.align')} onClick={cycleAlign} className={chip(false)}><AlignIcon className="h-4 w-4" /></button>
      <button aria-label={t('ios.edit.color')} onClick={onOpenFormat} className="h-7 w-7 shrink-0 rounded-full border border-black/10" style={{ background: cur.color }} />
    </>
  )
}

/** ورقة التنسيق الكاملة */
export function TextFormatSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const ed = useEditor()
  const cur = useCurrentText()
  const pickFont = (family: string | null, bold?: boolean) => {
    ed.setFontName(family)
    if (bold !== undefined) ed.setTextStyle({ bold })
  }
  const docFonts = ed.docFonts.slice(0, 6)
  return (
    <Sheet open onClose={onClose} full title={t('ios.edit.format')} trailing={<button className="text-accent" onClick={onClose}>{t('ios.common.done')}</button>}>
      {/* النمط والمحاذاة */}
      <div className="mx-4 mb-4 flex items-center gap-2 rounded-ios bg-surface p-2">
        <button aria-pressed={cur.bold} onClick={() => ed.setTextStyle({ bold: !cur.bold })} className={clsx(chip(cur.bold), 'h-10 w-11')}><Bold className="h-5 w-5" /></button>
        <button aria-pressed={cur.italic} onClick={() => ed.setTextStyle({ italic: !cur.italic })} className={clsx(chip(cur.italic), 'h-10 w-11')}><Italic className="h-5 w-5" /></button>
        <button aria-pressed={cur.underline} onClick={() => ed.setTextStyle({ underline: !cur.underline })} className={clsx(chip(cur.underline), 'h-10 w-11')}><Underline className="h-5 w-5" /></button>
        <span className="mx-1 h-7 w-px bg-line/20" />
        {(['right', 'center', 'left'] as const).map((a) => {
          const I = a === 'right' ? AlignRight : a === 'center' ? AlignCenter : AlignLeft
          return <button key={a} aria-label={t(`ios.edit.align_${a}`)} onClick={() => ed.setTextStyle({ align: a })} className={clsx(chip(cur.align === a), 'h-10 w-11')}><I className="h-5 w-5" /></button>
        })}
      </div>

      {/* الحجم */}
      <div className="mx-4 mb-4 rounded-ios bg-surface p-3">
        <div className="mb-2 flex items-center justify-between text-[15px]"><span className="text-muted">{t('ios.edit.size')}</span><span className="font-semibold tabular">{Math.round(cur.size)} pt</span></div>
        <input type="range" min={6} max={96} step={1} value={Math.round(cur.size)} onChange={(e) => ed.setFontSize(clampSize(Number(e.target.value)))} className="w-full accent-[#17B890]" aria-label={t('ios.edit.size')} />
        <div className="mt-2 flex gap-1.5 overflow-x-auto">
          {SIZES.map((s) => <button key={s} onClick={() => ed.setFontSize(s)} className={clsx('h-8 min-w-9 shrink-0 rounded-full px-2 text-[13px] font-semibold tabular', Math.round(cur.size) === s ? 'bg-accent text-accent-fg' : 'bg-surface-2')}>{s}</button>)}
        </div>
      </div>

      {/* اللون */}
      <div className="mx-4 mb-4 flex flex-wrap gap-3 rounded-ios bg-surface p-3">
        {PALETTE.map((c) => <button key={c} aria-label={`${t('ios.edit.color')} ${c}`} onClick={() => ed.setColor(c)} className={clsx('h-9 w-9 rounded-full border', cur.color === c ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : 'border-black/10')} style={{ background: c }} />)}
      </div>

      {/* خطوط هذا المستند */}
      {docFonts.length > 0 && (
        <>
          <div className="px-8 pb-1.5 text-[13px] uppercase text-muted">{t('ios.edit.docFonts')}</div>
          <div className="mx-4 mb-4 overflow-hidden rounded-ios bg-surface">
            {docFonts.map((f) => (
              <button key={f.id} onClick={() => pickFont(f.match.family, f.bold)} className={clsx('flex min-h-[60px] w-full flex-col items-start justify-center border-b hairline px-4 py-2 text-start last:border-0', cur.font === f.match.family && 'text-accent')}>
                <span className="text-[19px] leading-snug" style={{ fontFamily: `"${f.match.family}", serif`, fontWeight: f.bold ? 700 : 400 }} dir="rtl">أبجد هوز حطي كلمن · Aa 123</span>
                <span className="text-[12px] text-muted">{f.name} — {f.match.exact ? t('ios.edit.fontExact') : t('ios.edit.fontClosest', { font: fontLabel(f.match.family, f.match.family) })}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* كل الخطوط */}
      <div className="px-8 pb-1.5 text-[13px] uppercase text-muted">{t('ios.edit.allFonts')}</div>
      <div className="mx-4 overflow-hidden rounded-ios bg-surface">
        <button onClick={() => pickFont(null)} className={clsx('flex min-h-[52px] w-full items-center border-b hairline px-4 text-start text-[17px]', !cur.font && 'text-accent')}>{t('ios.edit.systemFont')}</button>
        {EDITOR_FONTS.map((f) => (
          <button key={f.family} onClick={() => pickFont(f.family)} className={clsx('flex min-h-[60px] w-full flex-col items-start justify-center border-b hairline px-4 text-start last:border-0', cur.font === f.family && 'text-accent')}>
            <span className="text-[20px] leading-snug" style={{ fontFamily: `"${f.family}", serif` }} dir="rtl">بسم الله الرحمن الرحيم · Aa 123</span>
            <span className="text-[12px] text-muted">{f.label}</span>
          </button>
        ))}
      </div>
      <p className="px-6 pt-3 text-center text-[12px] text-muted">{t('ios.edit.fontsNote')}</p>
    </Sheet>
  )
}
