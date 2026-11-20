'use client'

import { useEffect } from 'react'

/** يعدّ الزيارة ويحفظ مصدرها (مرة عند فتح الصفحة؛ لا شيء في المعاينة) */
export function LandingBeacon({ slug, src, preview }: { slug: string; src: string | null; preview: boolean }) {
  useEffect(() => {
    if (preview) return
    void fetch('/api/landing/visit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug, src }), keepalive: true }).catch(() => {})
  }, [slug, src, preview])
  return null
}
