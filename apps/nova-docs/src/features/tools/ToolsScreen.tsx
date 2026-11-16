/** قسم «أدوات PDF»: كل الأدوات تعمل على الجهاز (pdf-lib + pdf.js) بنفس الدوال المختبرة في نسخة Windows. */
import clsx from 'clsx'
import { ArrowDownUp, CheckCircle2, Circle, Combine, Droplets, FileMinus2, FileOutput, FileSearch, FileText, FolderInput, Hash, Images, Minimize2, RotateCw, Scissors } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { addPageNumbers, addWatermark, compress, deletePages, extractPages, imagesToPdf, merge, parsePageRange, pageCount, reorderPages, rotatePages, split } from '@modules/pdf/shared/pdfTools'
import { useLibrary } from '../../stores/library'
import { useNav } from '../../stores/nav'
import { usePro } from '../../stores/proInstance'
import { usePrefs } from '../../stores/prefs'
import { isFeatureAllowed, type Feature } from '../../lib/features'
import { readLibraryFile, writeLibraryFile, writeTextFile } from '../../platform/library'
import { formatBytes } from '../../platform/bytes'
import { loadEngine, pickFilesBytes } from '../../lib/docs'
import { ocrPdf } from '../../lib/ocrDocument'
import { normalizeImages } from '../scan/images'
import { Button, Field, NavBar, ProBadge, Section, Segmented, Spinner } from '../../ui/kit'
import { Sheet, errorText, toast } from '../../ui/overlays'

type ToolId = 'merge' | 'split' | 'extract' | 'delete' | 'reorder' | 'rotate' | 'watermark' | 'numbers' | 'images' | 'compress' | 'ocr' | 'toText'

interface ToolDef { id: ToolId; feature: Feature; icon: ReactNode; color: string; multi?: boolean; images?: boolean }

const TOOLS: ToolDef[] = [
  { id: 'merge', feature: 'merge', icon: <Combine className="h-6 w-6" />, color: 'bg-[#17B890]', multi: true },
  { id: 'images', feature: 'imagesToPdf', icon: <Images className="h-6 w-6" />, color: 'bg-[#2F80ED]', images: true },
  { id: 'rotate', feature: 'rotate', icon: <RotateCw className="h-6 w-6" />, color: 'bg-[#6E56CF]' },
  { id: 'split', feature: 'split', icon: <Scissors className="h-6 w-6" />, color: 'bg-[#E5484D]' },
  { id: 'extract', feature: 'extract', icon: <FileOutput className="h-6 w-6" />, color: 'bg-[#F5A524]' },
  { id: 'delete', feature: 'deletePages', icon: <FileMinus2 className="h-6 w-6" />, color: 'bg-[#D6409F]' },
  { id: 'reorder', feature: 'reorder', icon: <ArrowDownUp className="h-6 w-6" />, color: 'bg-[#0E7C66]' },
  { id: 'watermark', feature: 'watermark', icon: <Droplets className="h-6 w-6" />, color: 'bg-[#0091FF]' },
  { id: 'numbers', feature: 'pageNumbers', icon: <Hash className="h-6 w-6" />, color: 'bg-[#123D36]' },
  { id: 'compress', feature: 'compress', icon: <Minimize2 className="h-6 w-6" />, color: 'bg-[#8E4EC6]' },
  { id: 'ocr', feature: 'ocr', icon: <FileSearch className="h-6 w-6" />, color: 'bg-[#17B890]' },
  { id: 'toText', feature: 'toText', icon: <FileText className="h-6 w-6" />, color: 'bg-[#5F6F6B]' }
]

const TITLE: Record<ToolId, [string, string]> = {
  merge: ['tools.merge.title', 'tools.merge.desc'], split: ['tools.split.title', 'tools.split.desc'], extract: ['tools.extract.title', 'tools.extract.desc'],
  delete: ['tools.delete.title', 'tools.delete.desc'], reorder: ['tools.reorder.title', 'tools.reorder.desc'], rotate: ['tools.rotate.title', 'tools.rotate.desc'],
  watermark: ['tools.watermark.title', 'tools.watermark.desc'], numbers: ['tools.numbers.title', 'tools.numbers.desc'], images: ['tools.images.title', 'tools.images.desc'],
  compress: ['tools.compress.title', 'tools.compress.desc'], ocr: ['ios.tools.ocrTitle', 'ios.tools.ocrDesc'], toText: ['ios.tools.toTextTitle', 'ios.tools.toTextDesc']
}

