'use client'

import { ArrowRight, FileCheck2, FileText, Printer } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { recordPrintAction } from '@/server/actions/exams.actions'

/** شريط فوق الورقة (لا يُطبع): طباعة/حفظ PDF، والتبديل بين الموضوع والتصحيح */
export function PrintToolbar({ examId, mode, variant, title, readOnly = false }: { examId: string; mode: 'subject' | 'correction'; variant: string; title: string; readOnly?: boolean }) {
  useEffect(() => {
    document.title = `${mode === 'correction' ? 'التصحيح' : 'الموضوع'}${variant !== 'A' ? ` (${variant})` : ''} — ${title}`
  }, [mode, variant, title])
  const tab = (on: boolean) => cn('rounded-full border px-3 py-1 text-sm', on ? 'border-primary bg-primary text-primary-foreground' : 'bg-white hover:border-primary/50')
  return (
    <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b bg-white/90 px-4 py-2 backdrop-blur" dir="rtl">
      <div className="flex items-center gap-2">
        {readOnly ? (
          <Link href="/store/orders" className="inline-flex items-center gap-1 text-sm text-primary underline">
            <ArrowRight className="size-4" /> طلباتي
          </Link>
        ) : (
          <Link href={`/teacher/exams/${examId}`} className="inline-flex items-center gap-1 text-sm text-primary underline">
            <ArrowRight className="size-4" /> العودة إلى المحرّر
          </Link>
        )}
        <Link href={`/print/exams/${examId}?mode=subject&variant=${variant}`} className={cn(tab(mode === 'subject'), 'inline-flex items-center gap-1')}>
          <FileText className="size-4" /> الموضوع
        </Link>
        <Link href={`/print/exams/${examId}?mode=correction&variant=${variant}`} className={cn(tab(mode === 'correction'), 'inline-flex items-center gap-1')}>
          <FileCheck2 className="size-4" /> التصحيح والسلّم
        </Link>
        <span className="ms-2 text-xs text-muted-foreground">النسخة:</span>
        {['A', 'B', 'C', 'D'].map((v) => (
          <Link key={v} href={`/print/exams/${examId}?mode=${mode}&variant=${v}`} className={tab(variant === v)} title="ترتيب مختلف للتمارين والاختيارات بنفس الصعوبة">
            {v}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="hidden sm:inline">في نافذة الطباعة اختر «حفظ كـ PDF» — حجم A4.</span>
        <Button
          size="sm"
          onClick={() => {
            // السجلّ لا يعطّل الطباعة: يُسجَّل في الخلفية ثم تُفتح نافذة الطباعة فوراً
            if (!readOnly) void recordPrintAction(examId, mode, variant)
            window.print()
          }}
        >
          <Printer className="size-4" /> طباعة / حفظ PDF
        </Button>
      </div>
    </div>
  )
}
