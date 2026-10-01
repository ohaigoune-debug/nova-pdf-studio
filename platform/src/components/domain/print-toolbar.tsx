'use client'

import { ArrowRight, FileCheck2, FileText, Printer } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** شريط فوق الورقة (لا يُطبع): طباعة/حفظ PDF، والتبديل بين الموضوع والتصحيح */
export function PrintToolbar({ examId, mode, title }: { examId: string; mode: 'subject' | 'correction'; title: string }) {
  useEffect(() => {
    document.title = `${mode === 'correction' ? 'التصحيح' : 'الموضوع'} — ${title}`
  }, [mode, title])
  const tab = (on: boolean) => cn('rounded-full border px-3 py-1 text-sm', on ? 'border-primary bg-primary text-primary-foreground' : 'bg-white hover:border-primary/50')
  return (
    <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b bg-white/90 px-4 py-2 backdrop-blur" dir="rtl">
      <div className="flex items-center gap-2">
        <Link href={`/teacher/exams/${examId}`} className="inline-flex items-center gap-1 text-sm text-primary underline">
          <ArrowRight className="size-4" /> العودة إلى المحرّر
        </Link>
        <Link href={`/print/exams/${examId}?mode=subject`} className={cn(tab(mode === 'subject'), 'inline-flex items-center gap-1')}>
          <FileText className="size-4" /> الموضوع
        </Link>
        <Link href={`/print/exams/${examId}?mode=correction`} className={cn(tab(mode === 'correction'), 'inline-flex items-center gap-1')}>
          <FileCheck2 className="size-4" /> التصحيح والسلّم
        </Link>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="hidden sm:inline">في نافذة الطباعة اختر «حفظ كـ PDF» — حجم A4.</span>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-4" /> طباعة / حفظ PDF
        </Button>
      </div>
    </div>
  )
}
