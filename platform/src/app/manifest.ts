import type { MetadataRoute } from 'next'
import { t } from '@/i18n'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: t('app.name'),
    short_name: t('app.name'),
    description: t('app.description'),
    start_url: '/',
    scope: '/',
    display: 'standalone',
    // الهواتف والألواح معاً: الأستاذ يستعمل السكانر والقوائم أفقياً
    orientation: 'any',
    categories: ['education'],
    dir: 'rtl',
    lang: 'ar',
    background_color: '#F4F5F7',
    theme_color: '#314D85',
    // PNG مطلوبة للتثبيت وللتغليف في تطبيق أندرويد؛ وmaskable تملأ الأيقونة المستديرة بلا قصّ للشعار
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }
    ]
  }
}
