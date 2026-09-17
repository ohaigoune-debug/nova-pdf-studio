'use client'

import { RefreshCw, ShieldCheck } from 'lucide-react'
import QRCode from 'qrcode'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/input'
import { Progress } from '@/components/ui/misc'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

interface GroupOpt {
  id: string
  name: string
  hasOpenSession: boolean
}

interface TokenResponse {
  ok: boolean
  data?: { token: string; expiresAt: string; groupName: string }
  error?: { message: string }
}

/**
 * بطاقة حضور ديناميكية: تطلب رمزاً موقّعاً من الخادم وتجدده قبل انتهائه.
 * الرمز لا يحتوي بيانات شخصية؛ الاسم يُعرض للطالب فقط من الجلسة.
 */
export function QrCard({ studentName, groups, initialGroupId, ttlSeconds }: { studentName: string; groups: GroupOpt[]; initialGroupId: string; ttlSeconds: number }) {
  const [groupId, setGroupId] = useState(initialGroupId)
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const [loading, setLoading] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshEvery = Math.max(15, Math.floor(ttlSeconds * 0.75)) * 1000

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/student/attendance-token?groupId=${encodeURIComponent(groupId)}`, { cache: 'no-store', headers: { 'X-Requested-With': 'fetch' } })
      const json = (await res.json()) as TokenResponse
      if (!json.ok || !json.data) throw new Error(json.error?.message ?? t('qr.error'))
      const url = await QRCode.toDataURL(json.data.token, { errorCorrectionLevel: 'M', margin: 1, width: 640 })
      setDataUrl(url)
      setExpiresAt(new Date(json.data.expiresAt).getTime())
    } catch (e) {
      setError(e instanceof Error ? e.message : t('qr.error'))
      setDataUrl(null)
    } finally {
      setLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    void refresh()
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [refresh])

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void refresh(), refreshEvery)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [dataUrl, refresh, refreshEvery])

  // تجديد عند العودة إلى التبويب
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [refresh])

  const remaining = expiresAt ? Math.max(0, Math.round((expiresAt - now) / 1000)) : 0
  const pct = expiresAt ? (remaining / ttlSeconds) * 100 : 0
  const group = groups.find((g) => g.id === groupId)

  return (
    <div className="mx-auto max-w-md space-y-4">
      {groups.length > 1 ? (
        <Select value={groupId} onChange={(e) => setGroupId(e.target.value)} aria-label={t('qr.selectGroup')}>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} {g.hasOpenSession ? '— ' + t('qr.sessionOpen') : ''}
            </option>
          ))}
        </Select>
      ) : null}

      <div className="overflow-hidden rounded-2xl border bg-card shadow-lg">
        <div className="bg-primary p-4 text-primary-foreground">
          <p className="text-xs opacity-80">{t('qr.title')}</p>
          <p className="text-lg font-extrabold">{studentName}</p>
          <p className="text-sm opacity-90">{group?.name}</p>
        </div>
        <div className="flex flex-col items-center gap-3 p-6">
          <div className={cn('relative aspect-square w-full max-w-[320px] rounded-xl bg-white p-3', loading && 'opacity-60')}>
            {dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={dataUrl} alt="QR" className="size-full" />
            ) : (
              <div className="flex size-full items-center justify-center text-sm text-muted-foreground">{error ?? t('common.loading')}</div>
            )}
          </div>
          <div className="w-full">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>{t('qr.refreshIn')}</span>
              <span className="tabular">
                {remaining} {t('common.seconds')}
              </span>
            </div>
            <Progress value={pct} tone={remaining < 10 ? 'warning' : 'primary'} />
          </div>
          <div className="flex w-full items-center justify-between">
            <Badge variant={group?.hasOpenSession ? 'success' : 'muted'}>{group?.hasOpenSession ? t('qr.sessionOpen') : t('qr.sessionClosed')}</Badge>
            <Button variant="outline" size="sm" onClick={() => void refresh()} loading={loading}>
              <RefreshCw className="size-4" /> {t('qr.refresh')}
            </Button>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <div className="flex items-center gap-2 border-t bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5" /> رمز موقّع قصير العمر — لا يحتوي بياناتك الشخصية
        </div>
      </div>
    </div>
  )
}
