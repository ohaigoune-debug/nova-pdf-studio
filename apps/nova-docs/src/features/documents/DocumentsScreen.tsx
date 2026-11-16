/** قسم «المستندات»: مكتبة ملفات PDF الحقيقية (مجلد NOVA Docs في تطبيق الملفات). */
import { Copy, Download, FileText, FolderInput, Images, MoreHorizontal, Pencil, Plus, Printer, ScanLine, Share2, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLibrary } from '../../stores/library'
import { useNav } from '../../stores/nav'
import { usePrefs } from '../../stores/prefs'
import { type LibraryItem, deleteLibraryFile, readLibraryFile, renameLibraryFile, writeLibraryFile } from '../../platform/library'
import { formatBytes } from '../../platform/bytes'
import { dropThumbnail, exportToFiles, pickAndImport, pickFilesBytes, printLibraryFile, shareLibraryFile, thumbnail } from '../../lib/docs'
import { imagesToPdf } from '@modules/pdf/shared/pdfTools'
import { intlLocaleOf } from '@shared/settings'
import { Button, Empty, IconButton, NavBar, SearchField, useMediaQuery } from '../../ui/kit'
import { ActionSheet, confirmDialog, errorText, promptDialog, toast } from '../../ui/overlays'
import { normalizeImages } from '../scan/images'

function Thumb({ item, size }: { item: LibraryItem; size: number }) {
  const [state, setState] = useState<{ url: string; pages: number } | null | undefined>(undefined)
  useEffect(() => {
    let alive = true
    if (item.kind === 'pdf') void thumbnail(item.name, item.modifiedAt, size).then((r) => alive && setState(r))
    else setState(null)
    return () => {
      alive = false
    }
  }, [item.name, item.modifiedAt, item.kind, size])
  return (
    <div className="pdf-page relative grid shrink-0 place-items-center overflow-hidden rounded-[6px]" style={{ width: size, height: size * 1.32 }}>
      {state?.url ? <img src={state.url} alt="" className="h-full w-full object-cover object-top" draggable={false} /> : <FileText className="h-1/3 w-1/3 text-accent/60" />}
      {state?.pages ? <span className="absolute bottom-1 end-1 rounded bg-black/55 px-1 text-[10px] font-semibold text-white tabular">{state.pages}</span> : null}
    </div>
  )
}

