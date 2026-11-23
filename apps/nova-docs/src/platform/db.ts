/**
 * فتح قاعدة بيانات الفواتير/الجداول على الجهاز: ملف SQLite في Library (يُنسخ احتياطيًا مع iCloud Backup
 * ولا يظهر للمستخدم في «الملفات»)، كتابة ذرّية (مؤقت ثم إعادة تسمية).
 */
import { Directory, Filesystem } from '@capacitor/filesystem'
import { openDatabase } from '../platform/shims/database-main'
import type { DbStorage } from '../platform/shims/sqlite-browser'
import { seedBuiltinTemplates } from '@modules/templates/main/repository'
import { refreshOverdue } from '@modules/invoices/main/repository'
import { base64ToBytes, bytesToBase64 } from './bytes'

const FILE = 'NovaData/nova.sqlite'

export const deviceStorage: DbStorage = {
  async read() {
    try {
      const res = await Filesystem.readFile({ path: FILE, directory: Directory.Library })
      return typeof res.data === 'string' ? base64ToBytes(res.data) : new Uint8Array(await (res.data as Blob).arrayBuffer())
    } catch {
      return null
    }
  },
  async write(bytes) {
    const tmp = `${FILE}.tmp`
    await Filesystem.writeFile({ path: tmp, directory: Directory.Library, data: bytesToBase64(bytes), recursive: true })
    await Filesystem.deleteFile({ path: FILE, directory: Directory.Library }).catch(() => undefined)
    await Filesystem.rename({ from: tmp, to: FILE, directory: Directory.Library, toDirectory: Directory.Library })
  }
}

let opening: Promise<void> | null = null

export function ensureDatabase(): Promise<void> {
  if (!opening) {
    opening = (async () => {
      await openDatabase(deviceStorage, './sqljs')
      seedBuiltinTemplates()
      refreshOverdue()
    })()
  }
  return opening
}
