'use client'

import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/**
 * يعرض ملف PDF صفحاتٍ مرسومة داخل الصفحة (canvas) — يعمل على iPhone وكل الهواتف،
 * بخلاف الإطار (iframe/object) الذي لا يعرض PDF في Safari على الهاتف. الصفحات تُرسم عند الاقتراب منها فقط.
 */
export function PdfPages({ src, openHref, maxPages = 60 }: { src: string; openHref: string; maxPages?: number }) {
  const box = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [pages, setPages] = useState(0)

  useEffect(() => {
    let cancelled = false
    const observers: IntersectionObserver[] = []
    ;(async () => {
      try {
        const res = await fetch(src, { credentials: 'same-origin' })
        if (!res.ok) throw new Error(String(res.status))
        const bytes = new Uint8Array(await res.arrayBuffer())
        const { getDocumentProxy } = await import('unpdf')
        const pdf = await getDocumentProxy(bytes)
        if (cancelled) return
        const n = Math.min(pdf.numPages, maxPages)
        setPages(n)
        setState('ready')
        // انتظار رسم الحاويات
        await new Promise((r) => requestAnimationFrame(() => r(null)))
        const host = box.current
        if (!host) return
        const holders = [...host.querySelectorAll<HTMLDivElement>('[data-page]')]
        for (const holder of holders) {
          const io = new IntersectionObserver(
            async (entries) => {
              if (!entries.some((e) => e.isIntersecting) || holder.dataset.done) return
              holder.dataset.done = '1'
              io.disconnect()
              const page = await pdf.getPage(Number(holder.dataset.page))
              const width = holder.clientWidth || 360
              const base = page.getViewport({ scale: 1 })
              const ratio = Math.min(2, window.devicePixelRatio || 1)
              const viewport = page.getViewport({ scale: (width / base.width) * ratio })
              const canvas = document.createElement('canvas')
              canvas.width = Math.floor(viewport.width)
              canvas.height = Math.floor(viewport.height)
              canvas.style.width = '100%'
              canvas.style.height = 'auto'
              canvas.className = 'block bg-white'
              const ctx = canvas.getContext('2d')
              if (!ctx) return
              await page.render({ canvasContext: ctx, viewport, canvas } as never).promise
              holder.replaceChildren(canvas)
              holder.style.minHeight = ''
            },
            { rootMargin: '600px 0px' }
          )
          io.observe(holder)
          observers.push(io)
        }
      } catch (err) {
        console.error('[pdf-pages]', err)
        if (!cancelled) setState('error')
      }
    })()
    return () => {
      cancelled = true
      for (const o of observers) o.disconnect()
    }
  }, [src, maxPages])

  if (state === 'error')
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">
        تعذّرت المعاينة —{' '}
        <a href={openHref} target="_blank" rel="noopener" className="font-bold text-primary underline">
          افتح الملف
        </a>
      </p>
    )
  return (
    <div ref={box} className="space-y-3 bg-muted/60 p-2 sm:p-4">
      {state === 'loading' ? (
        <p className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> جارٍ تحميل المعاينة…
        </p>
      ) : (
        Array.from({ length: pages }, (_, i) => (
          <div key={i} data-page={i + 1} className="mx-auto w-full max-w-3xl overflow-hidden rounded-md bg-white shadow-sm" style={{ minHeight: '60vh' }} aria-label={`صفحة ${i + 1}`} />
        ))
      )}
    </div>
  )
}
