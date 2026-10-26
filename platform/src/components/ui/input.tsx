import * as React from 'react'
import { cn } from '@/lib/utils'

/* حقول 48px بخط 16px (لا تكبير تلقائي على iOS)، حدّ مقروء، وحلقة تركيز واضحة؛ aria-invalid يلوّن الخطأ */
const fieldBase =
  'flex w-full rounded-md border border-input bg-card px-3.5 text-base text-foreground transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground hover:border-primary/60 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 aria-[invalid=true]:border-destructive disabled:cursor-not-allowed disabled:opacity-50'

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, type, ...props }, ref) => (
  <input type={type} className={cn(fieldBase, 'h-12 file:border-0 file:bg-transparent file:text-sm file:font-medium', className)} ref={ref} {...props} />
))
Input.displayName = 'Input'

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea className={cn(fieldBase, 'min-h-[96px] py-3 leading-relaxed', className)} ref={ref} {...props} />
))
Textarea.displayName = 'Textarea'

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select className={cn(fieldBase, 'h-12 cursor-pointer', className)} ref={ref} {...props}>
    {children}
  </select>
))
Select.displayName = 'Select'

export { Input, Textarea, Select }
