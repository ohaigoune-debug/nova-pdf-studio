/**
 * قفل التطبيق: عند تفعيله يُقفل NOVA Docs كلما انتقل إلى الخلفية (فتظهر شاشة القفل أيضًا في مبدّل التطبيقات)،
 * ويُفتح بـ Face ID / Touch ID / رمز الجهاز عبر LocalAuthentication. لا يُخزَّن أي رمز داخل التطبيق.
 */
import { App as CapApp } from '@capacitor/app'
import { Lock } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NovaLock } from '../platform/native'
import { usePrefs } from '../stores/prefs'
import { LogoMark } from '../brand/Logo'
import { Button } from '../ui/kit'
import { toast } from '../ui/overlays'

export function AppLockGate() {
  const { t } = useTranslation()
  const [locked, setLocked] = useState(() => usePrefs.getState().appLock)
  const busy = useRef(false)

  const unlock = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    try {
      await NovaLock.authenticate({ reason: t('ios.lock.reason') })
      setLocked(false)
    } catch (e) {
      // رمز الجهاز أُزيل: لا حماية من النظام بعد الآن ← نوقف القفل بدل حبس المستخدم خارج بياناته
      if ((e as { code?: string })?.code === 'UNAVAILABLE') {
        usePrefs.getState().setAppLock(false)
        setLocked(false)
        toast(t('ios.lock.unavailable'), 'info')
      }
    } finally {
      busy.current = false
    }
  }, [t])

  // التفضيلات تُحمَّل قبل الرسم (main.tsx)؛ إن فُعّل القفل بعد الإقلاع لا نقفل فورًا
  useEffect(() => {
    if (locked) void unlock()
  }, [locked, unlock])

  useEffect(() => {
    // pause = الانتقال الفعلي إلى الخلفية (نافذة Face ID لا تسببه، فلا حلقة قفل)
    const sub = CapApp.addListener('pause', () => {
      if (usePrefs.getState().appLock) setLocked(true)
    })
    return () => {
      void sub.then((h) => h.remove())
    }
  }, [])

  if (!locked) return null
  return (
    <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-5 bg-brand px-8 text-center text-white" role="dialog" aria-modal="true" aria-label={t('ios.lock.title')}>
      <LogoMark size={72} />
      <div className="flex items-center gap-2 text-[22px] font-semibold"><Lock className="h-5 w-5" />{t('ios.lock.title')}</div>
      <Button size="lg" variant="filled" className="min-w-[200px]" onClick={() => void unlock()}>{t('ios.lock.unlock')}</Button>
    </div>
  )
}
