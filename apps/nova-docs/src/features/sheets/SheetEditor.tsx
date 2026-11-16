/** محرر الجدول باللمس: شريط صيغة، شبكة برؤوس ثابتة، أوراق متعددة، تراجع، تصدير Excel/CSV — بمحرك الصيغ الأصلي. */
import clsx from 'clsx'
import { AlignCenter, AlignLeft, AlignRight, Bold, Columns3, Download, Italic, Plus, Redo2, Rows3, Undo2 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getSpreadsheet, saveSpreadsheet } from '@modules/spreadsheet/main/repository'
import { type CellStyle, type History, type NumberFormat, type Workbook, deleteCols, deleteRows, formatCellValue, insertCols, insertRows, newSheet, pushHistory, recalc, redoHistory, setCellInput, setCellStyle, undoHistory } from '@modules/spreadsheet/shared/sheetModel'
import { colToLetters, refKey } from '@modules/spreadsheet/shared/formula'
import { workbookToBytes } from '@modules/spreadsheet/shared/xlsx'
import { useNav } from '../../stores/nav'
import { usePrefs } from '../../stores/prefs'
import { shareBytes } from '../../lib/docs'
import { IconButton, NavBar } from '../../ui/kit'
import { ActionSheet, errorText, toast } from '../../ui/overlays'
import { WithDatabase } from '../invoices/shared'
import { getSettings } from '@modules/settings/main/repository'

const COL_W = 96
const ROW_H = 36
const VISIBLE_ROWS = 60
const VISIBLE_COLS = 12
const FILLS = [null, '#FFF3B0', '#D7F5E9', '#DCEBFF', '#FFE0E0'] as const
const FORMATS: { f: NumberFormat; key: string; label: string }[] = [
  { f: 'general', key: 'fmtGeneral', label: 'Abc' },
  { f: 'number', key: 'fmtNumber', label: '0.00' },
  { f: 'currency', key: 'fmtCurrency', label: '¤' },
  { f: 'percent', key: 'fmtPercent', label: '%' }
]

