'use client'

import { useEffect } from 'react'

/** تسجيل عامل الخدمة (PWA) في الإنتاج فقط؛ يوفّر صفحة بلا اتصال وتخزين الأصول الثابتة */
export function PwaRegister({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => console.warn('[pwa] register failed', err))
  }, [enabled])
  return null
}
