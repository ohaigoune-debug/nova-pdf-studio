import { createReadStream } from 'node:fs'
import { Readable } from 'node:stream'
import { APK_FILENAME, apkInfo, apkPath } from '@/server/lib/android-apk'

export const dynamic = 'force-dynamic'

/** تحميل تطبيق أندرويد للتلاميذ — 404 ما دام لم يُبنَ بعد */
export async function GET() {
  const info = await apkInfo()
  if (!info) return new Response('Not Found', { status: 404 })
  const body = Readable.toWeb(createReadStream(apkPath())) as ReadableStream
  return new Response(body, {
    headers: {
      'content-type': 'application/vnd.android.package-archive',
      'content-length': String(info.size),
      'content-disposition': `attachment; filename="${APK_FILENAME}"`,
      'cache-control': 'no-cache',
      'last-modified': info.updatedAt.toUTCString()
    }
  })
}
