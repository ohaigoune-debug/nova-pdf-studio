'use client'

import { BellOff, BellRing } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'
import { subscribePushAction, unsubscribePushAction } from '@/server/actions/push.actions'

function toUint8(b64u: string): Uint8Array {
  const pad = '='.repeat((4 - (b64u.length % 4)) % 4)
  const raw = atob((b64u + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

type State = 'unsupported' | 'denied' | 'off' | 'on' | 'loading'

/** زر تفعيل/إلغاء إشعارات الهاتف (Web Push). المفتاح العام فقط يصل للمتصفح. */
export function PushToggle({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = useState<State>('loading')
  const [pending, start] = useTransition()

  useEffect(() => {
    if (!publicKey || typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setState('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setState(sub ? 'on' : 'off'))
      .catch(() => setState('off'))
  }, [publicKey])

  const enable = () =>
    start(async () => {
      try {
        const perm = await Notification.requestPermission()
        if (perm !== 'granted') {
          setState(perm === 'denied' ? 'denied' : 'off')
          return
        }
        const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js', { scope: '/' }))
        await navigator.serviceWorker.ready
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toUint8(publicKey!) as BufferSource })
        const json = sub.toJSON()
        const r = await subscribePushAction({ endpoint: json.endpoint, keys: json.keys })
        if (!r.ok) {
          toast('error', r.error.message)
          await sub.unsubscribe()
          return
        }
        setState('on')
        toast('success', t('push.enabled'))
      } catch (err) {
        console.warn('[push] subscribe failed', err)
        toast('error', t('push.failed'))
      }
    })

  const disable = () =>
    start(async () => {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await unsubscribePushAction(sub.endpoint)
        await sub.unsubscribe()
      }
      setState('off')
      toast('info', t('push.disabled'))
    })

  if (state === 'unsupported' || state === 'loading') return null
  if (state === 'denied') return <p className="text-xs text-muted-foreground">{t('push.denied')}</p>
  return state === 'on' ? (
    <Button type="button" size="sm" variant="outline" onClick={disable} loading={pending}>
      <BellOff className="size-4" /> {t('push.disable')}
    </Button>
  ) : (
    <Button type="button" size="sm" onClick={enable} loading={pending}>
      <BellRing className="size-4" /> {t('push.enable')}
    </Button>
  )
}
