import { headers } from 'next/headers'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { oauthAvailability } from '@/server/auth/oauth-tokens'

/**
 * زرّا «المتابعة بحساب Google / Apple» فوق نموذج الدخول والتسجيل (5 نوفمبر 2026).
 * روابط عادية (GET) لا نماذج: تبدأ المسار في الخادم، وتعمل داخل تطبيق أندرويد (Chrome).
 * لا شيء يظهر ما لم تُضبط مفاتيح المزوّد على الخادم.
 * WebView القديم (هواتف بلا Chrome حديث) يرفضه Google، فيُخفى زر Google هناك وحده.
 */
export async function OAuthButtons({ next, dividerLabel }: { next?: string | null; dividerLabel: string }) {
  const { google, appleWeb } = oauthAvailability()
  const ua = (await headers()).get('user-agent') ?? ''
  const embeddedWebView = /; wv\)/.test(ua)
  const showGoogle = google && !embeddedWebView
  if (!showGoogle && !appleWeb) return null
  const q = next ? `?next=${encodeURIComponent(next)}` : ''
  return (
    <div className="space-y-3">
      {showGoogle ? (
        <a href={`/api/auth/oauth/google/start${q}`} className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full')} data-oauth="google">
          المتابعة بحساب Google
        </a>
      ) : null}
      {appleWeb ? (
        <a
          href={`/api/auth/oauth/apple/start${q}`}
          className={cn(buttonVariants({ size: 'lg' }), 'w-full bg-black text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/90')}
          data-oauth="apple"
        >
          المتابعة بحساب Apple (iCloud)
        </a>
      ) : null}
      <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        {dividerLabel}
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  )
}
