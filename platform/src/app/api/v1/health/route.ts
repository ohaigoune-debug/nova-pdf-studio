export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/health — فحص صحة خفيف لـ Docker HEALTHCHECK ومراقبات التوفّر.
 * يثبت أن عملية Node تستجيب، بلا بناء صفحة ولا استعلام قاعدة: كان الفحص القديم يبني
 * صفحة /login كاملة كل 30 ثانية. لا يكشف أي معلومة عن النظام.
 */
export function GET() {
  return new Response('ok', { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } })
}
