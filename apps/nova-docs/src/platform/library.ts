/**
 * مكتبة المستندات: ملفات PDF الحقيقية في مجلد Documents الخاص بالتطبيق.
 * بفضل UIFileSharingEnabled + LSSupportsOpeningDocumentsInPlace يظهر هذا المجلد في تطبيق «الملفات»
 * باسم NOVA Docs (على الجهاز أو iCloud Drive حسب إعداد المستخدم في النسخ الاحتياطي)، فلا تُحبس الملفات داخل التطبيق.
 */
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { base64ToBytes, bytesToBase64 } from './bytes'

export interface LibraryItem {
  name: string
  size: number
  modifiedAt: number
  kind: 'pdf' | 'image' | 'sheet' | 'other'
}

const DIR = Directory.Documents
const META = '.nova'

function kindOf(name: string): LibraryItem['kind'] {
  const ext = name.toLowerCase().split('.').pop() ?? ''
  if (ext === 'pdf') return 'pdf'
  if (['png', 'jpg', 'jpeg', 'heic'].includes(ext)) return 'image'
  if (['xlsx', 'xls', 'csv'].includes(ext)) return 'sheet'
  return 'other'
}

export function sanitizeName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').trim()
  return cleaned || 'Document'
}

export async function listLibrary(): Promise<LibraryItem[]> {
  try {
    const res = await Filesystem.readdir({ path: '', directory: DIR })
    return res.files
      .filter((f) => f.type === 'file' && !f.name.startsWith('.'))
      .map((f) => ({ name: f.name, size: f.size, modifiedAt: Number(f.mtime) || 0, kind: kindOf(f.name) }))
      .sort((a, b) => b.modifiedAt - a.modifiedAt)
  } catch {
    return []
  }
}

async function exists(name: string): Promise<boolean> {
  try {
    await Filesystem.stat({ path: name, directory: DIR })
    return true
  } catch {
    return false
  }
}

/** اسم غير مستعمل: "Contract.pdf" → "Contract (2).pdf". */
export async function uniqueName(desired: string): Promise<string> {
  const name = sanitizeName(desired)
  if (!(await exists(name))) return name
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base} (${i})${ext}`
    if (!(await exists(candidate))) return candidate
  }
  return `${base}-${Date.now()}${ext}`
}

export async function readLibraryFile(name: string): Promise<Uint8Array> {
  const res = await Filesystem.readFile({ path: name, directory: DIR })
  return typeof res.data === 'string' ? base64ToBytes(res.data) : new Uint8Array(await (res.data as Blob).arrayBuffer())
}

/** حفظ ذرّي: كتابة ملف مؤقت ثم إعادة تسميته فوق الأصل (لا يفسد الملف إن انقطع التطبيق أثناء الحفظ). */
export async function writeLibraryFile(name: string, bytes: Uint8Array, options: { overwrite?: boolean } = {}): Promise<string> {
  const target = options.overwrite ? sanitizeName(name) : await uniqueName(name)
  // مهم على iOS: IONFilesystemLib يعامل المسار غير الموجود بلا امتداد كمجلد (يضيف «/») فتفشل الكتابة؛
  // لذلك يحمل الملف المؤقت امتدادًا صريحًا.
  const temp = `${META}-tmp-${Date.now()}.part`
  await Filesystem.writeFile({ path: temp, directory: DIR, data: bytesToBase64(bytes) })
  try {
    if (options.overwrite && (await exists(target))) await Filesystem.deleteFile({ path: target, directory: DIR })
    await Filesystem.rename({ from: temp, to: target, directory: DIR, toDirectory: DIR })
  } catch (error) {
    await Filesystem.deleteFile({ path: temp, directory: DIR }).catch(() => undefined)
    throw error
  }
  return target
}

export async function deleteLibraryFile(name: string): Promise<void> {
  await Filesystem.deleteFile({ path: name, directory: DIR })
}

export async function renameLibraryFile(from: string, to: string): Promise<string> {
  const ext = from.includes('.') ? from.slice(from.lastIndexOf('.')) : ''
  const desired = to.toLowerCase().endsWith(ext.toLowerCase()) ? to : `${to}${ext}`
  const target = await uniqueName(desired)
  await Filesystem.rename({ from, to: target, directory: DIR, toDirectory: DIR })
  return target
}

/** مسار ملف داخل المكتبة صالح للإضافات الأصلية (طباعة/مشاركة/تصدير). */
export async function libraryFileUri(name: string): Promise<string> {
  const res = await Filesystem.getUri({ path: name, directory: DIR })
  return res.uri
}

/** يكتب نسخة مؤقتة في Cache (للمشاركة/الطباعة دون تعديل المكتبة). */
export async function writeTempFile(name: string, bytes: Uint8Array): Promise<string> {
  const path = `share/${sanitizeName(name)}`
  await Filesystem.writeFile({ path, directory: Directory.Cache, data: bytesToBase64(bytes), recursive: true })
  return (await Filesystem.getUri({ path, directory: Directory.Cache })).uri
}

export async function writeTextFile(name: string, text: string): Promise<string> {
  const target = await uniqueName(name)
  await Filesystem.writeFile({ path: target, directory: DIR, data: text, encoding: Encoding.UTF8 })
  return target
}
