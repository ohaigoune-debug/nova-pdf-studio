import { BlockList, isIP } from 'node:net'

/**
 * نطاقات عناوين Cloudflare الرسمية: https://www.cloudflare.com/ips/
 * (آخر تحديث عندهم 28 سبتمبر 2023؛ رُوجعت في 13 نوفمبر 2026). إن تغيّرت القائمة يومًا فحدِّثها هنا وفي docs/DEPLOYMENT.md.
 */
export const CLOUDFLARE_IPV4 = [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18',
  '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17',
  '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22'
] as const

export const CLOUDFLARE_IPV6 = [
  '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32'
] as const

const ranges = new BlockList()
for (const c of CLOUDFLARE_IPV4) {
  const [net, bits] = c.split('/')
  ranges.addSubnet(net!, Number(bits), 'ipv4')
}
for (const c of CLOUDFLARE_IPV6) {
  const [net, bits] = c.split('/')
  ranges.addSubnet(net!, Number(bits), 'ipv6')
}

/** هل هذا العنوان من عناوين Cloudflare؟ (يقبل صيغة IPv4 المغلّفة ‎::ffff:a.b.c.d) */
export function isCloudflareIp(ip: string): boolean {
  const raw = ip.trim()
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(raw)?.[1]
  const addr = mapped ?? raw
  const v = isIP(addr)
  if (v === 4) return ranges.check(addr, 'ipv4')
  if (v === 6) return ranges.check(addr, 'ipv6')
  return false
}
