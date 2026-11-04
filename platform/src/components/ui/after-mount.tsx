'use client'

import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react'

const useBeforePaint = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * يُرسم محتواه على جهاز التلميذ لا على الخادم.
 *
 * للأجزاء البعيدة عن أعلى الصفحة: الخادم لا يحوّلها إلى HTML (وهذا أغلى ما في الصفحة)،
 * وبياناتها تصل مع الصفحة كما كانت، فيرسمها الهاتف فور تشغيل الصفحة قبل أول رسم بعده.
 * في التنقّل داخل الموقع لا فرق يُرى، لأن الرسم هناك على الجهاز أصلًا.
 */
export function AfterMount({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const [ready, setReady] = useState(false)
  useBeforePaint(() => setReady(true), [])
  return <>{ready ? children : fallback}</>
}
