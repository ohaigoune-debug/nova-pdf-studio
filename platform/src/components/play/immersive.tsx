'use client'

import { useEffect } from 'react'

/** شاشة اللعب كاملة على الهاتف واللوحي: تُخفى ترويسة الموقع وشريطه السفلي ما دامت الجولة مفتوحة (globals.css) */
export function PlayImmersive() {
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('play-immersive')
    return () => root.classList.remove('play-immersive')
  }, [])
  return null
}
