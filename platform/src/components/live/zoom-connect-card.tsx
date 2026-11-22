import { Link2, Video } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime } from '@/lib/utils'
import type { ZoomOAuthStatus } from '@/server/services/zoom-oauth.service'
import { ZoomDisconnectButton } from './zoom-disconnect-button'

const FLASH: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: 'رُبط حساب Zoom: يمكنك الآن بدء الحصص من المنصة.' },
  denied: { ok: false, text: 'لم يُمنح الإذن في Zoom.' },
  state: { ok: false, text: 'انتهت مهلة محاولة الربط: أعد المحاولة.' },
  failed: { ok: false, text: 'رفض Zoom الربط: تأكد أن رابط العودة أدناه مضاف في التطبيق، ثم أعد المحاولة.' },
  keys: { ok: false, text: 'مفتاحا Zoom غير مضافين في إعدادات الخادم بعد.' }
}

/** بطاقة «Zoom داخل المنصة» في صفحة البث المباشر: دخول التلاميذ (المفتاحان) وبدء الحصص كمضيف (ربط الحساب) */
export function ZoomConnectCard({ status, flash }: { status: ZoomOAuthStatus; flash?: string | null }) {
  const f = flash ? FLASH[flash] : undefined
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Video className="size-5 text-primary" /> Zoom داخل المنصة
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {f ? <p className={f.ok ? 'rounded-lg bg-emerald-50 p-2 text-emerald-800' : 'rounded-lg bg-amber-50 p-2 text-amber-900'}>{f.text}</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>دخول التلاميذ من المنصة (دون تطبيق Zoom)</span>
          {status.configured ? <Badge variant="success">مفعّل</Badge> : <Badge variant="muted">المفتاحان غير مضافين في الخادم</Badge>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>بدء الحصص كمضيف من المنصة</span>
          {status.connected ? (
            <span className="flex flex-wrap items-center gap-2">
              <Badge variant="success">مربوط{status.connectedAt ? ` منذ ${formatDateTime(new Date(status.connectedAt))}` : ''}</Badge>
              <ZoomDisconnectButton />
            </span>
          ) : status.configured ? (
            <Button asChild size="sm">
              <a href="/api/v1/zoom/connect">
                <Link2 className="size-4" /> {status.needsReconnect ? 'أعد ربط حساب Zoom' : 'ربط حساب Zoom'}
              </a>
            </Button>
          ) : (
            <Badge variant="muted">بعد إضافة المفتاحين</Badge>
          )}
        </div>
        {!status.connected && status.configured ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            قبل الربط أضف رابط العودة هذا في تطبيقك على marketplace.zoom.us (Redirect URL و Allow List):{' '}
            <code dir="ltr" className="rounded bg-muted px-1 font-mono">
              {status.redirectUri}
            </code>
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
