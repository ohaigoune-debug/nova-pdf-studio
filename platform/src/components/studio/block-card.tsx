'use client'

import { BookmarkPlus, Check, Copy, GripVertical, Settings2, Trash2, X } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BLOCK_AR, blockSummary, type StudioBlock } from '@/lib/exam-blocks'
import { saveLibraryItemAction } from '@/server/actions/studio.actions'
import { duplicateItemAction, removeItemAction, restoreItemsAction, updateItemAction } from '@/server/actions/exams.actions'
import type { ExamItemRow } from '@/server/db/schema'
import { BlockEditor } from './block-editors'
import { stateOf, type Run } from './types'

const BlockView = dynamic(() => import('./block-view').then((m) => m.BlockView), { ssr: false, loading: () => <div className="h-8 animate-pulse rounded bg-muted" /> })

/**
 * كتلة في الورقة: تُعرض كما ستُطبع، وتُحرَّر في مكانها بحفظ تلقائي (بعد توقّف الكتابة) وتراجع حقيقي.
 */
export function BlockCard({ item, examId, position, assets, subjectId, run, pending, openOnMount = false }: { item: ExamItemRow; examId: string; position: number; assets: Record<string, string>; subjectId: string | null; run: Run; pending: boolean; openOnMount?: boolean }) {
  const block = item.snapshot.block!
  const [editing, setEditing] = useState(openOnMount)
  const [draft, setDraft] = useState<StudioBlock>(block)
  const saved = useRef<StudioBlock>(block)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    saved.current = block
    if (!editing) setDraft(block)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block])

  const commit = (b: StudioBlock) => {
    const prev = saved.current
    if (JSON.stringify(prev) === JSON.stringify(b)) return
    saved.current = b
    run(() => updateItemAction(examId, item.id, { block: b }), null, {
      label: `تعديل ${BLOCK_AR[b.type].label}`,
      undo: () => updateItemAction(examId, item.id, { block: prev }),
      redo: () => updateItemAction(examId, item.id, { block: b })
    })
  }
  const change = (b: StudioBlock) => {
    setDraft(b)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => commit(b), 900)
  }
  const close = () => {
    if (timer.current) clearTimeout(timer.current)
    commit(draft)
    setEditing(false)
  }
  const remove = () => {
    const state = stateOf(item, position)
    run(() => removeItemAction(examId, item.id), null, {
      label: `حذف ${BLOCK_AR[block.type].label}`,
      undo: () => restoreItemsAction(examId, [state]),
      redo: () => removeItemAction(examId, item.id)
    })
  }
  const saveToLibrary = () => {
    const title = prompt('اسم الكتلة في مكتبتك:', blockSummary(block).slice(0, 60))
    if (title === null) return
    run(() => saveLibraryItemAction({ kind: 'BLOCK', title: title || BLOCK_AR[block.type].label, subjectId, block }), 'حُفظت في «مكتبتي»')
  }
  const placeholderImage = block.type === 'IMAGE' && block.fileId === '00000000-0000-4000-8000-000000000000'
  return (
    <div className="group p-2">
      <div className="flex items-start gap-2">
        <GripVertical className="mt-1 size-4 shrink-0 cursor-grab text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1 text-[11px]">
            <Badge variant="muted">{BLOCK_AR[block.type].label}</Badge>
            {placeholderImage ? <Badge variant="warning">بلا صورة بعد</Badge> : null}
            {editing ? <span className="text-muted-foreground">يُحفظ تلقائياً</span> : null}
          </div>
          {editing ? (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <BlockEditor block={draft} onChange={change} assets={assets} />
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={close}>
                  <Check className="size-4" /> تمّ
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (timer.current) clearTimeout(timer.current)
                    setDraft(saved.current)
                    setEditing(false)
                  }}
                >
                  <X className="size-4" /> إغلاق بلا حفظ المسودة
                </Button>
              </div>
            </div>
          ) : (
            <div className="studio-paper cursor-text rounded-md text-[13.5px] text-black hover:bg-muted/30" onDoubleClick={() => setEditing(true)} title="نقر مزدوج للتعديل">
              <BlockView block={block} assets={assets} />
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <Button size="sm" variant="ghost" title="تعديل" onClick={() => (editing ? close() : setEditing(true))}>
            <Settings2 className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" title="نسخ" onClick={() => run(() => duplicateItemAction(examId, item.id))} loading={pending}>
            <Copy className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" title="حفظ في مكتبتي" onClick={saveToLibrary}>
            <BookmarkPlus className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" title="حذف" onClick={remove} loading={pending}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      {editing && block.type === 'IMAGE' && placeholderImage ? <p className="ms-6 mt-1 text-xs text-muted-foreground">ارفع صورة من الزرّ أعلاه؛ لن تظهر في الطباعة قبل ذلك.</p> : null}
    </div>
  )
}
