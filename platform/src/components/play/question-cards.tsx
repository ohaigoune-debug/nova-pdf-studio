'use client'

import { ArrowDown, ArrowUp, Check, GripVertical, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { PlayPublicPayload, PlayStudentAnswer } from '@/server/play/question-types'
import { RichText, textDir } from './rich-text'

export interface CardProps {
  payload: PlayPublicPayload
  disabled: boolean
  /** إشعار الحاوية بالإجابة الحالية (null = غير مكتملة) */
  onChange: (answer: PlayStudentAnswer | null) => void
  /** بعد التصحيح: لتلوين الاختيار المختار */
  result: { isCorrect: boolean; correctText: string } | null
  motion: boolean
  /** الاختيار المتعدد: عمودان على الشاشات الواسعة (الافتراضي) أو عمود واحد داخل بطاقة اللعب */
  layout?: 'grid' | 'stack'
  /** ملء الفراغ داخل بطاقة اللعب: الجملة بلا إطار ثانٍ */
  bare?: boolean
}

/* ---------------------------------- MCQ ---------------------------------- */

export function McqCard({ payload, disabled, onChange, result, motion, layout = 'grid' }: CardProps) {
  const [picked, setPicked] = useState<string | null>(null)
  if (payload.type !== 'MCQ') return null
  const letters = ['أ', 'ب', 'ج', 'د', 'هـ', 'و']
  return (
    <div className={cn('grid gap-3', layout === 'grid' && 'sm:grid-cols-2')} role="radiogroup">
      {payload.options.map((o, i) => {
        const isPicked = picked === o.key
        const isCorrectOpt = result ? o.text === result.correctText : false
        const state = result ? (isCorrectOpt ? 'correct' : isPicked ? 'wrong' : 'idle') : isPicked ? 'picked' : 'idle'
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={isPicked}
            disabled={disabled}
            onClick={() => {
              setPicked(o.key)
              onChange({ type: 'MCQ', key: o.key })
            }}
            className={cn(
              'group flex min-h-14 items-start gap-3 rounded-2xl border-2 bg-card p-3 text-start text-base font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default',
              state === 'idle' && 'border-border hover:border-primary/50 hover:bg-primary/5',
              state === 'picked' && 'border-primary bg-primary/10 shadow-sm',
              state === 'correct' && 'border-success bg-success/10',
              state === 'wrong' && cn('border-destructive bg-destructive/10', motion && 'animate-[shake_0.4s_ease-in-out]')
            )}
          >
            <span
              className={cn(
                'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold',
                state === 'correct' ? 'border-success bg-success text-success-foreground' : state === 'wrong' ? 'border-destructive bg-destructive text-destructive-foreground' : state === 'picked' ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted text-muted-foreground'
              )}
            >
              {state === 'correct' ? <Check className="size-4" /> : state === 'wrong' ? <X className="size-4" /> : letters[i]}
            </span>
            <RichText text={o.text} className="flex-1 leading-relaxed" />
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------- FILL_BLANK ------------------------------- */

export function FillBlankCard({ payload, disabled, onChange, result, motion, bare = false }: CardProps) {
  const [filled, setFilled] = useState<(string | null)[]>([])
  const [active, setActive] = useState(0)
  const [dragging, setDragging] = useState<string | null>(null)
  useEffect(() => {
    if (payload.type === 'FILL_BLANK') setFilled(Array.from({ length: payload.blanks }, () => null))
  }, [payload])
  if (payload.type !== 'FILL_BLANK') return null
  const used = new Set(filled.filter((x): x is string => x !== null))
  const correctTokens = result ? result.correctText.split(' ، ') : []

  const commit = (next: (string | null)[]) => {
    setFilled(next)
    onChange(next.every((x) => x !== null) ? { type: 'FILL_BLANK', blanks: next as string[] } : null)
  }
  const place = (word: string, at?: number) => {
    if (disabled) return
    const next = [...filled]
    // الكلمة مستعملة في فراغ آخر؟ أزلها منه أولاً
    const prev = next.indexOf(word)
    if (prev >= 0) next[prev] = null
    let idx = at ?? (next[active] === null ? active : next.indexOf(null))
    if (idx < 0 || idx >= next.length) idx = active
    next[idx] = word
    const firstEmpty = next.indexOf(null)
    setActive(firstEmpty >= 0 ? firstEmpty : idx)
    commit(next)
  }
  const clear = (idx: number) => {
    if (disabled) return
    const next = [...filled]
    next[idx] = null
    setActive(idx)
    commit(next)
  }
  const dir = textDir(payload.segments.map((s) => ('t' in s ? s.t : '')).join(' '))

  return (
    <div className="space-y-5">
      <p dir={dir} className={cn('text-lg leading-[2.4]', bare ? 'px-1' : 'rounded-2xl border bg-card p-4 shadow-sm', dir === 'ltr' ? 'text-left' : 'text-right')}>
        {payload.segments.map((seg, i) => {
          if ('t' in seg) return <RichText key={i} text={seg.t} />
          const word = filled[seg.b] ?? null
          const isActive = active === seg.b && !disabled
          const correctness = result ? (word !== null && correctTokens[seg.b] === word ? 'correct' : 'wrong') : null
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => (word ? clear(seg.b) : setActive(seg.b))}
              onDragOver={(e) => {
                if (dragging) e.preventDefault()
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (dragging) place(dragging, seg.b)
                setDragging(null)
              }}
              aria-label={word ? `الفراغ ${seg.b + 1}: ${word} — انقر للإزالة` : `الفراغ ${seg.b + 1} فارغ`}
              className={cn(
                'mx-1 inline-flex min-w-24 items-center justify-center rounded-xl border-2 border-dashed px-3 py-1 align-middle text-base font-bold transition-all',
                word ? 'border-solid' : 'text-muted-foreground',
                !result && (isActive ? 'border-primary bg-primary/10 text-primary' : word ? 'border-primary/60 bg-primary/5 text-foreground' : 'border-border bg-muted/40'),
                correctness === 'correct' && 'border-success bg-success/10 text-success',
                correctness === 'wrong' && cn('border-destructive bg-destructive/10 text-destructive line-through', motion && 'animate-[shake_0.4s_ease-in-out]')
              )}
            >
              {word ?? '……'}
            </button>
          )
        })}
      </p>
      {result && !result.isCorrect ? (
        <p className="text-sm text-success">
          الإجابة الصحيحة: <strong>{result.correctText}</strong>
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2" aria-label="بنك الكلمات">
        {payload.bank.map((w) => {
          const isUsed = used.has(w)
          return (
            <button
              key={w}
              type="button"
              disabled={disabled || isUsed}
              draggable={!disabled && !isUsed}
              onDragStart={() => setDragging(w)}
              onDragEnd={() => setDragging(null)}
              onClick={() => place(w)}
              dir={textDir(w)}
              className={cn(
                'rounded-xl border-2 px-4 py-2 text-base font-semibold shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isUsed ? 'border-dashed border-border bg-muted/50 text-muted-foreground/50' : 'border-border bg-card hover:-translate-y-0.5 hover:border-primary hover:shadow-md active:translate-y-0'
              )}
            >
              {w}
            </button>
          )
        })}
      </div>
      {!disabled ? <p className="text-xs text-muted-foreground">انقر كلمة لتنتقل إلى الفراغ المحدد، أو اسحبها إليه. انقر الفراغ لإرجاع الكلمة.</p> : null}
    </div>
  )
}

/* -------------------------------- MATCHING -------------------------------- */

export function MatchingCard({ payload, disabled, onChange, result }: CardProps) {
  const [matches, setMatches] = useState<Record<string, string>>({})
  const [activeLeft, setActiveLeft] = useState<string | null>(null)
  useEffect(() => {
    setMatches({})
    setActiveLeft(null)
  }, [payload])
  if (payload.type !== 'MATCHING') return null
  const colors = ['bg-primary/15 border-primary', 'bg-accent/20 border-accent', 'bg-success/15 border-success', 'bg-violet-500/15 border-violet-500', 'bg-rose-500/15 border-rose-500', 'bg-sky-500/15 border-sky-500']
  const leftIndex = (lk: string) => payload.lefts.findIndex((l) => l.key === lk)
  const rightOwner = (rk: string) => Object.entries(matches).find(([, r]) => r === rk)?.[0] ?? null
  const commit = (next: Record<string, string>) => {
    setMatches(next)
    onChange(Object.keys(next).length === payload.lefts.length ? { type: 'MATCHING', matches: next } : null)
  }
  const pickLeft = (lk: string) => {
    if (disabled) return
    if (matches[lk]) {
      const next = { ...matches }
      delete next[lk]
      commit(next)
      return
    }
    setActiveLeft(activeLeft === lk ? null : lk)
  }
  const pickRight = (rk: string) => {
    if (disabled) return
    const owner = rightOwner(rk)
    if (owner) {
      const next = { ...matches }
      delete next[owner]
      commit(next)
      return
    }
    if (!activeLeft) return
    commit({ ...matches, [activeLeft]: rk })
    setActiveLeft(null)
  }
  const correctPairs = result ? parsePairs(result.correctText) : null
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {payload.lefts.map((l, i) => {
            const m = matches[l.key]
            const ok = correctPairs ? correctPairs.get(l.text) === payload.rights.find((r) => r.key === m)?.text : null
            return (
              <button key={l.key} type="button" disabled={disabled} onClick={() => pickLeft(l.key)} className={cn('w-full rounded-xl border-2 p-3 text-start text-sm font-semibold transition-all', m ? colors[i % colors.length] : activeLeft === l.key ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-primary/50', ok === true && 'border-success bg-success/10', ok === false && 'border-destructive bg-destructive/10')}>
                <RichText text={l.text} />
              </button>
            )
          })}
        </div>
        <div className="space-y-2">
          {payload.rights.map((r) => {
            const owner = rightOwner(r.key)
            const i = owner ? leftIndex(owner) : -1
            return (
              <button key={r.key} type="button" disabled={disabled} onClick={() => pickRight(r.key)} className={cn('w-full rounded-xl border-2 p-3 text-start text-sm font-semibold transition-all', owner ? colors[i % colors.length] : activeLeft ? 'border-dashed border-primary/60 bg-primary/5 hover:border-primary' : 'border-border bg-card')}>
                <RichText text={r.text} />
              </button>
            )
          })}
        </div>
      </div>
      {result && !result.isCorrect ? <p className="text-sm text-success">الإجابة الصحيحة: {result.correctText}</p> : null}
      {!disabled ? <p className="text-xs text-muted-foreground">انقر عنصراً من اليمين ثم ما يقابله من اليسار. انقر زوجاً لفكّه.</p> : null}
    </div>
  )
}

function parsePairs(s: string): Map<string, string> {
  const m = new Map<string, string>()
  for (const part of s.split(' | ')) {
    const [l, r] = part.split(' ← ')
    if (l && r) m.set(l.trim(), r.trim())
  }
  return m
}

/* -------------------------------- ORDERING -------------------------------- */

export function OrderingCard({ payload, disabled, onChange, result }: CardProps) {
  const [order, setOrder] = useState<string[]>([])
  useEffect(() => {
    if (payload.type === 'ORDERING') {
      const keys = payload.items.map((i) => i.key)
      setOrder(keys)
      onChange({ type: 'ORDERING', order: keys })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload])
  if (payload.type !== 'ORDERING') return null
  const move = (from: number, to: number) => {
    if (disabled || to < 0 || to >= order.length) return
    const next = [...order]
    const [it] = next.splice(from, 1)
    next.splice(to, 0, it!)
    setOrder(next)
    onChange({ type: 'ORDERING', order: next })
  }
  const label = (k: string) => payload.items.find((i) => i.key === k)?.text ?? ''
  return (
    <div className="space-y-3">
      <ol className="space-y-2">
        {order.map((k, i) => (
          <li key={k} className="flex items-center gap-2 rounded-xl border-2 border-border bg-card p-2 text-sm font-semibold">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
            <GripVertical className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <RichText text={label(k)} className="flex-1" />
            <div className="flex flex-col">
              <button type="button" disabled={disabled || i === 0} onClick={() => move(i, i - 1)} className="rounded p-1 hover:bg-muted disabled:opacity-30" aria-label="أعلى">
                <ArrowUp className="size-4" />
              </button>
              <button type="button" disabled={disabled || i === order.length - 1} onClick={() => move(i, i + 1)} className="rounded p-1 hover:bg-muted disabled:opacity-30" aria-label="أسفل">
                <ArrowDown className="size-4" />
              </button>
            </div>
          </li>
        ))}
      </ol>
      {result && !result.isCorrect ? <p className="text-sm text-success">الترتيب الصحيح: {result.correctText}</p> : null}
    </div>
  )
}
