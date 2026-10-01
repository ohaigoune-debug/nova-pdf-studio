'use client'

import { Archive, ArchiveRestore, BookTemplate, Copy, History, Printer, Trash2, Wand2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { archiveExamAction, deleteExamAction, duplicateExamAction, setTemplateAction, createFromTemplateAction } from '@/server/actions/exams.actions'

export function ExamListActions({ id, isTemplate, archived }: { id: string; isTemplate?: boolean; archived?: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, after?: () => void, ok?: string) =>
    start(async () => {
      const r = await fn()
      if (!r.ok) return toast('error', r.error!.message)
      if (ok) toast('success', ok)
      after ? after() : router.refresh()
    })
  return (
    <div className="flex justify-end gap-1">
      {isTemplate ? (
        <Button size="sm" variant="outline" title="امتحان جديد من هذا القالب" loading={pending} onClick={() => start(async () => { const r = await createFromTemplateAction(id); if (!r.ok) toast('error', r.error.message); else router.push(`/teacher/exams/${r.data.id}`) })}>
          <Wand2 className="size-4" /> استعمال
        </Button>
      ) : null}
      <Button asChild size="sm" variant="ghost" title="طباعة / PDF">
        <a href={`/print/exams/${id}?mode=subject`} target="_blank" rel="noreferrer">
          <Printer className="size-4" />
        </a>
      </Button>
      <Button asChild size="sm" variant="ghost" title="السجلّ">
        <Link href={`/teacher/exams/${id}/history`}>
          <History className="size-4" />
        </Link>
      </Button>
      <Button size="sm" variant="ghost" title="نسخ" loading={pending} onClick={() => start(async () => { const r = await duplicateExamAction(id); if (!r.ok) toast('error', r.error.message); else router.push(`/teacher/exams/${r.data.id}`) })}>
        <Copy className="size-4" />
      </Button>
      {!archived ? (
        <Button size="sm" variant="ghost" title={isTemplate ? 'إلغاء القالب' : 'اجعله قالباً'} loading={pending} onClick={() => run(() => setTemplateAction(id, !isTemplate), undefined, isTemplate ? 'لم يعد قالباً' : 'أصبح قالباً: تجده في «قوالبي»')}>
          <BookTemplate className={isTemplate ? 'size-4 text-primary' : 'size-4'} />
        </Button>
      ) : null}
      <Button size="sm" variant="ghost" title={archived ? 'استرجاع من الأرشيف' : 'أرشفة'} loading={pending} onClick={() => run(() => archiveExamAction(id, !archived), undefined, archived ? 'استُرجع كمسودة' : 'أُرشف')}>
        {archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
      </Button>
      <Button size="sm" variant="ghost" title="حذف" loading={pending} onClick={() => confirm('حذف الامتحان؟') && run(() => deleteExamAction(id))}>
        <Trash2 className="size-4" />
      </Button>
    </div>
  )
}
