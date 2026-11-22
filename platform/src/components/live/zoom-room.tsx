'use client'

import { ArrowRight, ExternalLink, Loader2, Video } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ZOOM_CLIENT_VIEW_URL, ZOOM_UI_LANG } from '@/lib/zoom-web'
import { zoomEmbedJoinAction } from '@/server/actions/live.actions'

/** الجزء الذي نستعمله من ZoomMtg (Client View) — واجهة Zoom بالـcallbacks */
interface ZoomMtgApi {
  preLoadWasm(): void
  prepareWebSDK(): void
  i18n: { load(lang: string): void; onLoad(cb: () => void): void }
  init(o: { leaveUrl: string; patchJsMedia?: boolean; disableCORP?: boolean; success?: () => void; error?: (e: unknown) => void }): void
  join(o: { signature: string; sdkKey?: string; meetingNumber: string; userName: string; passWord: string; userEmail?: string; success?: () => void; error?: (e: unknown) => void }): void
}

type Phase = 'loading' | 'joining' | 'in' | 'error'

/** رسالة عربية من خطأ Zoom ({ errorCode, reason } أو { type, reason }) */
function zoomErrorText(e: unknown): string {
  const o = (e ?? {}) as { errorCode?: number; reason?: string; type?: string }
  const code = o.errorCode
  if (code === 3008) return 'لم تبدأ الحصة بعد: انتظر الأستاذ ثم أعد المحاولة.'
  if (code === 3004 || code === 3712) return 'رمز الحصة غير صحيح. أبلغ الإدارة، وادخل من تطبيق Zoom في الأثناء.'
  if (code === 3001 || code === 3707) return 'الاجتماع غير موجود أو انتهى.'
  if (code === 200 || code === 4011 || code === 63) return 'لم يسمح Zoom بالدخول من المنصة لهذه الحصة. ادخل من تطبيق Zoom.'
  return `تعذّر فتح الحصة داخل المنصة${o.reason ? ` (${o.reason})` : ''}. ادخل من تطبيق Zoom.`
}

/**
 * غرفة الحصة داخل المنصة: يطلب توقيع الدخول من الخادم، يحمّل Zoom Meeting SDK (Client View) من خادم Zoom،
 * ثم يُدخل التلميذ باسمه. أي تعثّر ⇒ رسالة عربية وزرّ «افتح في تطبيق Zoom» بالرابط الأصلي.
 */
export function ZoomRoom({ sessionId }: { sessionId: string }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState<string | null>(null)
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null)
  const [leaveUrl, setLeaveUrl] = useState('/student/courses')
  const [title, setTitle] = useState('')
  const [slow, setSlow] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const html = document.documentElement
    const prevDir = html.dir
    const timer = window.setTimeout(() => setSlow(true), 20_000)
    const fail = (msg: string) => {
      html.dir = prevDir
      setError(msg)
      setPhase('error')
    }
    ;(async () => {
      const r = await zoomEmbedJoinAction({ sessionId })
      if (!r.ok) return fail(r.error.message)
      const j = r.data
      setFallbackUrl(j.fallbackUrl)
      setLeaveUrl(j.leaveUrl)
      setTitle(j.title)
      setPhase('joining')
      let ZoomMtg: ZoomMtgApi
      try {
        const mod = (await import(/* webpackIgnore: true */ ZOOM_CLIENT_VIEW_URL)) as { ZoomMtg: ZoomMtgApi }
        ZoomMtg = mod.ZoomMtg
      } catch {
        return fail('تعذّر تحميل Zoom في المتصفح (اتصال ضعيف أو متصفح قديم). ادخل من تطبيق Zoom.')
      }
      try {
        ZoomMtg.preLoadWasm()
        ZoomMtg.prepareWebSDK()
        ZoomMtg.i18n.load(ZOOM_UI_LANG)
        ZoomMtg.i18n.onLoad(() => {
          // واجهة Zoom مصمَّمة من اليسار إلى اليمين
          html.dir = 'ltr'
          ZoomMtg.init({
            leaveUrl: new URL(j.leaveUrl, window.location.origin).href,
            patchJsMedia: true,
            disableCORP: !window.crossOriginIsolated,
            success: () => {
              // واجهة Zoom جاهزة: تظهر هي (ومعها رسائلها: انتظار الأستاذ، السماح بالميكروفون…)
              window.clearTimeout(timer)
              setPhase('in')
              ZoomMtg.join({
                signature: j.signature,
                sdkKey: j.sdkKey,
                meetingNumber: j.meetingNumber,
                userName: j.userName,
                passWord: j.passcode,
                userEmail: '',
                error: (e) => fail(zoomErrorText(e))
              })
            },
            error: (e) => fail(zoomErrorText(e))
          })
        })
      } catch (e) {
        fail(zoomErrorText(e))
      }
    })().catch(() => fail('تعذّر فتح الحصة داخل المنصة. ادخل من تطبيق Zoom.'))
    return () => window.clearTimeout(timer)
  }, [sessionId])

  if (phase === 'in') return null
  return (
    <main dir="rtl" className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-gradient-to-br from-[#1C3A63] to-[#0F2544] p-5 text-[#FFFDF7]">
      <div className="w-full max-w-sm space-y-4 rounded-[20px] border border-[#C29B45]/30 bg-white/[0.05] p-6 text-center backdrop-blur-sm">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#C29B45]/15 text-[#E6CF95]">
          {phase === 'error' ? <Video className="size-7" /> : <Loader2 className="size-7 animate-spin" />}
        </span>
        <div className="space-y-1">
          <h1 className="font-heading text-xl font-bold">{phase === 'error' ? 'تعذّر الدخول من المنصة' : 'جارٍ فتح الحصة…'}</h1>
          {title ? <p className="text-sm text-[#E6CF95]">{title}</p> : null}
          <p className="text-sm leading-relaxed text-white/80">{phase === 'error' ? error : 'اسمح للمتصفح باستعمال الميكروفون إن طُلب منك.'}</p>
        </div>
        {fallbackUrl && (phase === 'error' || slow) ? (
          <a
            href={fallbackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#C29B45] font-bold text-[#0F2544] transition-colors hover:bg-[#E6CF95]"
          >
            <ExternalLink className="size-5" /> افتح في تطبيق Zoom
          </a>
        ) : null}
        <a href={leaveUrl} className="inline-flex items-center gap-1 text-sm text-white/80 hover:text-white hover:underline">
          <ArrowRight className="size-4" /> رجوع إلى الدورة
        </a>
      </div>
    </main>
  )
}
