import { createReadStream } from 'node:fs'
import { Readable } from 'node:stream'
import { CONFIRM_APK_FILENAME, apkInfo, apkPath } from '@/server/lib/android-apk'

export const dynamic = 'force-dynamic'

/**
 * تحميل تطبيق عامل التأكيد (أندرويد) — 404 ما دام لم يُبنَ بعد.
 * التطبيق غلاف لصفحات /worker، والدخول فيه بحساب موظف؛ الملف نفسه لا يكشف شيئًا.
 */
export async function GET() {
  const info = await apkInfo(CONFIRM_APK_FILENAME)
  if (!info) return new Response('Not Found', { status: 404 })
  const body = Readable.toWeb(createReadStream(apkPath(CONFIRM_APK_FILENAME))) as ReadableStream
  return new Response(body, {
    headers: {
      'content-type': 'application/vnd.android.package-archive',
      'content-length': String(info.size),
      'content-disposition': `attachment; filename="${CONFIRM_APK_FILENAME}"`,
      'cache-control': 'no-cache',
      'last-modified': info.updatedAt.toUTCString()
    }
  })
}
