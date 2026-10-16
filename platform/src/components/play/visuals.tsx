'use client'

import * as Icons from 'lucide-react'
import { cn } from '@/lib/utils'

/** ألوان المواد (أسماء Tailwind الثابتة حتى يلتقطها المصرّف) */
const SUBJECT_TONES: Record<string, { bg: string; text: string; ring: string; soft: string }> = {
  emerald: { bg: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', ring: 'ring-emerald-500/30', soft: 'bg-emerald-500/10' },
  blue: { bg: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-300', ring: 'ring-blue-500/30', soft: 'bg-blue-500/10' },
  violet: { bg: 'bg-violet-500', text: 'text-violet-700 dark:text-violet-300', ring: 'ring-violet-500/30', soft: 'bg-violet-500/10' },
  green: { bg: 'bg-green-600', text: 'text-green-700 dark:text-green-300', ring: 'ring-green-500/30', soft: 'bg-green-500/10' },
  sky: { bg: 'bg-sky-500', text: 'text-sky-700 dark:text-sky-300', ring: 'ring-sky-500/30', soft: 'bg-sky-500/10' },
  rose: { bg: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-300', ring: 'ring-rose-500/30', soft: 'bg-rose-500/10' },
  amber: { bg: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300', ring: 'ring-amber-500/30', soft: 'bg-amber-500/10' },
  teal: { bg: 'bg-teal-500', text: 'text-teal-700 dark:text-teal-300', ring: 'ring-teal-500/30', soft: 'bg-teal-500/10' },
  lime: { bg: 'bg-lime-600', text: 'text-lime-700 dark:text-lime-300', ring: 'ring-lime-500/30', soft: 'bg-lime-500/10' },
  cyan: { bg: 'bg-cyan-500', text: 'text-cyan-700 dark:text-cyan-300', ring: 'ring-cyan-500/30', soft: 'bg-cyan-500/10' },
  fuchsia: { bg: 'bg-fuchsia-500', text: 'text-fuchsia-700 dark:text-fuchsia-300', ring: 'ring-fuchsia-500/30', soft: 'bg-fuchsia-500/10' },
  orange: { bg: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-300', ring: 'ring-orange-500/30', soft: 'bg-orange-500/10' },
  yellow: { bg: 'bg-yellow-500', text: 'text-yellow-700 dark:text-yellow-300', ring: 'ring-yellow-500/30', soft: 'bg-yellow-500/10' },
  slate: { bg: 'bg-slate-500', text: 'text-slate-700 dark:text-slate-300', ring: 'ring-slate-500/30', soft: 'bg-slate-500/10' },
  zinc: { bg: 'bg-zinc-500', text: 'text-zinc-700 dark:text-zinc-300', ring: 'ring-zinc-500/30', soft: 'bg-zinc-500/10' },
  indigo: { bg: 'bg-indigo-500', text: 'text-indigo-700 dark:text-indigo-300', ring: 'ring-indigo-500/30', soft: 'bg-indigo-500/10' },
  primary: { bg: 'bg-primary', text: 'text-primary', ring: 'ring-primary/30', soft: 'bg-primary/10' }
}

export function tone(color: string) {
  return SUBJECT_TONES[color] ?? SUBJECT_TONES.primary!
}

export function LucideIcon({ name, className }: { name: string; className?: string }) {
  const Cmp = (Icons as unknown as Record<string, Icons.LucideIcon>)[name]
  if (!Cmp) return <Icons.BookOpen className={className} />
  return <Cmp className={className} />
}

export function SubjectBubble({ color, icon, size = 'md', className }: { color: string; icon: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const t = tone(color)
  const sizes = { sm: 'size-9 [&>svg]:size-4', md: 'size-12 [&>svg]:size-6', lg: 'size-16 [&>svg]:size-8' }
  return (
    <div className={cn('flex shrink-0 items-center justify-center rounded-2xl text-white shadow-sm', t.bg, sizes[size], className)} aria-hidden>
      <LucideIcon name={icon} />
    </div>
  )
}

/** حلقة تقدم دائرية خفيفة (SVG) */
export function ProgressRing({ value, size = 96, stroke = 10, className, children, tone: ringTone = 'primary' }: { value: number; size?: number; stroke?: number; className?: string; children?: React.ReactNode; tone?: 'primary' | 'success' | 'warning' | 'accent' }) {
  const v = Math.max(0, Math.min(100, value))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const color = { primary: 'stroke-primary', success: 'stroke-success', warning: 'stroke-warning', accent: 'stroke-accent' }[ringTone]
  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-muted" />
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} strokeLinecap="round" className={cn('fill-none transition-[stroke-dashoffset] duration-700 ease-out', color)} strokeDasharray={c} strokeDashoffset={c - (c * v) / 100} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}

export function DifficultyPill({ value }: { value: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    EASY: { label: 'سهل', cls: 'bg-success/15 text-success' },
    MEDIUM: { label: 'متوسط', cls: 'bg-warning/20 text-amber-800 dark:text-amber-300' },
    HARD: { label: 'صعب', cls: 'bg-destructive/15 text-destructive' }
  }
  const d = map[value] ?? { label: value, cls: 'bg-muted text-muted-foreground' }
  return <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', d.cls)}>{d.label}</span>
}
