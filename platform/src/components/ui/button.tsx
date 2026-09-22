import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // تدرّج خفيف وحافة ضوئية علوية: زرّ له عمق دون أن يصرخ
        default:
          'bg-gradient-to-b from-primary to-primary/90 text-primary-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.15),0_1px_2px_hsl(var(--shadow-color)/0.2)] hover:from-primary/95 hover:to-primary/85 hover:shadow-[inset_0_1px_0_hsl(0_0%_100%/0.15),0_6px_16px_-6px_hsl(var(--primary)/0.6)]',
        gold: 'bg-gradient-to-b from-accent to-accent/90 text-accent-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.35),0_1px_2px_hsl(var(--shadow-color)/0.2)] hover:shadow-[0_8px_20px_-8px_hsl(var(--accent)/0.7)]',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        success: 'bg-success text-success-foreground shadow-sm hover:bg-success/90',
        outline: 'border border-input bg-card shadow-sm hover:border-primary/40 hover:bg-primary/5 hover:text-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
        ghost: 'hover:bg-muted hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline'
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-sm px-3 text-xs',
        lg: 'h-12 rounded-lg px-6 text-base',
        icon: 'size-10'
      }
    },
    defaultVariants: { variant: 'default', size: 'default' }
  }
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    if (asChild) {
      // Slot يتطلب عنصراً واحداً بالضبط
      return (
        <Slot className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
          {children}
        </Slot>
      )
    }
    return (
      <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} disabled={disabled || loading} {...props}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : null}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
