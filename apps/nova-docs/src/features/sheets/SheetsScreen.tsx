/** الجداول: قائمة المصنفات المحفوظة (نفس جدول spreadsheet_documents في نسخة Windows)، إنشاء واستيراد Excel/CSV. */
import { FileSpreadsheet, FolderInput, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { deleteSpreadsheet, listSpreadsheets, saveSpreadsheet } from '@modules/spreadsheet/main/repository'
import { newWorkbook } from '@modules/spreadsheet/shared/sheetModel'
import { workbookFromBytes } from '@modules/spreadsheet/shared/xlsx'
import type { SpreadsheetRecord } from '@shared/spreadsheets'
import { useNav } from '../../stores/nav'
import { pickFilesBytes } from '../../lib/docs'
import { Button, Empty, IconButton, NavBar, Row, Section } from '../../ui/kit'
import { confirmDialog, errorText, promptDialog, toast } from '../../ui/overlays'
import { WithDatabase } from '../invoices/shared'

function List() {
  const { t } = useTranslation()
  const { pop, push } = useNav()
  const depth = useNav((s) => s.stacks[s.tab].length)
  const [rows, setRows] = useState<SpreadsheetRecord[]>([])
  useEffect(() => setRows(listSpreadsheets({ limit: 200 })), [depth])

  const create = async () => {
    const title = await promptDialog(t('ios.sheets.new'), t('ios.common.untitled'))
    if (!title) return
    const wb = newWorkbook()
    const rec = saveSpreadsheet({ title, data: JSON.stringify(wb), sheetCount: wb.sheets.length })
    push({ name: 'sheet', id: rec.id })
  }
  const importFile = async () => {
    try {
      const [file] = await pickFilesBytes(['spreadsheet'], false)
      if (!file) return
      const wb = workbookFromBytes(file.bytes, file.name)
      const rec = saveSpreadsheet({ title: file.name.replace(/\.(xlsx|xls|csv)$/i, ''), data: JSON.stringify(wb), sheetCount: wb.sheets.length })
      push({ name: 'sheet', id: rec.id })
    } catch (e) {
      toast(errorText(e, t), 'error')
    }
  }
  return (
    <div className="flex h-full flex-col">
      <NavBar title={t('ios.sheets.title')} onBack={pop} backLabel={t('ios.more.title')} trailing={<>
        <IconButton label={t('ios.sheets.import')} onClick={() => void importFile()}><FolderInput className="h-[22px] w-[22px]" /></IconButton>
        <IconButton label={t('ios.sheets.new')} onClick={() => void create()}><Plus className="h-6 w-6" /></IconButton>
      </>} />
      <div className="ios-scroll min-h-0 flex-1 pt-4">
        {rows.length === 0 ? (
          <Empty icon={<FileSpreadsheet className="h-10 w-10" />} title={t('ios.sheets.empty')} action={<div className="flex flex-col gap-2"><Button onClick={() => void create()}><Plus className="h-5 w-5" />{t('ios.sheets.new')}</Button><Button variant="tinted" onClick={() => void importFile()}>{t('ios.sheets.import')}</Button></div>} />
        ) : (
          <Section>
            {rows.map((r) => (
              <Row key={r.id} icon={<FileSpreadsheet className="h-4 w-4" />} title={r.title} subtitle={`${r.sheetCount} · ${r.updatedAt.slice(0, 16).replace('T', ' ')}`} chevron onClick={() => push({ name: 'sheet', id: r.id })}
                trailing={<IconButton label={t('common.delete')} className="text-danger" onClick={async (e) => { e.stopPropagation(); if (await confirmDialog(t('common.delete'), { destructive: true })) { deleteSpreadsheet(r.id); setRows(listSpreadsheets({ limit: 200 })) } }}><Trash2 className="h-4 w-4" /></IconButton>} />
            ))}
          </Section>
        )}
      </div>
    </div>
  )
}

export default function SheetsScreen() {
  return <WithDatabase>{() => <List />}</WithDatabase>
}
