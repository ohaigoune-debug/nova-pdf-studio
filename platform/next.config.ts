import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // بناء مستقل لـ Docker (server.js + الحد الأدنى من node_modules)
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  outputFileTracingRoot: __dirname,
  // unpdf يحمل pdf.js بمسارات ديناميكية: يُحمَّل من node_modules كما هو لا مجمَّعاً
  serverExternalPackages: ['@electric-sql/pglite', 'pg', 'unpdf', 'mammoth', 'jszip'],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb'
    }
  },
  async rewrites() {
    // مسار ‎.well-known‎ لا يمرّ بموجّه الملفات، فيُخدَم من معالج عادي
    return [{ source: '/.well-known/assetlinks.json', destination: '/assetlinks' }]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          ...(process.env.NODE_ENV === 'production' ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : [])
        ]
      },
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }, { key: 'Service-Worker-Allowed', value: '/' }] }
    ]
  }
}

export default nextConfig
