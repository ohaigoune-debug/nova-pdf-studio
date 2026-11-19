import { blobOf } from '../platform/bytes'
/** عمليات المستندات المشتركة بين الشاشات: استيراد، مشاركة، طباعة، تصدير إلى «الملفات»، مصغرات. */
import { Share } from '@capacitor/share'
import { isNative, NovaDocuments, readNativeFile, type NativeFile } from '../platform/native'
import { cleanImportedName, libraryFileUri, readLibraryFile, writeLibraryFile, writeTempFile } from '../platform/library'
import { PdfEngine } from '@modules/pdf/renderer/pdfEngine'
import { OPS } from 'pdfjs-dist'

export const PDFJS_OPTIONS = { cMapUrl: './pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: './pdfjs/standard_fonts/' }

export function loadEngine(bytes: Uint8Array, password?: string): Promise<PdfEngine> {
  return PdfEngine.load(bytes, password, PDFJS_OPTIONS)
}

/** يستورد ملفات من Files/iCloud (أو صور) إلى مكتبة التطبيق ويعيد الأسماء النهائية. */
export async function importIntoLibrary(files: NativeFile[]): Promise<string[]> {
  const names: string[] = []
  for (const f of files) {
    const bytes = await readNativeFile(f)
    names.push(await writeLibraryFile(cleanImportedName(f.name || '') || 'Document.pdf', bytes))
  }
  return names
}

export async function pickAndImport(types: ('pdf' | 'image')[] = ['pdf']): Promise<string[]> {
  const res = await NovaDocuments.pickFiles({ types, multiple: true })
  if (res.cancelled || res.files.length === 0) return []
  return importIntoLibrary(res.files.filter((f) => /pdf$/i.test(f.mimeType) || /\.pdf$/i.test(f.name)))
}

export async function pickFilesBytes(types: ('pdf' | 'image' | 'spreadsheet' | 'backup')[], multiple: boolean): Promise<{ name: string; bytes: Uint8Array; mimeType: string }[]> {
  const res = await NovaDocuments.pickFiles({ types, multiple })
  if (res.cancelled) return []
  const out = []
  for (const f of res.files) out.push({ name: f.name, bytes: await readNativeFile(f), mimeType: f.mimeType })
  return out
}

export async function shareLibraryFile(name: string): Promise<void> {
  if (isNative()) {
    await Share.share({ title: name, files: [await libraryFileUri(name)] })
  } else {
    downloadBytes(name, await readLibraryFile(name))
  }
}

export async function shareBytes(name: string, bytes: Uint8Array): Promise<void> {
  if (isNative()) await Share.share({ title: name, files: [await writeTempFile(name, bytes)] })
  else downloadBytes(name, bytes)
}

export async function printLibraryFile(name: string): Promise<void> {
  if (isNative()) await NovaDocuments.printPdf({ path: (await libraryFileUri(name)).replace('file://', ''), jobName: name })
  else {
    const url = URL.createObjectURL(blobOf(await readLibraryFile(name), 'application/pdf'))
    await NovaDocuments.printPdf({ path: url, jobName: name })
  }
}

export async function printBytes(name: string, bytes: Uint8Array): Promise<void> {
  if (isNative()) await NovaDocuments.printPdf({ path: (await writeTempFile(name, bytes)).replace('file://', ''), jobName: name })
  else await NovaDocuments.printPdf({ path: URL.createObjectURL(blobOf(bytes, 'application/pdf')), jobName: name })
}

/** «حفظ في الملفات»: يفتح منتقي المواقع (iCloud Drive، On My iPhone، مزودات أخرى). */
export async function exportToFiles(name: string): Promise<boolean> {
  if (!isNative()) {
    downloadBytes(name, await readLibraryFile(name))
    return true
  }
  const res = await NovaDocuments.exportFile({ path: (await libraryFileUri(name)).replace('file://', '') })
  return res.saved
}

export function downloadBytes(name: string, bytes: Uint8Array, type = 'application/octet-stream'): void {
  const url = URL.createObjectURL(blobOf(bytes, type))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

// ------------------------------------------------------------------ مصغرات الصفحة الأولى
const thumbs = new Map<string, Promise<{ url: string; pages: number } | null>>()

export function thumbnail(name: string, modifiedAt: number, width = 180): Promise<{ url: string; pages: number } | null> {
  const key = `${name}@${modifiedAt}@${width}`
  let p = thumbs.get(key)
  if (!p) {
    p = (async () => {
      try {
        const engine = await loadEngine(await readLibraryFile(name))
        const page = await engine.page(0)
        const vp = page.getViewport({ scale: 1 })
        const canvas = document.createElement('canvas')
        const scale = (width * Math.min(2, window.devicePixelRatio || 1)) / vp.width
        const viewport = page.getViewport({ scale })
        canvas.width = Math.round(viewport.width)
        canvas.height = Math.round(viewport.height)
        const ctx = canvas.getContext('2d', { alpha: false })!
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvasContext: ctx, viewport }).promise
        const pages = engine.pageCount
        engine.destroy()
        return { url: canvas.toDataURL('image/jpeg', 0.8), pages }
      } catch {
        return null
      }
    })()
    thumbs.set(key, p)
  }
  return p
}

export function dropThumbnail(name: string): void {
  for (const key of [...thumbs.keys()]) if (key.startsWith(`${name}@`)) thumbs.delete(key)
}

/**
 * «الصفحة ممسوحة؟» — بلا نص تقريبًا **وفيها صورة**. صفحة بيضاء أو أشكال فقط لا تستدعي اقتراح OCR
 * (كان الاقتراح يظهر على الصفحات الفارغة).
 */
export async function looksScanned(engine: PdfEngine, index: number): Promise<boolean> {
  if (!(await engine.isScanned(index))) return false
  const page = await engine.page(index)
  const { fnArray } = await page.getOperatorList()
  return fnArray.some((fn) => IMAGE_OPS.has(fn))
}
const IMAGE_OPS = new Set<number>([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject, OPS.paintImageXObjectRepeat, OPS.paintInlineImageXObjectGroup])

