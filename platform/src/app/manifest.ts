import type { MetadataRoute } from 'next'
import { t } from '@/i18n'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: t('app.name'),
    short_name: t('app.name'),
    description: t('app.description'),
    start_url: '/',
    display: 'standalone',
    dir: 'rtl',
    lang: 'ar',
    background_color: '#f5f8fb',
    theme_color: '#1d8f7f',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }]
  }
}
