'use client'

import { useEffect, useLayoutEffect, useRef, type ReactNode, type Ref } from 'react'
import { cn } from '@/lib/utils'
import { FLIP_FALLBACK_MS, faceVisibility, GROW_MS, type CardPhase } from './card-machine'

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

export interface FlipCardProps {
  phase: CardPhase
  /** رقم السؤال (يبدأ من 1) والعدد الكلي — لنص البطاقة المقروء */
  position: number
  total: number
  /** false = تبديل فوري بلا حركة (prefers-reduced-motion أو تفضيل التلميذ) */
  motion: boolean
  onReveal: () => void
  onFlipEnd: () => void
  /** لإعادة التركيز إلى البطاقة بعد «السؤال التالي» */
  backRef?: Ref<HTMLButtonElement>
  /** وجه السؤال */
  children?: ReactNode
  className?: string
}

/**
 * بطاقة تنقلب على محور Y (perspective + backface-visibility، CSS فقط).
 * - الوجه الأزرق زر حقيقي: Enter/Space يعملان بلا معالجة إضافية.
 * - الوجه غير النشط aria-hidden + inert، فلا يُقرأ السؤال مرتين ولا يصله التركيز وهو مخفي.
 * - الاتجاه dir="rtl" ثابت، والتحويل لا يعكس النص: الوجه الأمامي مُدار مسبقًا 180° فيظهر سليمًا بعد القلب.
 * - بعد القلب تُزال التحويلات ثلاثية الأبعاد والوجه الأزرق حتى يعمل المحتوى التفاعلي كأي محتوى عادي.
 */
export function FlipCard({ phase, position, total, motion, onReveal, onFlipEnd, backRef, children, className }: FlipCardProps) {
  const v = faceVisibility(phase)
  const cardRef = useRef<HTMLDivElement>(null)
  const closedHeight = useRef(0)

  // مهلة احتياطية: إن لم يصل transitionend تكتمل الحالة على أي حال (المخفّض يتجاهل التكرار)
  useEffect(() => {
    if (phase !== 'flipping') return
    const t = setTimeout(onFlipEnd, motion ? FLIP_FALLBACK_MS : 0)
    return () => clearTimeout(t)
  }, [phase, motion, onFlipEnd])

  // بعد القلب يتمدد وجه السؤال من شكل البطاقة إلى طول محتواه بحركة قصيرة بدل قفزة (height فقط، مرة واحدة)
  useIsoLayoutEffect(() => {
    const el = cardRef.current
    if (!el) return
    if (!v.settled) {
      closedHeight.current = el.offsetHeight
      return
    }
    const from = closedHeight.current
    closedHeight.current = 0
    const to = el.offsetHeight
    if (!motion || !from || to <= from + 2 || typeof el.animate !== 'function') return
    el.style.overflow = 'hidden'
    const a = el.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: GROW_MS, easing: 'ease-out' })
    const done = () => {
      el.style.overflow = ''
    }
    a.onfinish = done
    a.oncancel = done
    return () => a.cancel()
  }, [v.settled, motion])

  return (
    <div dir="rtl" className={cn('deck-scene', className)} data-phase={phase}>
      <div
        ref={cardRef}
        className="deck-card"
        data-flipped={v.flipped ? 'true' : 'false'}
        data-settled={v.settled ? 'true' : 'false'}
        data-motion={motion ? 'on' : 'off'}
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && e.propertyName === 'transform') onFlipEnd()
        }}
      >
        {v.settled ? null : (
          <button
            ref={backRef}
            type="button"
            className="deck-face deck-face-back group flex w-full flex-col items-center justify-center rounded-[20px] p-3 text-white shadow-lift focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
            onClick={onReveal}
            aria-label={`البطاقة ${position} من ${total}. اضغط لعرض السؤال`}
            aria-hidden={v.backHidden || undefined}
            inert={v.backHidden || undefined}
            tabIndex={v.backHidden ? -1 : 0}
            data-testid="card-back"
          >
            <span className="pointer-events-none flex size-full flex-col items-center justify-center gap-4 rounded-[14px] border border-white/35">
              <CardEmblem />
              <span className="text-sm font-bold tracking-wide text-white/85">
                {position} / {total}
              </span>
            </span>
          </button>
        )}
        <div
          className="deck-face deck-face-front flex flex-col rounded-[20px] border border-deck-line bg-card text-card-foreground shadow-lift"
          aria-hidden={v.frontHidden || undefined}
          inert={v.frontHidden || undefined}
          data-testid="card-front"
        >
          {children}
        </div>
      </div>
    </div>
  )
}

/** شعار ظهر البطاقة: كتاب مفتوح داخل دائرة بإطار ذهبي رقيق (SVG بلا صور خارجية) */
export function CardEmblem({ className }: { className?: string }) {
  return (
    <span className={cn('flex size-24 items-center justify-center rounded-full border-2 border-deck-gold/80 bg-white/95 text-deck-back shadow-sm', className)} aria-hidden>
      <BookGlyph className="size-12" />
    </span>
  )
}

export function BookGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden focusable="false">
      <path d="M24 13c-4.5-3.2-10.5-4-16-3v26c5.5-1 11.5-.2 16 3 4.5-3.2 10.5-4 16-3V10c-5.5-1-11.5-.2-16 3Z" />
      <path d="M24 13v26" />
      <path d="M13 18c2.4-.2 5 .2 7 1.2M13 24c2.4-.2 5 .2 7 1.2M28 19.2c2-1 4.6-1.4 7-1.2M28 25.2c2-1 4.6-1.4 7-1.2" strokeWidth={2} />
    </svg>
  )
}
