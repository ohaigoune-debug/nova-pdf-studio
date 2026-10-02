'use client'

import { ArrowLeft, ArrowRight, Eye, EyeOff, Maximize2, Minus, Plus, X } from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { itemPoints } from '@/lib/exam-points'
import { cn } from '@/lib/utils'
import type { ExamView } from '@/server/services/exams.service'

const RichText = dynamic(() => import('./block-view').then((m) => m.RichText), { ssr: false })
const BlockView = dynamic(() => import('./block-view').then((m) => m.BlockView), { ssr: false })
const FiguresView = dynamic(() => import('./block-view').then((m) => m.FiguresView), { ssr: false })
const BlockStyles = dynamic(() => import('./block-view').then((m) => m.BlockStyles), { ssr: false })

/**
 * وضع السبّورة: الورقة عنصراً عنصراً بخطّ كبير على شاشة القسم (الأسهم للتنقّل، + / − للتكبير، H لإظهار الحلّ).
 * وحدة مستقلّة: لا تعدّل شيئاً، وتقرأ الورقة نفسها التي تُطبع.
 */
export function Board({ exam }: { exam: ExamView }) {
  const slides = useMemo(() => exam.items.filter((i) => i.kind !== 'PAGE_BREAK'), [exam.items])
  const [i, setI] = useState(0)
  const [zoom, setZoom] = useState(1.4)
  const [showSolution, setShowSolution] = useState(false)
  const [dark, setDark] = useState(false)
  const cur = slides[i]
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'PageDown' || e.key === ' ') setI((k) => Math.min(slides.length - 1, k + 1))
      else if (e.key === 'ArrowRight' || e.key === 'PageUp') setI((k) => Math.max(0, k - 1))
      else if (e.key === '+') setZoom((z) => Math.min(3, z + 0.1))
      else if (e.key === '-') setZoom((z) => Math.max(0.8, z - 0.1))
      else if (e.key.toLowerCase() === 'h') setShowSolution((v) => !v)
      else if (e.key === 'Home') setI(0)
      else if (e.key === 'End') setI(slides.length - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [slides.length])
  const full = () => document.documentElement.requestFullscreen?.().catch(() => undefined)
  return (
    <div className={cn('fixed inset-0 z-50 flex flex-col', dark ? 'bg-neutral-950 text-neutral-100' : 'bg-white text-black')} dir="rtl">
      <link rel="stylesheet" href="/katex/katex.min.css" />
      <BlockStyles />
      <header className="flex flex-wrap items-center gap-2 border-b border-neutral-300/40 px-3 py-1.5 text-sm">
        <span className="font-bold">{exam.title}</span>
        <span className="opacity-70">
          {i + 1} / {slides.length}
        </span>
        <span className="ms-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setI((k) => Math.max(0, k - 1))} disabled={i === 0} title="السابق (→)">
            <ArrowRight className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setI((k) => Math.min(slides.length - 1, k + 1))} disabled={i >= slides.length - 1} title="التالي (←)">
            <ArrowLeft className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setZoom((z) => Math.max(0.8, z - 0.1))} title="تصغير (−)">
            <Minus className="size-4" />
          </Button>
          <span className="w-10 text-center tabular text-xs">{Math.round(zoom * 100)}%</span>
          <Button size="sm" variant="ghost" onClick={() => setZoom((z) => Math.min(3, z + 0.1))} title="تكبير (+)">
            <Plus className="size-4" />
          </Button>
          <Button size="sm" variant={showSolution ? 'default' : 'ghost'} onClick={() => setShowSolution((v) => !v)} title="إظهار/إخفاء الحلّ (H)">
            {showSolution ? <EyeOff className="size-4" /> : <Eye className="size-4" />} الحلّ
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDark((v) => !v)} title="فاتح/داكن">
            {dark ? 'فاتح' : 'داكن'}
          </Button>
          <Button size="sm" variant="ghost" onClick={full} title="ملء الشاشة">
            <Maximize2 className="size-4" />
          </Button>
          <Button asChild size="sm" variant="ghost" title="خروج">
            <Link href={`/teacher/exams/${exam.id}`}>
              <X className="size-4" />
            </Link>
          </Button>
        </span>
      </header>
      <main className="flex-1 overflow-auto p-6 sm:p-10">
        {!cur ? (
          <p className="text-center opacity-70">الورقة فارغة.</p>
        ) : (
          <div className={cn('studio-paper mx-auto max-w-5xl leading-loose', dark ? 'text-neutral-100 [&_.katex]:text-neutral-100' : 'text-black')} style={{ fontSize: `${zoom * 16}px` }}>
            {cur.kind === 'BLOCK' && cur.snapshot.block ? (
              <BlockView block={cur.snapshot.block} assets={exam.assets} className={dark ? 'invert-figures' : ''} />
            ) : (
              <>
                <h2 className="mb-4 flex items-baseline justify-between border-b border-current/30 pb-2 font-bold">
                  <span>{cur.kind === 'TEXT' ? 'تعليمات' : exam.numbering[cur.id]}</span>
                  {cur.kind !== 'TEXT' ? <span className="text-[0.7em] opacity-70">({itemPoints(cur)} ن)</span> : null}
                </h2>
                {cur.snapshot.title ? <p className="font-bold">{cur.snapshot.title}</p> : null}
                <RichText text={cur.snapshot.body} />
                <FiguresView figures={cur.snapshot.figures} assets={exam.assets} />
                {cur.snapshot.options?.length ? (
                  <ol className="mt-3 space-y-1 ps-6">
                    {cur.snapshot.options.map((o, k) => (
                      <li key={k} className={cn(showSolution && o.isCorrect ? 'font-bold text-emerald-500' : '')}>
                        {['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح'][k]}) <RichText text={o.label} inline />
                      </li>
                    ))}
                  </ol>
                ) : null}
                {cur.snapshot.children?.length ? (
                  <ol className="mt-3 list-decimal space-y-2 ps-8">
                    {cur.snapshot.children.map((c, k) => (
                      <li key={k}>
                        <RichText text={c.body} inline /> <span className="text-[0.7em] opacity-70">({c.points ?? 0} ن)</span>
                        {showSolution && c.solution ? (
                          <div className="mt-1 border-s-4 border-emerald-500 ps-3 text-[0.9em] opacity-90">
                            <RichText text={c.solution} />
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                ) : null}
                {showSolution && cur.snapshot.solution ? (
                  <div className="mt-4 border-s-4 border-emerald-500 ps-3 text-[0.9em]">
                    <p className="font-bold">الحلّ:</p>
                    <RichText text={cur.snapshot.solution} />
                  </div>
                ) : null}
              </>
            )}
          </div>
        )}
      </main>
      <footer className="flex justify-center gap-1 border-t border-neutral-300/40 p-1.5">
        {slides.map((s, k) => (
          <button key={s.id} type="button" onClick={() => setI(k)} className={cn('h-2 w-6 rounded-full', k === i ? 'bg-primary' : 'bg-neutral-400/50')} title={exam.numbering[s.id] ?? s.kind} />
        ))}
      </footer>
      <style>{`.invert-figures svg { filter: invert(1) hue-rotate(180deg); }`}</style>
    </div>
  )
}
