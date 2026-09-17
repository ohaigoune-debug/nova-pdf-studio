'use client'

import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export type ToastTone = 'success' | 'error' | 'info' | 'warning'
export interface ToastItem {
  id: number
  tone: ToastTone
  title: string
  description?: string
}

type Listener = (items: ToastItem[]) => void
let items: ToastItem[] = []
let seq = 0
const listeners = new Set<Listener>()

function emit() {
  for (const l of listeners) l(items)
}

export function toast(tone: ToastTone, title: string, description?: string, ttl = 4500) {
  const id = ++seq
  items = [...items, { id, tone, title, description }]
  emit()
  setTimeout(() => dismiss(id), ttl)
}

export function dismiss(id: number) {
  items = items.filter((i) => i.id !== id)
  emit()
}

export function Toaster() {
  const [list, setList] = useState<ToastItem[]>([])
  useEffect(() => {
    listeners.add(setList)
    return () => {
      listeners.delete(setList)
    }
  }, [])
  const icons = { success: CheckCircle2, error: XCircle, info: Info, warning: TriangleAlert }
  const tones = {
    success: 'border-success/40 bg-card',
    error: 'border-destructive/40 bg-card',
    info: 'border-primary/40 bg-card',
    warning: 'border-warning/50 bg-card'
  }
  const iconTones = { success: 'text-success', error: 'text-destructive', info: 'text-primary', warning: 'text-amber-600' }
  return (
    <div className="pointer-events-none fixed bottom-4 start-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
      {list.map((i) => {
        const Icon = icons[i.tone]
        return (
          <div key={i.id} className={cn('pointer-events-auto flex items-start gap-3 rounded-lg border p-3 shadow-lg animate-fade-in', tones[i.tone])} role="status">
            <Icon className={cn('mt-0.5 size-5 shrink-0', iconTones[i.tone])} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{i.title}</p>
              {i.description ? <p className="text-xs text-muted-foreground">{i.description}</p> : null}
            </div>
            <button onClick={() => dismiss(i.id)} className="text-muted-foreground hover:text-foreground" aria-label="إغلاق">
              <X className="size-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
