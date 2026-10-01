'use client'

import { Copy, Printer, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { deleteExamAction, duplicateExamAction } from '@/server/actions/exams.actions'

export function ExamListActions({ id }: { id: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <div className="flex justify-end gap-1">
      <Button asChild size="sm" variant="ghost" title="طباعة / PDF">
        <a href={`/print/exams/${id}?mode=subject`} target="_blank" rel="noreferrer">
          <Printer className="size-4" />
        </a>
      </Button>
      <Button size="sm" variant="ghost" title="نسخ" loading={pending} onClick={() => start(async () => { const r = await duplicateExamAction(id); if (!r.ok) toast('error', r.error.message); else router.push(`/teacher/exams/${r.data.id}`) })}>
        <Copy className="size-4" />
      </Button>
      <Button size="sm" variant="ghost" title="حذف" loading={pending} onClick={() => confirm('حذف الامتحان؟') && start(async () => { const r = await deleteExamAction(id); if (!r.ok) toast('error', r.error.message); else router.refresh() })}>
        <Trash2 className="size-4" />
      </Button>
    </div>
  )
}
