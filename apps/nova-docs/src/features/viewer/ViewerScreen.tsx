/**
 * عارض ومحرر PDF: صفحات بتصيير كسول، تكبير بالقرص (Pinch)، بحث، إدارة صفحات، مشاركة/طباعة/حفظ في الملفات،
 * وضع تحرير بطبقات (نص، تظليل، قلم وApple Pencil، توقيع، تعليقات، صور، أشكال، تبييض) ثم حفظ حقيقي في الملف.
 */
import clsx from 'clsx'
import { ChevronDown, ChevronUp, Download, FileSearch, Info, LayoutGrid, MoreHorizontal, Printer, ScanText, Search, Share2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PageInfo, PdfEngine, SearchHit } from '@modules/pdf/renderer/pdfEngine'
import { useNav } from '../../stores/nav'
import { usePrefs } from '../../stores/prefs'
import { usePro } from '../../stores/proInstance'
import { useLibrary } from '../../stores/library'
import { readLibraryFile, writeLibraryFile } from '../../platform/library'
import { formatBytes } from '../../platform/bytes'
import { dropThumbnail, exportToFiles, loadEngine, pickFilesBytes, printLibraryFile, shareLibraryFile } from '../../lib/docs'
import { ocrPdf } from '../../lib/ocrDocument'
import { Button, IconButton, NavBar, Spinner, useElementWidth } from '../../ui/kit'
import { ActionSheet, confirmDialog, errorText, promptDialog, toast } from '../../ui/overlays'
import { PageView, type HitRect } from './PageView'
import { EditToolbar } from './EditToolbar'
import { SignatureSheet } from './SignatureSheet'
import { PagesSheet } from './PagesSheet'
import { type Tool, useEditor } from './editorState'
import { bakeEdits } from './saveDocument'
import { normalizeImages } from '../scan/images'
import { bytesToBase64 } from '../../platform/bytes'

