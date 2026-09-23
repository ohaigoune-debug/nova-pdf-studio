/**
 * ملف تطبيق أندرويد المنشور للتحميل المباشر (بلا متجر).
 * يضعه scripts/build-android.sh في مجلد البيانات الدائم، فيبقى بعد إعادة بناء الصورة،
 * ويظهر زر التحميل تلقائياً ما دام الملف موجوداً.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'

export const APK_FILENAME = 'madrasa.apk'

export function apkPath(): string {
  return path.resolve(process.cwd(), process.env.DOWNLOADS_DIR ?? 'data/downloads', APK_FILENAME)
}

export async function apkInfo(): Promise<{ size: number; updatedAt: Date } | null> {
  try {
    const st = await fs.stat(apkPath())
    return st.isFile() && st.size > 0 ? { size: st.size, updatedAt: st.mtime } : null
  } catch {
    return null
  }
}
