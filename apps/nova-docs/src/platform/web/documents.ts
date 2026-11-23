import { WebPlugin } from '@capacitor/core'
import type { NativeFile, NovaDocumentsPlugin } from '../native'
import { pickWebFiles } from './pick'

/** ملفات الويب تُمرَّر كعناوين blob: يقرؤها readNativeFile عبر fetch. */
export class WebDocuments extends WebPlugin implements Omit<NovaDocumentsPlugin, 'addListener'> {
  async pickFiles(options: { types: string[]; multiple?: boolean }) {
    const accept = [
      options.types.includes('pdf') ? 'application/pdf,.pdf' : '',
      options.types.includes('image') ? 'image/*' : '',
      options.types.includes('spreadsheet') ? '.xlsx,.xls,.csv' : '',
      options.types.includes('backup') ? '.novabackup,.sqlite' : ''
    ].filter(Boolean).join(',')
    const files = await pickWebFiles(accept, !!options.multiple)
    const out: NativeFile[] = files.map((f) => ({ path: f.url, webPath: f.url, name: f.name, size: f.bytes.length, mimeType: f.mimeType }))
    return { files: out, cancelled: out.length === 0 }
  }

  async exportFile(options: { path: string }) {
    const a = document.createElement('a')
    a.href = options.path
    a.download = options.path.split('/').pop() ?? 'document'
    a.click()
    return { saved: true }
  }

  async importUrl(options: { url: string }): Promise<NativeFile> {
    return { path: options.url, webPath: options.url, name: options.url.split('/').pop() ?? 'file', size: 0, mimeType: 'application/octet-stream' }
  }

  async printPdf(options: { path: string }) {
    const frame = document.createElement('iframe')
    frame.style.display = 'none'
    frame.src = options.path
    document.body.appendChild(frame)
    await new Promise((r) => (frame.onload = r))
    frame.contentWindow?.print()
    setTimeout(() => frame.remove(), 60_000)
    return { completed: true }
  }

  async htmlToPdf(): Promise<NativeFile> {
    throw this.unavailable('HTML → PDF is only available in the iOS app (WKWebView renderer).')
  }
}