interface Input { name: string; bytes: Uint8Array; fromLibrary: boolean }

function ToolSheet({ tool, onClose }: { tool: ToolDef | null; onClose: () => void }) {
  const { t } = useTranslation()
  const items = useLibrary((s) => s.items).filter((i) => i.kind === 'pdf')
  const refresh = useLibrary((s) => s.refresh)
  const push = useNav((s) => s.push)
  const ocrLanguages = usePrefs((s) => s.ocrLanguages)
  const [picked, setPicked] = useState<string[]>([])
  const [external, setExternal] = useState<Input[]>([])
  const [images, setImages] = useState<{ name: string; bytes: Uint8Array }[]>([])
  const [range, setRange] = useState('')
  const [every, setEvery] = useState('1')
  const [angle, setAngle] = useState<'90' | '180' | '270'>('90')
  const [text, setText] = useState('CONFIDENTIAL')
  const [position, setPosition] = useState<'bottom-center' | 'bottom-right' | 'top-center'>('bottom-center')
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    setPicked([])
    setExternal([])
    setImages([])
    setRange('')
    setBusy(null)
  }, [tool])
  if (!tool) return null

  const toggle = (name: string) => setPicked((p) => (p.includes(name) ? p.filter((x) => x !== name) : tool.multi ? [...p, name] : [name]))
  const inputs = async (): Promise<Input[]> => {
    const lib: Input[] = []
    for (const n of picked) lib.push({ name: n, bytes: await readLibraryFile(n), fromLibrary: true })
    return [...lib, ...external]
  }
  const fromFiles = async () => {
    const files = await pickFilesBytes(tool.images ? ['image'] : ['pdf'], !!tool.multi || !!tool.images)
    if (tool.images) setImages((s) => [...s, ...files])
    else setExternal((s) => (tool.multi ? [...s, ...files.map((f) => ({ ...f, fromLibrary: false }))] : files.slice(0, 1).map((f) => ({ ...f, fromLibrary: false }))))
    if (!tool.multi) setPicked([])
  }
  const base = (n: string) => n.replace(/\.pdf$/i, '')
  const saveOut = async (desired: string, bytes: Uint8Array) => writeLibraryFile(desired, bytes)

  const run = async () => {
    if (!usePro.getState().require(tool.feature)) return
    setBusy(t('ios.common.processing'))
    try {
      const ins = tool.images ? [] : await inputs()
      if (!tool.images && ins.length === 0) throw new Error(t('ios.tools.selectFile'))
      const first = ins[0]
      const results: string[] = []
      switch (tool.id) {
        case 'merge':
          if (ins.length < 2) throw new Error(t('ios.tools.needTwo'))
          results.push(await saveOut(`${base(first.name)} + ${ins.length - 1}.pdf`, await merge(ins.map((i) => i.bytes))))
          break
        case 'images': {
          if (!images.length) throw new Error(t('ios.tools.imagesHint'))
          const norm = await normalizeImages(images.map((i) => i.bytes))
          results.push(await saveOut(`${base(images[0].name.replace(/\.\w+$/, ''))}.pdf`, await imagesToPdf(norm.map((n) => ({ data: n.bytes, mime: 'image/jpeg' as const })), 'A4')))
          break
        }
        case 'rotate': {
          const count = await pageCount(first.bytes)
          const pages = range.trim() ? parsePageRange(range, count) : 'all'
          results.push(await saveOut(`${base(first.name)}.pdf`, await rotatePages(first.bytes, pages, Number(angle) as 90 | 180 | 270)))
          break
        }
        case 'split': {
          const parts = await split(first.bytes, { every: Math.max(1, parseInt(every, 10) || 1) })
          for (const [i, part] of parts.entries()) results.push(await saveOut(`${base(first.name)} – ${i + 1}.pdf`, part))
          break
        }
        case 'extract': {
          const count = await pageCount(first.bytes)
          results.push(await saveOut(`${base(first.name)} (${range}).pdf`, await extractPages(first.bytes, parsePageRange(range, count))))
          break
        }
        case 'delete': {
          const count = await pageCount(first.bytes)
          results.push(await saveOut(`${base(first.name)}.pdf`, await deletePages(first.bytes, parsePageRange(range, count))))
          break
        }
        case 'reorder': {
          const count = await pageCount(first.bytes)
          const order = range.split(/[,،\s]+/).filter(Boolean).map((n) => Number(n) - 1)
          if (order.length !== count) throw Object.assign(new Error(), { messageKey: 'errors.pdf.bad_order' })
          results.push(await saveOut(`${base(first.name)}.pdf`, await reorderPages(first.bytes, order)))
          break
        }
        case 'watermark':
          results.push(await saveOut(`${base(first.name)}.pdf`, await addWatermark(first.bytes, { text: text.trim() || 'NOVA', opacity: 0.18 })))
          break
        case 'numbers':
          results.push(await saveOut(`${base(first.name)}.pdf`, await addPageNumbers(first.bytes, { position, format: '{n} / {total}' })))
          break
        case 'compress': {
          const out = await compress(first.bytes)
          results.push(await saveOut(`${base(first.name)}.pdf`, out))
          toast(t('tools.compress.result', { before: formatBytes(first.bytes.length), after: formatBytes(out.length) }), 'info')
          break
        }
        case 'ocr': {
          const engine = await loadEngine(first.bytes)
          const res = await ocrPdf(engine, ocrLanguages, (done, total) => setBusy(t('ios.scan.ocrProgress', { page: Math.min(done + 1, total), total })))
          engine.destroy()
          results.push(await saveOut(`${base(first.name)} (OCR).pdf`, res.bytes))
          break
        }
        case 'toText': {
          const engine = await loadEngine(first.bytes)
          const pages: string[] = []
          for (let i = 0; i < engine.pageCount; i++) pages.push(await engine.pageText(i))
          engine.destroy()
          results.push(await writeTextFile(`${base(first.name)}.txt`, pages.join('\n\n')))
          break
        }
      }
      await refresh()
      toast(t('ios.tools.resultSaved', { name: results.length > 1 ? `${results.length} PDF` : results[0] }))
      onClose()
      if (results.length === 1 && results[0].toLowerCase().endsWith('.pdf')) push({ name: 'viewer', file: results[0] }, 'documents')
    } catch (e) {
      toast(errorText(e, t), 'error')
    } finally {
      setBusy(null)
    }
  }

  const needsRange = tool.id === 'extract' || tool.id === 'delete' || tool.id === 'reorder' || tool.id === 'rotate'
  return (
    <Sheet open onClose={onClose} full title={t(TITLE[tool.id][0])} trailing={<button className="text-accent" onClick={onClose}>{t('common.cancel')}</button>}>
      <p className="px-6 pb-4 text-center text-[14px] text-muted">{t(TITLE[tool.id][1])}</p>
      {tool.images ? (
        <Section header={t('ios.tools.imagesHint')}>
          {images.map((img, i) => <div key={i} className="border-b hairline px-4 py-3 text-[15px] last:border-0">{img.name} <span className="text-muted">· {formatBytes(img.bytes.length)}</span></div>)}
          <button onClick={() => void fromFiles()} className="flex h-12 w-full items-center gap-2 px-4 text-accent"><FolderInput className="h-5 w-5" />{t('ios.tools.fromFiles')}</button>
        </Section>
      ) : (
        <>
          <Section header={`${t('ios.tools.fromLibrary')}${picked.length ? ' · ' + t('ios.tools.chosen', { count: picked.length + external.length }) : ''}`}>
            {items.length === 0 && <div className="px-4 py-3 text-[15px] text-muted">{t('ios.docs.emptyTitle')}</div>}
            {items.map((it) => (
              <button key={it.name} onClick={() => toggle(it.name)} className="flex min-h-[48px] w-full items-center gap-3 border-b hairline px-4 text-start last:border-0">
                {picked.includes(it.name) ? <CheckCircle2 className="h-6 w-6 shrink-0 text-accent" /> : <Circle className="h-6 w-6 shrink-0 text-muted/50" />}
                <span className="flex-1 truncate text-[16px]">{base(it.name)}</span>
                {tool.multi && picked.includes(it.name) && <span className="text-[13px] font-semibold text-accent tabular">{picked.indexOf(it.name) + 1}</span>}
              </button>
            ))}
          </Section>
          <Section>
            {external.map((f, i) => <div key={i} className="border-b hairline px-4 py-3 text-[15px]">{f.name}</div>)}
            <button onClick={() => void fromFiles()} className="flex h-12 w-full items-center gap-2 px-4 text-accent"><FolderInput className="h-5 w-5" />{t('ios.tools.fromFiles')}</button>
          </Section>
        </>
      )}
      {(needsRange || tool.id === 'split' || tool.id === 'watermark' || tool.id === 'numbers') && (
        <Section>
          {needsRange && <Field label={tool.id === 'reorder' ? t('tools.reorder.title') : t('tools.pagesRange')} value={range} onChange={setRange} placeholder={tool.id === 'reorder' ? '3,1,2' : '1-3, 5'} inputMode="numeric" dir="ltr" />}
          {tool.id === 'rotate' && <div className="p-3"><Segmented value={angle} onChange={setAngle} options={[{ value: '90', label: '90°' }, { value: '180', label: '180°' }, { value: '270', label: '270°' }]} /></div>}
          {tool.id === 'split' && <Field label={t('tools.every')} value={every} onChange={setEvery} inputMode="numeric" dir="ltr" />}
          {tool.id === 'watermark' && <Field label={t('tools.text')} value={text} onChange={setText} dir="ltr" />}
          {tool.id === 'numbers' && <div className="p-3"><Segmented value={position} onChange={setPosition} options={[{ value: 'bottom-center', label: t('tools.numbers.bottomCenter') }, { value: 'bottom-right', label: t('tools.numbers.bottomRight') }, { value: 'top-center', label: t('tools.numbers.topCenter') }]} /></div>}
        </Section>
      )}
      {tool.id === 'watermark' && <p className="-mt-4 mb-4 px-8 text-[12px] text-muted">Latin text · {t('tools.watermark.desc')}</p>}
      <div className="px-4">
        <Button size="lg" className="w-full" disabled={!!busy} onClick={() => void run()}>{busy ? <><Spinner />{busy}</> : t('ios.tools.run')}</Button>
      </div>
    </Sheet>
  )
}

