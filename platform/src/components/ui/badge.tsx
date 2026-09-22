import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wide transition-colors', {
  variants: {
    variant: {
      default: 'border-primary/15 bg-primary/10 text-primary',
      secondary: 'border-transparent bg-secondary text-secondary-foreground',
      success: 'border-success/20 bg-success/10 text-success',
      warning: 'border-warning/30 bg-warning/15 text-amber-800 dark:text-amber-300',
      destructive: 'border-destructive/20 bg-destructive/10 text-destructive',
      gold: 'border-accent/30 bg-accent/10 text-amber-800 dark:text-amber-200',
      outline: 'text-foreground',
      muted: 'border-transparent bg-muted text-muted-foreground'
    }
  },
  defaultVariants: { variant: 'default' }
})

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