function Editor({ id }: { id: number }) {
  const { t } = useTranslation()
  const pop = useNav((s) => s.pop)
  const language = usePrefs((s) => s.language)
  const record = useMemo(() => getSpreadsheet(id), [id])
  const [hist, setHist] = useState<History<Workbook>>(() => ({ past: [], present: record ? (JSON.parse(record.data) as Workbook) : { sheets: [newSheet('Sheet1')], activeSheet: 0 }, future: [] }))
  const [sel, setSel] = useState({ col: 0, row: 0 })
  const [draft, setDraft] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const wb = hist.present
  const sheet = wb.sheets[wb.activeSheet] ?? wb.sheets[0]
  const cell = sheet.cells[refKey(sel)]

  const persist = (next: Workbook) => {
    saveSpreadsheet({ id, title: record?.title ?? 'Sheet', data: JSON.stringify(next), sheetCount: next.sheets.length })
  }
  const update = (next: Workbook) => {
    setHist((h) => pushHistory(h, next))
    persist(next)
  }
  const commit = () => {
    if (draft === null) return
    try {
      const nextSheet = recalc(setCellInput(sheet, sel, draft))
      update({ ...wb, sheets: wb.sheets.map((s, i) => (i === wb.activeSheet ? nextSheet : s)) })
      setSel((s) => ({ ...s, row: s.row + 1 }))
    } catch (e) {
      toast(errorText(e, t), 'error')
    }
    setDraft(null)
  }
  const replaceSheet = (fn: (sh: typeof sheet) => typeof sheet) => {
    try {
      const nextSheet = recalc(fn(sheet))
      update({ ...wb, sheets: wb.sheets.map((x, i) => (i === wb.activeSheet ? nextSheet : x)) })
    } catch (e) {
      toast(errorText(e, t), 'error')
    }
  }
  const style = cell?.style ?? {}
  const toggleStyle = (patch: Partial<CellStyle>) => replaceSheet((sh) => setCellStyle(sh, [sel], patch))
  const currency = useMemo(() => getSettings().invoice.defaultCurrency, [])
  const exportAs = async (type: 'xlsx' | 'csv') => {
    try {
      await shareBytes(`${record?.title ?? 'Sheet'}.${type}`, workbookToBytes(wb, type))
    } catch (e) {
      toast(errorText(e, t), 'error')
    }
  }
  const rows = Math.max(sheet.rowCount, VISIBLE_ROWS)
  const cols = Math.max(sheet.colCount, VISIBLE_COLS)

  return (
    <div className="flex h-full flex-col">
      <NavBar title={record?.title} onBack={pop} backLabel={t('ios.sheets.title')} trailing={<>
        <IconButton label={t('ios.edit.undo')} disabled={!hist.past.length} onClick={() => setHist((h) => { const n = undoHistory(h); persist(n.present); return n })}><Undo2 className="flip-rtl h-5 w-5" /></IconButton>
        <IconButton label={t('ios.edit.redo')} disabled={!hist.future.length} onClick={() => setHist((h) => { const n = redoHistory(h); persist(n.present); return n })}><Redo2 className="flip-rtl h-5 w-5" /></IconButton>
        <IconButton label={t('ios.common.share')} onClick={() => setMenu(true)}><Download className="h-5 w-5" /></IconButton>
      </>} />
      <div className="flex items-center gap-2 border-b hairline bg-surface px-3 py-2" dir="ltr">
        <span className="w-14 shrink-0 rounded bg-surface-2 py-1 text-center text-[13px] font-semibold tabular">{colToLetters(sel.col)}{sel.row + 1}</span>
        <input ref={inputRef} value={draft ?? cell?.input ?? ''} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && commit()} onBlur={commit} placeholder={t('ios.sheets.formula')} className="h-9 min-w-0 flex-1 rounded-[8px] bg-surface-2 px-2 font-mono text-[15px] outline-none" autoCapitalize="off" autoCorrect="off" />
      </div>
      <div className="flex items-center gap-0.5 overflow-x-auto border-b hairline bg-surface px-1.5 py-1" dir="ltr" data-testid="sheet-format-bar">
        <IconButton label={t('ios.sheets.bold')} active={!!style.bold} onClick={() => toggleStyle({ bold: !style.bold })}><Bold className="h-5 w-5" /></IconButton>
        <IconButton label={t('ios.sheets.italic')} active={!!style.italic} onClick={() => toggleStyle({ italic: !style.italic })}><Italic className="h-5 w-5" /></IconButton>
        <IconButton label={t('ios.sheets.alignStart')} active={style.align === 'start'} onClick={() => toggleStyle({ align: 'start' })}><AlignLeft className="h-5 w-5" /></IconButton>
        <IconButton label={t('ios.sheets.alignCenter')} active={style.align === 'center'} onClick={() => toggleStyle({ align: 'center' })}><AlignCenter className="h-5 w-5" /></IconButton>
        <IconButton label={t('ios.sheets.alignEnd')} active={style.align === 'end'} onClick={() => toggleStyle({ align: 'end' })}><AlignRight className="h-5 w-5" /></IconButton>
        <span className="mx-1 h-6 w-px shrink-0 bg-[var(--hairline)]" />
        {FORMATS.map((x) => (
          <button key={x.f} aria-label={t(`ios.sheets.${x.key}`)} onClick={() => toggleStyle({ format: x.f, currency: x.f === 'currency' ? currency : undefined })}
            className={clsx('h-9 min-w-9 shrink-0 rounded-[8px] px-2 text-[14px] font-semibold tabular', (style.format ?? 'general') === x.f ? 'bg-accent/15 text-accent' : 'text-muted')}>{x.f === 'currency' ? currency : x.label}</button>
        ))}
        <span className="mx-1 h-6 w-px shrink-0 bg-[var(--hairline)]" />
        {FILLS.map((c) => (
          <button key={c ?? 'none'} aria-label={t('ios.sheets.fill')} onClick={() => toggleStyle({ background: c ?? undefined })}
            className={clsx('mx-0.5 h-7 w-7 shrink-0 rounded-full border hairline', (style.background ?? null) === c && 'ring-2 ring-accent')} style={{ background: c ?? 'transparent' }} />
        ))}
        <span className="mx-1 h-6 w-px shrink-0 bg-[var(--hairline)]" />
        <IconButton label={t('ios.sheets.insertRow')} onClick={() => replaceSheet((sh) => insertRows(sh, sel.row))}><Rows3 className="h-5 w-5" /></IconButton>
        <IconButton label={t('ios.sheets.insertCol')} onClick={() => replaceSheet((sh) => insertCols(sh, sel.col))}><Columns3 className="h-5 w-5" /></IconButton>
        <button aria-label={t('ios.sheets.deleteRow')} onClick={() => replaceSheet((sh) => deleteRows(sh, sel.row))} className="h-9 shrink-0 rounded-[8px] px-2 text-[13px] font-medium text-danger">−{t('ios.sheets.deleteRow')}</button>
        <button aria-label={t('ios.sheets.deleteCol')} onClick={() => replaceSheet((sh) => deleteCols(sh, sel.col))} className="h-9 shrink-0 rounded-[8px] px-2 text-[13px] font-medium text-danger">−{t('ios.sheets.deleteCol')}</button>
      </div>
      <div className="ios-scroll min-h-0 flex-1 overflow-auto bg-surface" dir="ltr">
        <table className="border-separate border-spacing-0 text-[14px]" style={{ width: 44 + cols * COL_W }}>
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 h-7 w-11 border-b border-r hairline bg-surface-2" />
              {Array.from({ length: cols }, (_, c) => <th key={c} className={clsx('sticky top-0 z-10 h-7 border-b border-r hairline bg-surface-2 text-[12px] font-semibold text-muted', sel.col === c && 'bg-accent/20 text-accent')} style={{ width: sheet.colWidths[c] ?? COL_W, minWidth: COL_W }}>{colToLetters(c)}</th>)}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r}>
                <td className={clsx('sticky left-0 z-10 w-11 border-b border-r hairline bg-surface-2 text-center text-[12px] text-muted tabular', sel.row === r && 'bg-accent/20 text-accent')} style={{ height: ROW_H }}>{r + 1}</td>
                {Array.from({ length: cols }, (_, c) => {
                  const k = `${c}:${r}`
                  const v = sheet.cells[k]
                  const active = sel.col === c && sel.row === r
                  const num = typeof v?.value === 'number'
                  return (
                    <td key={c} onClick={() => { commit(); setSel({ col: c, row: r }); setDraft(null); setTimeout(() => inputRef.current?.focus(), 0) }}
                      className={clsx('truncate border-b border-r hairline px-1.5', num && 'tabular', active && 'outline outline-2 -outline-offset-2 outline-accent', v?.style?.bold && 'font-bold', v?.style?.italic && 'italic')}
                      style={{ maxWidth: COL_W, height: ROW_H, background: v?.style?.background, textAlign: v?.style?.align === 'center' ? 'center' : v?.style?.align === 'end' ? 'right' : v?.style?.align === 'start' ? 'left' : num ? 'right' : 'left' }}>
                      {v ? formatCellValue(v, language, v.style?.currency ?? currency) : ''}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-1 overflow-x-auto border-t hairline bg-surface px-2 py-1.5" style={{ paddingBottom: 'calc(var(--safe-bottom) + 6px)' }}>
        {wb.sheets.map((s, i) => (
          <button key={s.id} onClick={() => setHist((h) => ({ ...h, present: { ...h.present, activeSheet: i } }))} className={clsx('h-8 shrink-0 rounded-full px-3 text-[14px] font-medium', i === wb.activeSheet ? 'bg-accent text-accent-fg' : 'bg-surface-2')}>{s.name}</button>
        ))}
        <IconButton label={t('ios.sheets.addSheet')} onClick={() => update({ sheets: [...wb.sheets, newSheet(`Sheet${wb.sheets.length + 1}`)], activeSheet: wb.sheets.length })}><Plus className="h-5 w-5" /></IconButton>
      </div>
      <ActionSheet open={menu} onClose={() => setMenu(false)} actions={[
        { label: t('ios.sheets.exportXlsx'), onSelect: () => void exportAs('xlsx') },
        { label: t('ios.sheets.exportCsv'), onSelect: () => void exportAs('csv') }
      ]} />
    </div>
  )
}

export default function SheetEditor({ id }: { id?: number }) {
  return <WithDatabase>{() => (id ? <Editor id={id} /> : null)}</WithDatabase>
}
