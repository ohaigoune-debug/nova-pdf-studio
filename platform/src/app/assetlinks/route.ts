/**
 * Digital Asset Links — يُخدَم على /.well-known/assetlinks.json (إعادة كتابة في next.config.ts).
 * يربط النطاق بتطبيق أندرويد (TWA) فيختفي شريط العنوان ويعمل التطبيق ملء الشاشة.
 * البصمة تأتي من مفتاح التوقيع: ANDROID_CERT_FINGERPRINTS (مفصولة بفاصلة — وقّع بمفتاحك
 * ومفتاح Play App Signing معاً). بلا بصمة يُعاد 404 بدل ربط خاطئ.
 */
export const dynamic = 'force-dynamic'

const DEFAULT_PACKAGE = 'dz.madrasa.app'

function fingerprints(): string[] {
  return (process.env.ANDROID_CERT_FINGERPRINTS ?? '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(s))
}

export function GET() {
  const certs = fingerprints()
  if (certs.length === 0) return new Response('Not Found', { status: 404 })
  const body = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: process.env.ANDROID_PACKAGE_NAME || DEFAULT_PACKAGE,
        sha256_cert_fingerprints: certs
      }
    }
  ]
  return Response.json(body, { headers: { 'cache-control': 'public, max-age=300' } })
}