export default function ToolsScreen() {
  const { t } = useTranslation()
  const isPro = usePro((s) => s.isPro)
  const [active, setActive] = useState<ToolDef | null>(null)
  const refresh = useLibrary((s) => s.refresh)
  useEffect(() => void refresh(), [refresh])
  return (
    <div className="ios-scroll h-full">
      <NavBar title={t('ios.tools.title')} large subtitle={t('ios.tools.subtitle')} />
      <div className="grid grid-cols-2 gap-3 px-4 pb-10 pt-3 sm:grid-cols-3 lg:grid-cols-4">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => (usePro.getState().require(tool.feature) ? setActive(tool) : undefined)}
            className="pressable relative flex min-h-[132px] flex-col items-start rounded-card bg-surface p-4 text-start shadow-card"
          >
            <span className={clsx('grid h-11 w-11 place-items-center rounded-[12px] text-white', tool.color)}>{tool.icon}</span>
            <span className="mt-3 text-[16px] font-semibold leading-tight">{t(TITLE[tool.id][0])}</span>
            <span className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-muted">{t(TITLE[tool.id][1])}</span>
            {!isFeatureAllowed(tool.feature, isPro) && <ProBadge className="absolute end-3 top-3" />}
          </button>
        ))}
      </div>
      <ToolSheet tool={active} onClose={() => setActive(null)} />
    </div>
  )
}
