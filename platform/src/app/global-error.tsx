'use client'

import { useEffect } from 'react'
import { isStaleDeployError, reloadOnceForStaleDeploy } from '@/lib/stale-deploy'

/**
 * عطل في التخطيط الجذري نفسه (layout.tsx): هذه الصفحة تستبدل <html> كله، فلا تعتمد على
 * globals.css ولا على أي مزوّد سياق — أنماط مضمّنة فقط (CSP يسمح بها في style-src).
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // صفحة من نسخة سابقة بعد نشر جديد: إعادة تحميل تلقائية مرة واحدة
  const stale = isStaleDeployError(error)
  useEffect(() => {
    console.error(error)
    if (stale) reloadOnceForStaleDeploy()
  }, [error, stale])

  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
          textAlign: 'center',
          fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif",
          background: '#FFFFFF',
          color: '#0E1528'
        }}
      >
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>حدث خطأ غير متوقع</h1>
        <p style={{ margin: 0, maxWidth: 420, fontSize: 14, lineHeight: 1.8, color: '#4B5568' }}>
          لم نتمكن من فتح المنصة الآن. حسابك وتقدّمك محفوظان. أعد المحاولة بعد لحظات.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => (stale ? window.location.reload() : reset())}
            style={{ border: 0, borderRadius: 8, padding: '12px 20px', fontSize: 14, fontWeight: 600, background: '#3155F5', color: '#FFFFFF', cursor: 'pointer' }}
          >
            أعد المحاولة
          </button>
          {/* رابط عادي لا next/link: إعادة تحميل كاملة تخرج من الحالة المعطوبة */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" style={{ borderRadius: 8, padding: '12px 20px', fontSize: 14, fontWeight: 600, border: '1px solid #CBD5E1', color: '#0E1528', textDecoration: 'none' }}>
            العودة إلى الرئيسية
          </a>
        </div>
        {error.digest ? (
          <p dir="ltr" style={{ margin: 0, fontSize: 12, color: '#64748B' }}>
            رمز الخطأ: {error.digest}
          </p>
        ) : null}
      </body>
    </html>
  )
}
