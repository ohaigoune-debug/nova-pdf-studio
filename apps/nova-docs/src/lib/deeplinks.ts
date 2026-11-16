/**
 * روابط novadocs:// — للتنقل المباشر (اختصارات، لقطات المحاكي في CI):
 *   novadocs://tab/<documents|tools|scan|invoices|more>
 *   novadocs://sample          ينشئ مستند PDF تجريبيًا ويفتحه (لا يمس بيانات المستخدم)
 *   novadocs://demo-invoices   يحمّل بيانات الفواتير التجريبية من نسخة Windows
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { TABS, type Tab, useNav } from '../stores/nav'
import { useLibrary } from '../stores/library'
import { writeLibraryFile } from '../platform/library'
import { ensureDatabase } from '../platform/db'

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
  } else if (kind === 'demo-invoices') {
    await ensureDatabase()
    const { demoStatus, loadDemoData } = await import('@modules/database/main/demo-data')
    if (!demoStatus().loaded) loadDemoData()
    nav.popToRoot('invoices')
    nav.setTab('invoices')
  }
}
