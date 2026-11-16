import { useEffect, useState } from 'react'
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

export const APP_VERSION = '1.0.0'
/** بريد الدعم يُضبط وقت البناء (VITE_SUPPORT_EMAIL) — لا نضع عنوانًا مخترعًا في الشيفرة. */
export const SUPPORT_EMAIL: string = (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) ?? ''

/** الإصدار الحقيقي من النظام على iOS ("0.9.0 (5)")؛ على الويب الرقم الثابت. */
export function useAppVersion(): string {
  const [v, setV] = useState(APP_VERSION)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let alive = true
    CapApp.getInfo()
      .then((i) => alive && setV(i.build && i.build !== i.version ? `${i.version} (${i.build})` : i.version))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])
  return v
}
