import * as React from 'react'
import { cn } from '@/lib/utils'

/* حقول أعلى قليلاً (44px) للمس المريح، خلفية محايدة، وحلقة تركيز واضحة بلا ظلّ صاخب */
const fieldBase =
  'flex w-full rounded-md border border-input bg-card px-3.5 text-sm shadow-[inset_0_1px_2px_hsl(var(--shadow-color)/0.04)] transition-[border-color,box-shadow] placeholder:text-muted-foreground/80 hover:border-primary/40 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50'

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, type, ...props }, ref) => (
  <input type={type} className={cn(fieldBase, 'h-11 file:border-0 file:bg-transparent file:text-sm file:font-medium', className)} ref={ref} {...props} />
))
Input.displayName = 'Input'

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea className={cn(fieldBase, 'min-h-[96px] py-2.5 leading-relaxed', className)} ref={ref} {...props} />
))
Textarea.displayName = 'Textarea'

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select className={cn(fieldBase, 'h-11 cursor-pointer', className)} ref={ref} {...props}>
    {children}
  </select>
))
Select.displayName = 'Select'

export { Input, Textarea, Select }
