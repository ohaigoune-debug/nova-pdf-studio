'use client'

import { useEffect, useLayoutEffect, useRef, type ReactNode, type Ref } from 'react'
import { cn } from '@/lib/utils'
import { FLIP_FALLBACK_MS, faceVisibility, GROW_MS, type CardPhase } from './card-machine'
import { CardBackArt, FlipArrow } from './play-art'

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
  /** وجه السؤال (يُركَّب بعد اكتمال الدوران فقط) */
  children?: ReactNode
  className?: string
}

/**
 * البطاقة نفسها كما في المرجع المعتمد (02 ← 03 ← 04):
 * - مغلقة: بطاقة زرقاء بإطار أبيض ونسبة 4:5 فوق رزمة بيضاء، وهي زر حقيقي (لمس، Enter، Space).
 * - تدور 180° حول المحور Y (perspective + backface-visibility) فيظهر وجهها الأبيض، مع سهم الدوران الذهبي.
 * - بعد الدوران تتسع إلى بطاقة السؤال ويظهر السؤال والاختيارات الحقيقية عليها.
 * الوجه غير النشط aria-hidden + inert، ومحتوى السؤال لا يُركَّب قبل الكشف، فلا يُقرأ مرتين.
 */
export function FlipCard({ phase, position, total, motion, onReveal, onFlipEnd, backRef, children, className }: FlipCardProps) {
  const v = faceVisibility(phase)
  const cardRef = useRef<HTMLDivElement>(null)
  const compact = useRef<{ w: number; h: number } | null>(null)

  // مهلة احتياطية: إن لم يصل transitionend تكتمل الحالة على أي حال (المخفّض يتجاهل التكرار)
  useEffect(() => {
    if (phase !== 'flipping') return
    const t = setTimeout(onFlipEnd, motion ? FLIP_FALLBACK_MS : 0)
    return () => clearTimeout(t)
  }, [phase, motion, onFlipEnd])

  // من شكل البطاقة المغلقة إلى بطاقة السؤال: اتساع قصير (العرض والارتفاع) بدل قفزة
  useIsoLayoutEffect(() => {
    const el = cardRef.current
    if (!el) return
    if (!v.settled) {
      compact.current = { w: el.offsetWidth, h: el.offsetHeight }
      return
    }
    const from = compact.current
    compact.current = null
    if (!motion || !from || typeof el.animate !== 'function') return
    const to = { w: el.offsetWidth, h: el.offsetHeight }
    if (Math.abs(to.w - from.w) < 2 && Math.abs(to.h - from.h) < 2) return
    el.style.overflow = 'hidden'
    const a = el.animate(
      [
        { width: `${from.w}px`, height: `${from.h}px` },
        { width: `${to.w}px`, height: `${to.h}px` }
      ],
      { duration: GROW_MS, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
    )
    const done = () => {
      el.style.overflow = ''
    }
    a.onfinish = done
    a.oncancel = done
    return () => a.cancel()
  }, [v.settled, motion])

  return (
    <div dir="rtl" className={cn('deck-scene', className)} data-phase={phase}>
      {phase === 'flipping' && motion ? <FlipArrow className="deck-flip-arrow" /> : null}
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
            className="deck-face deck-face-back focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
            onClick={onReveal}
            aria-label={`البطاقة ${position} من ${total}. اضغط لعرض السؤال`}
            aria-hidden={v.backHidden || undefined}
            inert={v.backHidden || undefined}
            tabIndex={v.backHidden ? -1 : 0}
            data-testid="card-back"
          >
            <CardBackArt />
          </button>
        )}
        <div className="deck-face deck-face-front" aria-hidden={v.frontHidden || undefined} inert={v.frontHidden || undefined} data-testid="card-front">
          {v.settled ? <div className={cn('deck-front-content', motion && 'deck-reveal')}>{children}</div> : <span className="deck-front-blank" />}
        </div>
      </div>
    </div>
  )
}
