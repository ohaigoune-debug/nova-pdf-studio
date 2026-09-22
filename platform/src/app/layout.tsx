import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import type { ReactNode } from 'react'
import { PwaRegister } from '@/components/pwa-register'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toast'
import { LOCALE_DIR, t } from '@/i18n'
import { LocaleProvider } from '@/i18n/client'
import { getLocale } from '@/i18n/server'
import './globals.css'

export const metadata: Metadata = {
  title: { default: t('app.name'), template: `%s · ${t('app.name')}` },
  description: t('app.description'),
  applicationName: t('app.name'),
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
  appleWebApp: { capable: true, title: t('app.name'), statusBarStyle: 'default' }
}

// كل الصفحات ديناميكية: الـnonce في CSP يتغيّر لكل طلب فلا يصلح التوليد المسبق (بما فيه 404)
export const dynamic = 'force-dynamic'

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f9f7f3' },
    { media: '(prefers-color-scheme: dark)', color: '#070e12' }
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [nonce, locale] = await Promise.all([headers().then((h) => h.get('x-nonce') ?? undefined), getLocale()])
  return (
    <html lang={locale} dir={LOCALE_DIR[locale]} suppressHydrationWarning>
      <head>
        <link rel="preload" href="/fonts/IBMPlexSansArabic-Regular.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Amiri-Bold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="min-h-dvh font-sans">
        <LocaleProvider locale={locale}>
          <ThemeProvider nonce={nonce}>
            {children}
            <Toaster />
          </ThemeProvider>
        </LocaleProvider>
        <PwaRegister enabled={process.env.NODE_ENV === 'production'} />
      </body>
    </html>
  )
}
