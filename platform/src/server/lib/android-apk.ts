/**
 * ملف تطبيق أندرويد المنشور للتحميل المباشر (بلا متجر).
 * يضعه scripts/build-android.sh في مجلد البيانات الدائم، فيبقى بعد إعادة بناء الصورة،
 * ويظهر زر التحميل تلقائياً ما دام الملف موجوداً.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { headers } from 'next/headers'

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

/**
 * هل يُعرض زرّ تحميل التطبيق؟ الملف منشور، والزائر ليس داخل التطبيق نفسه.
 * onlyAndroid: في لوحة التلميذ لا معنى للزرّ على حاسوب أو آيفون.
 */
export async function appDownload(opts: { onlyAndroid?: boolean } = {}): Promise<{ size: number } | null> {
  const [info, h] = await Promise.all([apkInfo(), headers()])
  if (!info || h.get('x-madrasa-app') === '1') return null
  if (opts.onlyAndroid && !/android/i.test(h.get('user-agent') ?? '')) return null
  return { size: info.size }
}

export function apkSizeMb(size: number): string {
  return Math.max(0.1, size / 1048576).toFixed(1)
}