export default function ViewerScreen({ file, startPage = 0, startEditing = false }: { file: string; startPage?: number; startEditing?: boolean }) {
  const { t } = useTranslation()
  const pop = useNav((s) => s.pop)
  const replace = useNav((s) => s.replace)
  const ocrLanguages = usePrefs((s) => s.ocrLanguages)
  const [name, setName] = useState(file)
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [engine, setEngine] = useState<PdfEngine | null>(null)
  const [infos, setInfos] = useState<PageInfo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [current, setCurrent] = useState(startPage)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [menu, setMenu] = useState(false)
  const [saveMenu, setSaveMenu] = useState(false)
  const [pagesOpen, setPagesOpen] = useState(false)
  const [signOpen, setSignOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [hitIndex, setHitIndex] = useState(0)
  const [hitRects, setHitRects] = useState<Record<number, HitRect[]>>({})
  const [scanned, setScanned] = useState(false)
  const [ocrState, setOcrState] = useState<{ done: number; total: number } | null>(null)
  const [scrollRef, width] = useElementWidth<HTMLDivElement>()
  const pagesRef = useRef<HTMLDivElement>(null)
  const pinch = useRef<{ d0: number; z0: number; cx: number; cy: number } | null>(null)
  const [pinchScale, setPinchScale] = useState(1)
  const editor = useEditor()

  // ---------------------------------------------------------------- تحميل المستند
  const open = useCallback(async (data: Uint8Array, password?: string) => {
    try {
      const eng = await loadEngine(data, password)
      const first = await eng.pageInfos()
      setEngine((old) => {
        old?.destroy()
        return eng
      })
      setBytes(data)
      setInfos(first)
      setError(null)
      // المقاسات الحقيقية لكل صفحة في الخلفية (مستندات بمقاسات مختلطة)
      void (async () => {
        const exact: PageInfo[] = []
        for (let i = 0; i < eng.pageCount; i++) exact.push(await eng.pageInfo(i))
        setInfos(exact)
      })()
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code === 'PDF_PASSWORD') {
        const pw = await promptDialog(t('ios.viewer.passwordTitle'), '', { message: t('ios.viewer.passwordHint') })
        if (pw) return open(data, pw)
      }
      setError(errorText(e, t))
    }
  }, [t])

  useEffect(() => {
    editor.reset()
    if (startEditing) setEditing(true)
    void readLibraryFile(file).then((b) => open(b)).catch((e) => setError(errorText(e, t)))
    return () => {
      useEditor.getState().reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file])

  useEffect(() => () => engine?.destroy(), [engine])

  // ---------------------------------------------------------------- المقياس
  const maxW = useMemo(() => infos.reduce((m, i) => Math.max(m, i.widthPt), 0) || 595, [infos])
  const fit = width ? Math.min((width - 24) / maxW, 2.2) : 0
  const scale = fit * zoom

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]]
      pinch.current = { d0: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z0: zoom, cx: (a.clientX + b.clientX) / 2, cy: (a.clientY + b.clientY) / 2 }
    }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (pinch.current && e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]]
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      const next = Math.min(4, Math.max(0.6, (pinch.current.z0 * d) / pinch.current.d0))
      setPinchScale(next / pinch.current.z0)
    }
  }
  const onTouchEnd = () => {
    if (!pinch.current) return
    const el = scrollRef.current
    const target = Math.min(4, Math.max(0.6, pinch.current.z0 * pinchScale))
    const ratio = target / zoom
    const rect = el?.getBoundingClientRect()
    const anchorY = el && rect ? el.scrollTop + (pinch.current.cy - rect.top) : 0
    const anchorX = el && rect ? el.scrollLeft + (pinch.current.cx - rect.left) : 0
    pinch.current = null
    setPinchScale(1)
    setZoom(target)
    requestAnimationFrame(() => {
      if (el && rect) {
        el.scrollTop = anchorY * ratio - (anchorY - el.scrollTop)
        el.scrollLeft = anchorX * ratio - (anchorX - el.scrollLeft)
      }
    })
  }

  const goTo = useCallback((index: number) => {
    const el = pagesRef.current?.querySelector(`[data-page="${index}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (engine && startPage) setTimeout(() => goTo(startPage), 300)
  }, [engine, startPage, goTo])

  const onVisible = useCallback((i: number) => setCurrent(i), [])

  useEffect(() => {
    if (!engine) return
    void engine.isScanned(current).then(setScanned).catch(() => setScanned(false))
  }, [engine, current])

  // ---------------------------------------------------------------- البحث
  useEffect(() => {
    if (!engine || !searchOpen) return
    const q = query.trim()
    if (q.length < 2) {
      setHits([])
      setHitRects({})
      return
    }
    const signal = { cancelled: false }
    const timer = setTimeout(async () => {
      const found = await engine.search(q, undefined, signal)
      if (signal.cancelled) return
      setHits(found)
      setHitIndex(0)
      const rects: Record<number, HitRect[]> = {}
      for (const [i, h] of found.entries()) {
        const spans = await engine.textSpans(h.page)
        const s = spans[h.spanIndex]
        if (!s) continue
        const ratio = s.text.length ? s.width / s.text.length : 0
        const rtl = s.dir === 'rtl'
        const x = rtl ? s.x + s.width - (h.start + h.length) * ratio : s.x + h.start * ratio
        ;(rects[h.page] ??= []).push({ x, y: s.y, width: Math.max(4, h.length * ratio), height: s.height, active: i === 0 })
      }
      setHitRects(rects)
      if (found[0]) goTo(found[0].page)
    }, 250)
    return () => {
      signal.cancelled = true
      clearTimeout(timer)
    }
  }, [engine, query, searchOpen, goTo])

  const stepHit = (dir: 1 | -1) => {
    if (!hits.length) return
    const next = (hitIndex + dir + hits.length) % hits.length
    setHitIndex(next)
    let k = 0
    const rects: Record<number, HitRect[]> = {}
    for (const [page, list] of Object.entries(hitRects)) rects[Number(page)] = list.map((r) => ({ ...r, active: false }))
    for (const h of hits.slice(0, next)) if (h.page === hits[next].page) k++
    const target = rects[hits[next].page]?.[k]
    if (target) target.active = true
    setHitRects(rects)
    goTo(hits[next].page)
  }

  // ---------------------------------------------------------------- الحفظ
  const reloadWith = async (data: Uint8Array, savedName: string) => {
    dropThumbnail(savedName)
    if (savedName !== name) {
      setName(savedName)
      replace({ name: 'viewer', file: savedName })
    }
    await open(data)
    void useLibrary.getState().refresh()
  }

  const persist = async (data: Uint8Array, mode: 'replace' | 'copy') => {
    const saved = mode === 'replace' ? await writeLibraryFile(name, data, { overwrite: true }) : await writeLibraryFile(name, data)
    await reloadWith(data, saved)
    return saved
  }

  const save = async (mode: 'replace' | 'copy') => {
    if (!bytes) return
    setSaving(true)
    try {
      const out = await bakeEdits(bytes, useEditor.getState().present)
      await persist(out, mode)
      useEditor.getState().reset()
      setEditing(false)
      toast(t('ios.viewer.saved'))
    } catch (e) {
      toast(errorText(e, t), 'error')
    } finally {
      setSaving(false)
    }
  }

  const finishEditing = () => {
    if (editor.dirty && (editor.present.objects.length || editor.present.ink.length || editor.present.notes.length)) setSaveMenu(true)
    else {
      editor.reset()
      setEditing(false)
    }
  }

  const back = async () => {
    if (editing && editor.dirty) {
      const discard = await confirmDialog(t('ios.viewer.unsaved'), { destructive: true, confirmLabel: t('ios.viewer.discard') })
      if (!discard) return
    }
    editor.reset()
    pop()
  }

  const onTool = async (tool: Tool) => {
    if (tool === 'signature') {
      editor.setTool('signature')
      setSignOpen(true)
      return
    }
    if (tool === 'image') {
      const [img] = await pickFilesBytes(['image'], false)
      if (!img) return
      const [norm] = await normalizeImages([img.bytes], 1600)
      editor.setTool('image')
      editor.setPending({ kind: 'image', mime: 'image/jpeg', dataBase64: bytesToBase64(norm.bytes), role: 'image', aspect: norm.height / norm.width })
      return
    }
    editor.setTool(tool)
  }

  const runOcr = async () => {
    if (!engine || !usePro.getState().require('ocr')) return
    setOcrState({ done: 0, total: engine.pageCount })
    try {
      const res = await ocrPdf(engine, ocrLanguages, (done, total) => setOcrState({ done, total }))
      await persist(res.bytes, 'replace')
      toast(t('ios.ocr.done', { pages: engine.pageCount }))
    } catch (e) {
      toast(errorText(e, t), 'error')
    } finally {
      setOcrState(null)
    }
  }

  const showInfo = async () => {
    if (!engine || !bytes) return
    const meta = await engine.metadata()
    const lines = [`${t('ios.viewer.page', { n: current + 1, total: engine.pageCount })}`, formatBytes(bytes.length), ...Object.entries(meta).filter(([, v]) => v).slice(0, 5).map(([k, v]) => `${k}: ${v}`)]
    await confirmDialog(name, { message: lines.join('\n') })
  }

  const safe = (fn: () => Promise<unknown>) => () => void fn().catch((e) => toast(errorText(e, t), 'error'))

  if (error) {
    return (
      <div className="flex h-full flex-col">
        <NavBar title={name} onBack={pop} backLabel={t('ios.tabs.documents')} />
        <div className="grid flex-1 place-items-center p-8 text-center text-muted">{t('ios.viewer.openFailed')}<br />{error}</div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-surface-2/60">
      <NavBar
        title={<span className="text-[15px]">{name.replace(/\.pdf$/i, '')}</span>}
        onBack={() => void back()}
        backLabel={editing ? undefined : t('ios.tabs.documents')}
        trailing={
          editing ? (
            <Button size="sm" onClick={finishEditing} disabled={saving}>{saving ? <Spinner /> : t('ios.common.done')}</Button>
          ) : (
            <>
              <IconButton label={t('ios.viewer.search')} onClick={() => setSearchOpen((v) => !v)} active={searchOpen}><Search className="h-[22px] w-[22px]" /></IconButton>
              <IconButton label={t('ios.viewer.pages')} onClick={() => setPagesOpen(true)} disabled={!engine}><LayoutGrid className="h-[22px] w-[22px]" /></IconButton>
              <IconButton label={t('ios.common.more')} onClick={() => setMenu(true)}><MoreHorizontal className="h-[22px] w-[22px]" /></IconButton>
              <Button size="sm" variant="tinted" onClick={() => setEditing(true)} disabled={!engine}>{t('ios.viewer.edit')}</Button>
            </>
          )
        }
      >
        {searchOpen && !editing && (
          <div className="flex items-center gap-2 px-3 pb-2">
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('ios.viewer.searchPlaceholder')} className="h-9 min-w-0 flex-1 rounded-[10px] bg-surface-2 px-3 outline-none" enterKeyHint="search" />
            <span className="shrink-0 text-[13px] text-muted tabular">{query.trim().length > 1 ? (hits.length ? `${hitIndex + 1}/${hits.length}` : t('ios.viewer.noResults')) : ''}</span>
            <IconButton label="prev" onClick={() => stepHit(-1)} disabled={!hits.length}><ChevronUp className="h-5 w-5" /></IconButton>
            <IconButton label="next" onClick={() => stepHit(1)} disabled={!hits.length}><ChevronDown className="h-5 w-5" /></IconButton>
            <IconButton label={t('common.close')} onClick={() => { setSearchOpen(false); setQuery('') }}><X className="h-5 w-5" /></IconButton>
          </div>
        )}
      </NavBar>

      {scanned && !editing && !ocrState && (
        <div className="flex items-center gap-3 bg-accent/12 px-4 py-2 text-[14px]">
          <ScanText className="h-5 w-5 shrink-0 text-accent" />
          <span className="flex-1">{t('ios.viewer.scannedNotice')}</span>
          <Button size="sm" onClick={() => void runOcr()}>{t('ios.ocr.run')}</Button>
        </div>
      )}

      <div ref={scrollRef} className="ios-scroll relative min-h-0 flex-1 overflow-x-auto" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
        {!engine || !scale ? (
          <div className="grid h-full place-items-center text-muted"><Spinner /></div>
        ) : (
          <div ref={pagesRef} className="px-3 py-4" style={{ width: Math.max(width, maxW * scale + 24), transform: pinchScale !== 1 ? `scale(${pinchScale})` : undefined, transformOrigin: 'top center' }}>
            {infos.map((info) => (
              <PageView key={`${info.index}-${bytes?.length}`} engine={engine} info={info} scale={scale} editing={editing} hits={hitRects[info.index] ?? []} onVisible={onVisible} />
            ))}
          </div>
        )}
        {engine && (
          <div className="pointer-events-none sticky bottom-3 flex justify-center">
            <span className="glass rounded-full px-3 py-1 text-[13px] font-medium text-muted shadow tabular">{t('ios.viewer.page', { n: current + 1, total: engine.pageCount })}</span>
          </div>
        )}
      </div>

      {editing && <EditToolbar onTool={(tool) => void onTool(tool)} />}
      {editing && !editor.dirty && <div className="bg-surface px-4 py-1.5 text-center text-[11.5px] text-muted">{t('ios.viewer.layerNote')}</div>}

      {ocrState && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black/40">
          <div className="glass w-72 rounded-card p-5 text-center shadow-float">
            <Spinner className="text-accent" />
            <div className="mt-3 text-[15px] font-medium">{t('ios.scan.ocrProgress', { page: Math.min(ocrState.done + 1, ocrState.total), total: ocrState.total })}</div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full bg-accent transition-all" style={{ width: `${(ocrState.done / ocrState.total) * 100}%` }} /></div>
          </div>
        </div>
      )}

      <ActionSheet
        open={menu}
        onClose={() => setMenu(false)}
        title={name}
        actions={[
          { label: t('ios.common.share'), icon: <Share2 className="h-5 w-5" />, onSelect: safe(() => shareLibraryFile(name)) },
          { label: t('ios.common.print'), icon: <Printer className="h-5 w-5" />, onSelect: safe(() => printLibraryFile(name)) },
          { label: t('ios.docs.saveToFiles'), icon: <Download className="h-5 w-5" />, onSelect: safe(async () => { if (await exportToFiles(name)) toast(t('ios.docs.savedToFiles')) }) },
          { label: t('ios.ocr.run'), icon: <FileSearch className="h-5 w-5" />, pro: !usePro.getState().isPro, onSelect: () => void runOcr() },
          { label: t('ios.viewer.info'), icon: <Info className="h-5 w-5" />, onSelect: () => void showInfo() }
        ]}
      />
      <ActionSheet
        open={saveMenu}
        onClose={() => setSaveMenu(false)}
        title={t('ios.viewer.saveAs')}
        actions={[
          { label: t('ios.common.replace'), onSelect: () => void save('replace') },
          { label: t('ios.common.saveCopy'), onSelect: () => void save('copy') },
          { label: t('ios.viewer.discard'), destructive: true, onSelect: () => { editor.reset(); setEditing(false) } }
        ]}
      />
      {engine && bytes && (
        <PagesSheet
          open={pagesOpen}
          onClose={() => setPagesOpen(false)}
          engine={engine}
          bytes={bytes}
          blocked={editor.dirty}
          onOpenPage={(i) => setTimeout(() => goTo(i), 250)}
          onApply={async (data) => { await persist(data, 'replace') }}
          onExtract={async (data) => {
            const saved = await writeLibraryFile(name.replace(/\.pdf$/i, ` (${t('ios.pages.extract')}).pdf`), data)
            void useLibrary.getState().refresh()
            toast(t('ios.tools.resultSaved', { name: saved }))
          }}
        />
      )}
      <SignatureSheet
        open={signOpen}
        onClose={() => {
          setSignOpen(false)
          if (!useEditor.getState().pending) editor.setTool('select')
        }}
        onPick={(sig) => editor.setPending({ kind: 'image', mime: 'image/png', dataBase64: sig.dataBase64, role: 'signature', aspect: sig.aspect })}
      />
      <span className={clsx('hidden')}>{saving && <Spinner />}</span>
    </div>
  )
}
