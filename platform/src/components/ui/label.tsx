'use client'

import * as LabelPrimitive from '@radix-ui/react-label'
import * as React from 'react'
import { cn } from '@/lib/utils'

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn('text-sm font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', className)}
    {...props}
  />
))
Label.displayName = 'Label'

/**
 * تسمية ظاهرة دائمة + تلميح أو خطأ مربوطان بالحقل (aria-describedby / aria-invalid) حين يُعطى htmlFor
 * وكان الابن عنصراً واحداً. لا يغيّر قيمة الحقل ولا سلوكه.
 */
export function Field({ label, htmlFor, hint, error, children, className }: { label: string; htmlFor?: string; hint?: string; error?: string; children: React.ReactNode; className?: string }) {
  const noteId = htmlFor && (error || hint) ? `${htmlFor}-${error ? 'error' : 'hint'}` : undefined
  const child =
    noteId && React.isValidElement<{ 'aria-describedby'?: string; 'aria-invalid'?: boolean }>(children)
      ? React.cloneElement(children, {
          'aria-describedby': [children.props['aria-describedby'], noteId].filter(Boolean).join(' '),
          ...(error ? { 'aria-invalid': true } : {})
        })
      : children
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {child}
      {error ? (
        <p id={noteId} className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={noteId} className="text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export { Label }
