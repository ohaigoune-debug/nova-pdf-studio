/** وساطة Cloudflare (السحابة البرتقالية): عنوان التلميذ الحقيقي، بلا تزوير، ودون لمس Caddy المشترك */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { clientIp, cloudflareHop } from '@/server/lib/client-ip'
import { CLOUDFLARE_IPV4, CLOUDFLARE_IPV6, isCloudflareIp } from '@/server/lib/cloudflare-ips'

const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null })
const STUDENT = '105.235.135.160'
const CF = '162.158.12.34'

describe('نطاقات Cloudflare', () => {
  it('يعرف عناوين Cloudflare في IPv4 وIPv6، وحدود كل نطاق', () => {
    for (const ip of ['173.245.48.1', '104.21.3.184', '172.67.131.22', '162.159.255.254', '131.0.75.255', '2606:4700::6810:84e5', '2a06:98c7:ffff::1', '::ffff:104.16.0.1']) expect(isCloudflareIp(ip), ip).toBe(true)
    for (const ip of [STUDENT, '80.241.219.166', '197.200.1.9', '104.15.255.255', '172.72.0.0', '131.0.76.0', '2a02:8440::1', '::ffff:80.241.219.166', 'not-an-ip', '']) expect(isCloudflareIp(ip), ip).toBe(false)
  })

  it('القائمة كاملة كما في cloudflare.com/ips ومتطابقة مع دليل النشر', () => {
    expect(CLOUDFLARE_IPV4).toHaveLength(15)
    expect(CLOUDFLARE_IPV6).toHaveLength(7)
    const doc = readFileSync(join(__dirname, '..', 'docs', 'DEPLOYMENT.md'), 'utf8')
    for (const c of [...CLOUDFLARE_IPV4, ...CLOUDFLARE_IPV6]) expect(doc, c).toContain(c)
  })
})

describe('عنوان التلميذ خلف Cloudflare', () => {
  it('السحابة البرتقالية: Caddy يرى Cloudflare، فنأخذ عنوان التلميذ من CF-Connecting-IP', () => {
    expect(clientIp(h({ 'x-real-ip': CF, 'cf-connecting-ip': STUDENT }))).toBe(STUDENT)
    expect(clientIp(h({ 'x-real-ip': '2400:cb00:2049::1', 'cf-connecting-ip': '2a02:8440::7' }))).toBe('2a02:8440::7')
  })

  it('تلميذان عبر مركز Cloudflare نفسه يبقيان عنوانين مختلفين (لا يتقاسمان حدود المحاولات)', () => {
    const a = clientIp(h({ 'x-real-ip': CF, 'cf-connecting-ip': '41.200.1.1' }))
    const b = clientIp(h({ 'x-real-ip': CF, 'cf-connecting-ip': '41.200.1.2' }))
    expect(a).not.toBe(b)
  })

  it('من يتصل بالخادم مباشرة ويزوّر CF-Connecting-IP لا يُصدَّق', () => {
    expect(clientIp(h({ 'x-real-ip': STUDENT, 'cf-connecting-ip': '1.2.3.4' }))).toBe(STUDENT)
  })

  it('السحابة الرمادية (اليوم): لا شيء يتغيّر', () => {
    expect(clientIp(h({ 'x-real-ip': STUDENT }))).toBe(STUDENT)
    expect(clientIp(h({ 'x-real-ip': STUDENT, 'x-forwarded-for': '9.9.9.9' }))).toBe(STUDENT)
  })

  it('ترويسة Cloudflare تالفة أو غائبة: يبقى عنوان المتصل ولا ينكسر شيء', () => {
    expect(clientIp(h({ 'x-real-ip': CF, 'cf-connecting-ip': 'garbage' }))).toBe(CF)
    expect(clientIp(h({ 'x-real-ip': CF }))).toBe(CF)
  })

  it('إن ضُبط Caddy لاحقًا بـ{client_ip} صار X-Real-IP عنوان التلميذ مباشرة، والنتيجة واحدة', () => {
    expect(clientIp(h({ 'x-real-ip': STUDENT, 'cf-connecting-ip': STUDENT, 'cf-ray': '8f1a2b3c4d5e6f70-ALG' }))).toBe(STUDENT)
  })
})

describe('فحص لوحة الإدارة', () => {
  it('عبر Cloudflare: يذكر المركز، ولا تحذير', () => {
    expect(cloudflareHop(h({ 'x-real-ip': CF, 'cf-connecting-ip': STUDENT, 'cf-ray': '8f1a2b3c4d5e6f70-ALG' }))).toEqual({ via: true, pop: 'ALG', leaked: false })
    expect(cloudflareHop(h({ 'x-real-ip': STUDENT, 'cf-connecting-ip': STUDENT, 'cf-ray': '8f1a2b3c4d5e6f70-MRS' }))).toEqual({ via: true, pop: 'MRS', leaked: false })
  })
  it('مباشرة دون Cloudflare: لا وساطة ولا تحذير', () => {
    expect(cloudflareHop(h({ 'x-real-ip': STUDENT }))).toEqual({ via: false, pop: null, leaked: false })
    // ترويسة cf-ray مزوّرة من اتصال مباشر لا تجعله «عبر Cloudflare»
    expect(cloudflareHop(h({ 'x-real-ip': STUDENT, 'cf-ray': 'x-ALG', 'cf-connecting-ip': '1.2.3.4' })).via).toBe(false)
  })
  it('عبر Cloudflare والعنوان المحسوب بقي عنوان Cloudflare: تحذير', () => {
    expect(cloudflareHop(h({ 'x-real-ip': CF })).leaked).toBe(true)
  })
})

describe('حراس', () => {
  const src = join(__dirname, '..', 'src')
  it('لا أحد يقرأ ترويسات العنوان بنفسه: clientIp وحده', () => {
    const hits = execSync(`grep -rliE "get\\(['\\"](x-real-ip|x-forwarded-for|cf-connecting-ip)['\\"]\\)" ${src} || true`, { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
    expect(hits.map((p) => p.replace(src + '/', ''))).toEqual(['server/lib/client-ip.ts'])
  })
  it('صفحة الأمان تعرض الفحص', () => {
    expect(readFileSync(join(src, 'app/admin/security/page.tsx'), 'utf8')).toMatch(/cloudflareHop\(h\)/)
  })
})
