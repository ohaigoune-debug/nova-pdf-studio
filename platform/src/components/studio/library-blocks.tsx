'use client'

import { Bookmark, BookmarkCheck, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { BLOCK_AR, blockSummary } from '@/lib/exam-blocks'
import { cn, formatDate } from '@/lib/utils'
import { deleteLibraryItemAction, updateLibraryItemAction } from '@/server/actions/studio.actions'
import type { LibraryListItem } from '@/server/services/exam-studio.service'

/** جدول الكتل والترويسات المحفوظة في مكتبة الأستاذ: مفضّلة وحذف (الإدراج من داخل الاستوديو) */
export function LibraryBlocks({ items }: { items: LibraryListItem[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, ok: string) =>
    start(async () => {
      const r = await fn()
      if (!r.ok) return toast('error', r.error!.message)
      toast('success', ok)
      router.refresh()
    })
  if (items.length === 0) return <p className="text-sm text-muted-foreground">لا كتل محفوظة بعد. من الاستوديو: زرّ «حفظ في مكتبتي» على أي كتلة، أو «حفظ الترويسة».</p>
  return (
    <ul className="divide-y text-sm">
      {items.map((it) => (
        <li key={it.id} className="flex items-center justify-between gap-2 py-2">
          <div className="min-w-0">
            <p className="truncate font-semibold">
              {it.title} <Badge variant="muted">{it.kind === 'HEADER' ? 'ترويسة' : it.payload.block ? BLOCK_AR[it.payload.block.type].label : 'كتلة'}</Badge>
            </p>
            <p className="truncate text-xs text-muted-foreground" dir="auto">
              {it.kind === 'HEADER' ? [it.payload.header?.school, it.payload.layout?.headerLayout].filter(Boolean).join(' · ') : it.payload.block ? blockSummary(it.payload.block) : ''} · {it.subjectName ?? 'كل المواد'} · {it.usageCount ? `استُعملت ${it.usageCount} · ` : ''}
              {formatDate(it.updatedAt)}
            </p>
          </div>
          <span className="flex shrink-0 gap-1">
            <Button size="sm" variant="ghost" onClick={() => run(() => updateLibraryItemAction(it.id, { isFavorite: !it.isFavorite }), it.isFavorite ? 'أُزيلت من المفضّلة' : 'أُضيفت إلى المفضّلة')} loading={pending} className={cn(it.isFavorite ? 'text-accent' : '')}>
              {it.isFavorite ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => confirm(`حذف «${it.title}»؟`) && run(() => deleteLibraryItemAction(it.id), 'حُذفت')} loading={pending}>
              <Trash2 className="size-4" />
            </Button>
          </span>
        </li>
      ))}
    </ul>
  )
}
