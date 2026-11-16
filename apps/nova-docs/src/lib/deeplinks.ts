/**
 * روابط novadocs:// — للتنقل المباشر (اختصارات، لقطات المحاكي في CI):
 *   novadocs://tab/<documents|tools|scan|invoices|more>
 *   novadocs://sample          ينشئ مستند PDF تجريبيًا ويفتحه (لا يمس بيانات المستخدم)
 *   novadocs://demo-invoices   يحمّل بيانات الفواتير التجريبية من نسخة Windows
 *   novadocs://invoice         يفتح أول فاتورة تجريبية
 *   novadocs://annotated       مستند تجريبي عليه تظليل ونص وكتابة يدوية وتعليق (لقطات المتجر)
 *   novadocs://lang/ar · theme/dark · paywall · settings
 * ويمكن تمرير عدة مسارات مفصولة بفواصل عبر window.novaOpen('lang/ar,sample') (نسخة Debug في CI).
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { TABS, type Tab, useNav } from '../stores/nav'
import { useLibrary } from '../stores/library'
import { writeLibraryFile } from '../platform/library'
import { ensureDatabase } from '../platform/db'
import { applyEdits } from '@modules/pdf/shared/applyEdits'
import { applyInk } from './ink'
import { addNoteAnnotations } from './annotations'
import { usePrefs } from '../stores/prefs'
import { usePro } from '../stores/proInstance'
import { LANGUAGES, type Language } from '@shared/settings'

async function samplePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 0; i < 3; i++) {
    const p = doc.addPage([595.28, 841.89])
    p.drawRectangle({ x: 0, y: 781, width: 595.28, height: 61, color: rgb(0.07, 0.24, 0.21) })
    p.drawText('NOVA Docs — Sample agreement', { x: 48, y: 805, size: 20, font: bold, color: rgb(1, 1, 1) })
    p.drawText(`Page ${i + 1} of 3`, { x: 48, y: 740, size: 12, font, color: rgb(0.3, 0.3, 0.3) })
    const lines = ['This sample document was generated on your device.', 'Use Edit to add text, highlights, comments, a signature', 'or handwriting with Apple Pencil, then save.', 'Everything stays on your iPhone or iPad.']
    lines.forEach((l, k) => p.drawText(l, { x: 48, y: 700 - k * 22, size: 13, font }))
  }
  return doc.save()
}

export async function handleDeepLink(url: string): Promise<void> {
  const u = new URL(url.replace('novadocs://', 'https://nova.local/'))
  const [kind, arg] = u.pathname.split('/').filter(Boolean)
  const nav = useNav.getState()
  if (kind === 'tab' && TABS.includes(arg as Tab)) {
    nav.popToRoot(arg as Tab)
    if (nav.tab !== arg) nav.setTab(arg as Tab)
  } else if (kind === 'sample') {
    const name = await writeLibraryFile('NOVA Sample.pdf', await samplePdf())
    await useLibrary.getState().refresh()
    nav.push({ name: 'viewer', file: name }, 'documents')
  } else if (kind === 'annotated') {
    let bytes = await samplePdf()
    bytes = await applyEdits(bytes, { objects: [
      { id: 'h1', kind: 'highlight', page: 0, x: 46, y: 136, width: 330, height: 18, color: '#FFE066', opacity: 0.5 },
      { id: 't1', kind: 'text', page: 0, x: 48, y: 260, width: 300, height: 24, text: 'Approved - ready to sign', fontSize: 16, fontFamily: 'sans', bold: true, italic: false, underline: false, align: 'left', color: '#123D36', background: null, direction: 'ltr' },
      { id: 'r1', kind: 'rect', page: 0, x: 40, y: 250, width: 320, height: 40, stroke: '#17B890', strokeWidth: 2, fill: null, opacity: 1 }
    ] })
    const pts: [number, number][] = Array.from({ length: 40 }, (_, i) => [360 + i * 4, 330 + Math.sin(i / 3) * 10 - i * 0.6])
    bytes = await applyInk(bytes, [{ id: 'i1', page: 0, points: pts, color: '#1D4ED8', width: 2.4, opacity: 1 }])
    bytes = await addNoteAnnotations(bytes, [{ id: 'n1', page: 0, x: 500, y: 130, text: 'Check the total', author: 'NOVA' }])
    const name = await writeLibraryFile('Agreement (signed).pdf', bytes)
    await useLibrary.getState().refresh()
    nav.push({ name: 'viewer', file: name }, 'documents')
  } else if (kind === 'lang' && LANGUAGES.some((l) => l.code === arg)) {
    await usePrefs.getState().setLanguage(arg as Language)
  } else if (kind === 'theme' && (arg === 'dark' || arg === 'light' || arg === 'system')) {
    usePrefs.getState().setTheme(arg)
  } else if (kind === 'settings') {
    nav.popToRoot('more')
    nav.setTab('more')
    nav.push({ name: 'settings' }, 'more')
  } else if (kind === 'paywall') {
    usePro.getState().openPaywall(null)
  } else if (kind === 'invoice') {
    await ensureDatabase()
    const { listInvoices } = await import('@modules/invoices/main/repository')
    const first = listInvoices({ limit: 1, sort: 'date_desc' }).rows[0]
    if (first) nav.push({ name: 'invoiceView', id: first.id }, 'invoices')
  } else if (kind === 'tool' && arg) {
    nav.popToRoot('tools')
    nav.setTab('tools')
    const { useToolSheet } = await import('../features/tools/ToolsScreen')
    useToolSheet.getState().open(arg as never)
  } else if (kind === 'demo-invoices') {
    await ensureDatabase()
    const { demoStatus, loadDemoData } = await import('@modules/database/main/demo-data')
    if (!demoStatus().loaded) loadDemoData()
    nav.popToRoot('invoices')
    nav.setTab('invoices')
  }
}

/** نقطة دخول للأتمتة (CI): عدة مسارات مفصولة بفواصل تُنفَّذ بالترتيب. */
export async function openRoutes(routes: string): Promise<void> {
  for (const r of routes.split(',').map((x) => x.trim()).filter(Boolean)) {
    try {
      if (r === 'scan-demo') {
        if (!window.__NOVA_DEBUG__) throw new Error('self-test is available in Debug builds only')
        const { runScanDemo } = await import('./selftest')
        await runScanDemo()
        useNav.getState().popToRoot('scan')
        useNav.getState().setTab('scan')
        console.log(`[nova-route] ok ${r}`)
        continue
      }
      if (r === 'filter-timing') {
        if (!window.__NOVA_DEBUG__) throw new Error('self-test is available in Debug builds only')
        const res = await (await import('./selftest')).runFilterTiming()
        const { confirmDialog } = await import('../ui/overlays')
        void confirmDialog('Scan filter timing · WKWebView', { message: JSON.stringify(res, null, 1) })
        continue
      }
      if (r === 'fonts-selftest') {
        if (!window.__NOVA_DEBUG__) throw new Error('self-test is available in Debug builds only')
        const res = await (await import('./selftest')).runFontsSelfTest()
        useNav.getState().push({ name: 'viewer', file: res.file }, 'documents')
        console.log(`[nova-route] ok ${r} ${JSON.stringify(res)}`)
        continue
      }
      if (r === 'ocr-selftest' || r === 'invoice-pdf-selftest') {
        // نسخة Debug فقط: العلم يضعه NovaBridgeViewController داخل #if DEBUG؛ لا يصل إليه أي رابط خارجي
        if (!window.__NOVA_DEBUG__) throw new Error('self-test is available in Debug builds only')
        const st = await import('./selftest')
        const res = r === 'ocr-selftest' ? await st.runOcrSelfTest() : await st.runInvoicePdfSelfTest()
        if (r === 'invoice-pdf-selftest') useNav.getState().push({ name: 'viewer', file: String(res.file) }, 'documents')
        const { confirmDialog } = await import('../ui/overlays')
        void confirmDialog(r === 'ocr-selftest' ? 'OCR self-test · Tesseract WASM in WKWebView' : 'Invoice PDF self-test · native WebKit export', { message: JSON.stringify(res, null, 1) })
        console.log(`[nova-route] ok ${r}`)
        continue
      }
      await handleDeepLink(`novadocs://${r}`)
      console.log(`[nova-route] ok ${r}`)
    } catch (e) {
      // يظهر في سجل التطبيق وفي اللقطة نفسها لتشخيص أي فشل على iOS الحقيقي
      const err = e as { message?: string; code?: string; stack?: string }
      console.error(`[nova-route] FAILED ${r}: ${err?.code ?? ''} ${err?.message ?? String(e)}\n${err?.stack ?? ''}`)
      const { toast } = await import('../ui/overlays')
      toast(`route ${r}: ${err?.message ?? String(e)}`, 'error')
    }
    await new Promise((res) => setTimeout(res, 400))
  }
}
