import type { LucideIcon } from 'lucide-react'
import * as React from 'react'
import { cn, initials } from '@/lib/utils'

export function Progress({ value, className, tone = 'primary' }: { value: number | null | undefined; className?: string; tone?: 'primary' | 'success' | 'warning' | 'destructive' }) {
  const v = Math.max(0, Math.min(100, value ?? 0))
  const color = { primary: 'bg-primary', success: 'bg-success', warning: 'bg-warning', destructive: 'bg-destructive' }[tone]
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${v}%` }} />
    </div>
  )
}

export function Avatar({ name, className, size = 'md' }: { name: string; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-16 text-xl' }
  return (
    <div className={cn('flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-bold text-primary', sizes[size], className)} aria-hidden>
      {initials(name)}
    </div>
  )
}

export function Separator({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-border', className)} />
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />
}

export function Alert({ tone = 'info', title, children, className }: { tone?: 'info' | 'success' | 'warning' | 'destructive'; title?: string; children?: React.ReactNode; className?: string }) {
  const tones = {
    info: 'border-primary/30 bg-primary/5 text-foreground',
    success: 'border-success/30 bg-success/10 text-foreground',
    warning: 'border-warning/40 bg-warning/10 text-foreground',
    destructive: 'border-destructive/30 bg-destructive/10 text-foreground'
  }
  return (
    <div role="alert" className={cn('rounded-lg border p-4 text-sm', tones[tone], className)}>
      {title ? <p className="mb-1 font-bold">{title}</p> : null}
      {children}
    </div>
  )
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'default', className }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: LucideIcon; tone?: 'default' | 'success' | 'warning' | 'destructive'; className?: string }) {
  const tones = {
    default: 'text-primary bg-primary/10',
    success: 'text-success bg-success/10',
    warning: 'text-amber-700 bg-warning/20 dark:text-amber-300',
    destructive: 'text-destructive bg-destructive/10'
  }
  return (
    <div className={cn('flex items-start justify-between gap-3 rounded-lg border bg-card p-4 shadow-sm', className)}>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-extrabold tabular">{value}</p>
        {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
      </div>
      {Icon ? (
        <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', tones[tone])}>
          <Icon className="size-5" />
        </div>
      ) : null}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action, className }: { icon?: LucideIcon; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center', className)}>
      {Icon ? <Icon className="size-10 text-muted-foreground/60" /> : null}
      <p className="font-bold">{title}</p>
      {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action}
    </div>
  )
}

export function PageHeader({ title, description, actions, className }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {description ? <div className="mt-1 text-sm text-muted-foreground">{description}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function PhaseNote({ phase }: { phase: number }) {
  return (
    <div className="mb-4 rounded-lg border border-dashed border-accent/60 bg-accent/10 p-3 text-xs text-muted-foreground">
      هذه الوحدة مجدولة في المرحلة {phase} من خطة التنفيذ. ما يظهر هنا يُقرأ من قاعدة البيانات الحقيقية فقط.
    </div>
  )
}