export function DocumentsScreen() {
  const { t } = useTranslation()
  const { items, loading, refresh } = useLibrary()
  const push = useNav((s) => s.push)
  const language = usePrefs((s) => s.language)
  const wide = useMediaQuery('(min-width: 640px)')
  const [query, setQuery] = useState('')
  const [menuFor, setMenuFor] = useState<LibraryItem | null>(null)
  const [addMenu, setAddMenu] = useState(false)

  useEffect(() => {
    void refresh()
  }, [refresh])

  const shown = useMemo(() => items.filter((i) => i.kind === 'pdf' && i.name.toLowerCase().includes(query.trim().toLowerCase())), [items, query])
  const fmtDate = (ms: number) => (ms ? new Intl.DateTimeFormat(intlLocaleOf(language), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms)) : '')

  const run = async (fn: () => Promise<void>) => {
    try {
      await fn()
    } catch (e) {
      toast(errorText(e, t), 'error')
    }
  }

  const importFiles = () => run(async () => {
    const names = await pickAndImport(['pdf'])
    if (names.length) {
      toast(t('ios.docs.imported', { count: names.length }))
      await refresh()
      if (names.length === 1) push({ name: 'viewer', file: names[0] })
    }
  })

  const fromImages = () => run(async () => {
    const files = await pickFilesBytes(['image'], true)
    if (!files.length) return
    const images = await normalizeImages(files.map((f) => f.bytes))
    const pdf = await imagesToPdf(images.map((i) => ({ data: i.bytes, mime: 'image/jpeg' as const })), 'A4')
    const name = await writeLibraryFile(`${t('ios.common.untitled')}.pdf`, pdf)
    await refresh()
    push({ name: 'viewer', file: name })
  })

  const actions = menuFor
    ? [
        { label: t('ios.common.share'), icon: <Share2 className="h-5 w-5" />, onSelect: () => run(() => shareLibraryFile(menuFor.name)) },
        { label: t('ios.docs.saveToFiles'), icon: <Download className="h-5 w-5" />, onSelect: () => run(async () => { if (await exportToFiles(menuFor.name)) toast(t('ios.docs.savedToFiles')) }) },
        { label: t('ios.common.print'), icon: <Printer className="h-5 w-5" />, onSelect: () => run(() => printLibraryFile(menuFor.name)) },
        {
          label: t('ios.common.rename'), icon: <Pencil className="h-5 w-5" />, onSelect: () => run(async () => {
            const next = await promptDialog(t('ios.docs.renamePrompt'), menuFor.name.replace(/\.pdf$/i, ''))
            if (next) { dropThumbnail(menuFor.name); await renameLibraryFile(menuFor.name, next); await refresh() }
          })
        },
        { label: t('ios.docs.duplicate'), icon: <Copy className="h-5 w-5" />, onSelect: () => run(async () => { await writeLibraryFile(menuFor.name, await readLibraryFile(menuFor.name)); await refresh() }) },
        {
          label: t('common.delete'), icon: <Trash2 className="h-5 w-5" />, destructive: true, onSelect: () => run(async () => {
            if (await confirmDialog(t('ios.docs.confirmDelete', { name: menuFor.name }), { destructive: true, confirmLabel: t('common.delete') })) {
              dropThumbnail(menuFor.name)
              await deleteLibraryFile(menuFor.name)
              await refresh()
              toast(t('ios.docs.deleted'))
            }
          })
        }
      ]
    : []

  return (
    <div className="ios-scroll h-full">
      <NavBar title={t('ios.docs.title')} large trailing={<IconButton label={t('ios.docs.import')} onClick={() => setAddMenu(true)}><Plus className="h-6 w-6" /></IconButton>}>
        {items.length > 0 && <SearchField value={query} onChange={setQuery} placeholder={t('ios.docs.search')} />}
      </NavBar>

      {!loading && shown.length === 0 && !query ? (
        <Empty
          icon={<FileText className="h-10 w-10" />}
          title={t('ios.docs.emptyTitle')}
          desc={t('ios.docs.emptyDesc')}
          action={
            <div className="flex flex-col gap-2">
              <Button onClick={() => void importFiles()}><FolderInput className="h-5 w-5" />{t('ios.docs.importFiles')}</Button>
              <Button variant="tinted" onClick={() => useNav.getState().setTab('scan')}><ScanLine className="h-5 w-5" />{t('ios.docs.newScan')}</Button>
            </div>
          }
        />
      ) : wide ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-5 gap-y-6 px-5 pt-3 pb-10">
          {shown.map((item) => (
            <div key={item.name} className="flex flex-col items-center text-center">
              <button className="pressable" onClick={() => push({ name: 'viewer', file: item.name })}><Thumb item={item} size={130} /></button>
              <button onClick={() => setMenuFor(item)} className="mt-2 flex max-w-full items-center gap-1">
                <span className="line-clamp-2 text-[14px] font-medium leading-tight">{item.name.replace(/\.pdf$/i, '')}</span>
                <MoreHorizontal className="h-4 w-4 shrink-0 text-muted" />
              </button>
              <span className="text-[12px] text-muted">{fmtDate(item.modifiedAt)}</span>
            </div>
          ))}
        </div>
      ) : (
        <ul className="mx-4 mt-2 overflow-hidden rounded-ios bg-surface">
          {shown.map((item) => (
            <li key={item.name} className="flex items-center gap-3 border-b hairline ps-3 last:border-0">
              <button className="pressable flex min-w-0 flex-1 items-center gap-3 py-2.5 text-start" onClick={() => push({ name: 'viewer', file: item.name })}>
                <Thumb item={item} size={46} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-medium">{item.name.replace(/\.pdf$/i, '')}</span>
                  <span className="block truncate text-[13px] text-muted tabular">{fmtDate(item.modifiedAt)} · {formatBytes(item.size)}</span>
                </span>
              </button>
              <IconButton label={t('ios.common.more')} onClick={() => setMenuFor(item)} className="text-muted"><MoreHorizontal className="h-5 w-5" /></IconButton>
            </li>
          ))}
        </ul>
      )}
      {items.length > 0 && <p className="px-8 py-6 text-center text-[13px] text-muted">{t('ios.docs.filesNote')}</p>}

      <ActionSheet open={!!menuFor} onClose={() => setMenuFor(null)} title={menuFor?.name} actions={actions} />
      <ActionSheet
        open={addMenu}
        onClose={() => setAddMenu(false)}
        actions={[
          { label: t('ios.docs.importFiles'), icon: <FolderInput className="h-5 w-5" />, onSelect: () => void importFiles() },
          { label: t('ios.docs.newScan'), icon: <ScanLine className="h-5 w-5" />, onSelect: () => useNav.getState().setTab('scan') },
          { label: t('ios.docs.fromImages'), icon: <Images className="h-5 w-5" />, onSelect: () => void fromImages() }
        ]}
      />
    </div>
  )
}
