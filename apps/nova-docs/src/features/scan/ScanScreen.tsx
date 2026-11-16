/**
 * قسم «المسح»: كاميرا المستندات الأصلية من Apple (كشف الحواف + تصحيح المنظور + القص + تعدد الصفحات)،
 * ثم مراجعة: مرشحات تحسين الإضاءة، تدوير، حذف، إضافة صفحات، OCR اختياري، وحفظ PDF.
 */
import clsx from 'clsx'
import { Camera, ImagePlus, Plus, RotateCw, ScanLine, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { create } from 'zustand'
import { NovaScanner, readNativeFile } from '../../platform/native'
import { blobOf } from '../../platform/bytes'
import { writeLibraryFile } from '../../platform/library'
import { filterImageBytes, type ScanFilter } from '../../lib/enhance'
import { scanImagesToPdf } from '../../lib/scanPdf'
import { recognizeRobust } from '../../lib/ocr'
import { makeSearchablePdf, OCR_LANGS, type OcrLanguage, type PageOcrInput } from '../../lib/ocrCore'
import { loadArabicFont } from '../../lib/ocrDocument'
import { pickFilesBytes } from '../../lib/docs'
import { usePro } from '../../stores/proInstance'
import { usePrefs } from '../../stores/prefs'
import { useNav } from '../../stores/nav'
import { useLibrary } from '../../stores/library'
import { isFeatureAllowed } from '../../lib/features'
import { intlLocaleOf } from '@shared/settings'
import { Button, Field, NavBar, ProBadge, Section, Segmented, Spinner, Toggle } from '../../ui/kit'
import { confirmDialog, errorText, toast } from '../../ui/overlays'
import { normalizeImages, rotateImage } from './images'

interface ScanPage { id: string; original: Uint8Array; width: number; height: number; rendered?: { filter: ScanFilter; bytes: Uint8Array; url: string; width: number; height: number } }

interface ScanSession {
  pages: ScanPage[]
  filter: ScanFilter
  ocr: boolean
  set: (p: Partial<Omit<ScanSession, 'set'>>) => void
}
const useScan = create<ScanSession>((set) => ({ pages: [], filter: 'original', ocr: false, set: (p) => set(p) }))
let seq = 0

async function render(page: ScanPage, filter: ScanFilter): Promise<NonNullable<ScanPage['rendered']>> {
  if (page.rendered?.filter === filter) return page.rendered
  const out = await filterImageBytes(page.original, filter)
  return { filter, bytes: out.bytes, width: out.width, height: out.height, url: URL.createObjectURL(blobOf(out.bytes, 'image/jpeg')) }
}

export default function ScanScreen() {
  const { t } = useTranslation()
  const { pages, filter, ocr, set } = useScan()
  const isPro = usePro((s) => s.isPro)
  const { language, ocrLanguages, setOcrLanguages } = usePrefs()
  const push = useNav((s) => s.push)
  const [supported, setSupported] = useState<boolean | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const defaultName = t('ios.scan.defaultName', { date: new Intl.DateTimeFormat(intlLocaleOf(language), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()).replace(/[/:]/g, '-') })
  const [name, setName] = useState('')

  useEffect(() => {
    void NovaScanner.isSupported().then((r) => setSupported(r.supported)).catch(() => setSupported(false))
  }, [])

  // تطبيق المرشح على كل الصفحات (مع ذاكرة مؤقتة لكل صفحة)
  useEffect(() => {
    let alive = true
    void (async () => {
      const next: ScanPage[] = []
      for (const p of useScan.getState().pages) next.push({ ...p, rendered: await render(p, filter) })
      if (alive) set({ pages: next })
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, pages.length])

  const addImages = async (list: { bytes: Uint8Array }[]) => {
    const norm = await normalizeImages(list.map((l) => l.bytes), 3000)
    const added = norm.map((n) => ({ id: `p${++seq}`, original: n.bytes, width: n.width, height: n.height }))
    set({ pages: [...useScan.getState().pages, ...added] })
    if (!name) setName(defaultName)
  }

  const scan = async () => {
    try {
      if (supported) {
        const res = await NovaScanner.scan({ quality: 0.9 })
        if (res.cancelled || !res.pages.length) return
        const list = []
        for (const p of res.pages) list.push({ bytes: await readNativeFile(p) })
        await addImages(list)
        if (res.title && !name) setName(res.title)
      } else {
        const files = await pickFilesBytes(['image'], true)
        if (files.length) await addImages(files)
      }
    } catch (e) {
      toast(errorText(e, t), 'error')
    }
  }

  const rotate = async (id: string) => {
    const p = pages.find((x) => x.id === id)
    if (!p) return
    const r = await rotateImage(p.original, 1)
    set({ pages: pages.map((x) => (x.id === id ? { id, original: r.bytes, width: r.width, height: r.height } : x)) })
  }

  const discard = async () => {
    if (await confirmDialog(t('ios.scan.discard'), { destructive: true })) {
      pages.forEach((p) => p.rendered && URL.revokeObjectURL(p.rendered.url))
      set({ pages: [], filter: 'original', ocr: false })
      setName('')
    }
  }

  const save = async () => {
    setBusy(t('ios.scan.saving'))
    try {
      const rendered = []
      for (const p of pages) rendered.push(await render(p, filter))
      const title = (name || defaultName).trim()
      let { bytes, sizes } = await scanImagesToPdf(rendered.map((r) => ({ jpeg: r.bytes, width: r.width, height: r.height })), title)
      if (ocr && usePro.getState().require('ocr')) {
        const ocrPages: PageOcrInput[] = []
        for (const [i, r] of rendered.entries()) {
          setBusy(t('ios.scan.ocrProgress', { page: i + 1, total: rendered.length }))
          const res = await recognizeRobust(r.bytes, { width: r.width, height: r.height }, ocrLanguages)
          ocrPages.push({ index: i, result: res, pageWidthPt: sizes[i].w, pageHeightPt: sizes[i].h })
        }
        bytes = await makeSearchablePdf(bytes, ocrPages, await loadArabicFont())
      }
      const saved = await writeLibraryFile(`${title}.pdf`, bytes)
      pages.forEach((p) => p.rendered && URL.revokeObjectURL(p.rendered.url))
      set({ pages: [], filter: 'original', ocr: false })
      setName('')
      await useLibrary.getState().refresh()
      toast(t('ios.scan.saved', { name: saved }))
      push({ name: 'viewer', file: saved }, 'documents')
      sizes = []
    } catch (e) {
      toast(errorText(e, t), 'error')
    } finally {
      setBusy(null)
    }
  }

  if (pages.length === 0) {
    return (
      <div className="ios-scroll h-full">
        <NavBar title={t('ios.scan.title')} large />
        <div className="mx-4 mt-4 overflow-hidden rounded-[24px] bg-gradient-to-br from-[#123D36] to-[#0B2621] p-6 text-white shadow-card">
          <div className="grid h-16 w-16 place-items-center rounded-[18px] bg-white/12"><ScanLine className="h-9 w-9 text-[#2FD3A8]" /></div>
          <h2 className="mt-5 text-[26px] font-bold leading-tight">{t('ios.scan.start')}</h2>
          <p className="mt-2 text-[15px] text-white/75">{t('ios.scan.subtitle')}</p>
          <button onClick={() => void scan()} className="pressable mt-6 flex h-[52px] w-full items-center justify-center gap-2 rounded-ios bg-[#17B890] text-[17px] font-semibold text-white">
            <Camera className="h-5 w-5" />{t('ios.scan.start')}
          </button>
          <button onClick={() => void pickFilesBytes(["image"], true).then(async (f) => { if (f.length) await addImages(f) })} className="pressable mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-ios bg-white/10 text-[16px] font-medium">
            <ImagePlus className="h-5 w-5" />{t('ios.scan.importPhotos')}
          </button>
        </div>
        {supported === false && <p className="px-8 py-4 text-center text-[13px] text-muted">{t('ios.scan.unsupported')}</p>}
        <ul className="mx-6 mt-6 space-y-2 text-[14px] text-muted">
          <li>• {t('ios.scan.filters.enhanced')} · {t('ios.scan.filters.bw')} · {t('ios.scan.filters.grayscale')}</li>
          <li>• {t('ios.scan.searchable')} — العربية · Français · English</li>
          <li>• {t('ios.common.offline')}</li>
        </ul>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <NavBar title={t('ios.scan.pages', { count: pages.length })} leading={<button className="px-2 text-[17px] text-danger" onClick={() => void discard()}>{t('common.cancel')}</button>} trailing={<button className="flex items-center gap-1 px-2 text-[17px] text-accent" onClick={() => void scan()}><Plus className="h-5 w-5" />{t('ios.scan.addMore')}</button>} />
      <div className="ios-scroll min-h-0 flex-1 pb-6">
        <div className="px-4 pt-3">
          <Segmented
            value={filter}
            onChange={(f) => (f === 'original' || usePro.getState().require('scanFilters') ? set({ filter: f }) : undefined)}
            options={(['original', 'enhanced', 'grayscale', 'bw'] as ScanFilter[]).map((f) => ({ value: f, label: <span className="inline-flex items-center gap-1">{t(`ios.scan.filters.${f}`)}{f !== 'original' && !isFeatureAllowed('scanFilters', isPro) && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}</span> }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 px-4 py-4 sm:grid-cols-3 lg:grid-cols-4">
          {pages.map((p, i) => (
            <div key={p.id} className="flex flex-col items-center">
              <div className="pdf-page relative w-full overflow-hidden rounded-[6px]" style={{ aspectRatio: `${p.width} / ${p.height}` }}>
                {p.rendered ? <img src={p.rendered.url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><Spinner className="text-accent" /></div>}
                <span className="absolute bottom-1 start-1 rounded bg-black/55 px-1.5 text-[11px] font-semibold text-white">{i + 1}</span>
              </div>
              <div className="mt-1 flex gap-1">
                <button aria-label={t('ios.pages.rotate')} onClick={() => void rotate(p.id)} className="grid h-9 w-9 place-items-center rounded-full text-accent"><RotateCw className="h-5 w-5" /></button>
                <button aria-label={t('ios.pages.delete')} onClick={() => set({ pages: pages.filter((x) => x.id !== p.id) })} className="grid h-9 w-9 place-items-center rounded-full text-danger"><Trash2 className="h-5 w-5" /></button>
              </div>
            </div>
          ))}
        </div>
        <Section>
          <Field label={t('ios.common.name')} value={name} onChange={setName} placeholder={defaultName} />
        </Section>
        <Section footer={t('ios.scan.searchableHint')}>
          <div className="flex min-h-[48px] items-center gap-3 px-4">
            <span className="flex flex-1 items-center gap-2 text-[17px]">{t('ios.scan.searchable')}{!isFeatureAllowed('ocr', isPro) && <ProBadge />}</span>
            <Toggle checked={ocr} onChange={(v) => (!v || usePro.getState().require('ocr') ? set({ ocr: v }) : undefined)} label={t('ios.scan.searchable')} />
          </div>
          {ocr && (
            <div className="flex gap-2 border-t hairline px-4 py-3">
              {OCR_LANGS.map((l: OcrLanguage) => (
                <button key={l} onClick={() => setOcrLanguages(ocrLanguages.includes(l) ? ocrLanguages.filter((x) => x !== l) : [...ocrLanguages, l])} className={clsx('h-8 rounded-full px-3 text-[14px] font-medium', ocrLanguages.includes(l) ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-muted')}>
                  {l === 'ara' ? 'العربية' : l === 'fra' ? 'Français' : 'English'}
                </button>
              ))}
            </div>
          )}
        </Section>
      </div>
      <div className="glass border-t hairline px-4 pt-3" style={{ paddingBottom: 'calc(var(--safe-bottom) + 12px)' }}>
        <Button size="lg" className="w-full" disabled={!!busy} onClick={() => void save()}>{busy ? <><Spinner />{busy}</> : t('ios.scan.save')}</Button>
      </div>
    </div>
  )
}
