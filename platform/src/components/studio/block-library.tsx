'use client'

import { BookmarkCheck, Bookmark, ChevronDown, ChevronUp, FileText, Image as ImageIcon, LayoutList, ListOrdered, Minus, MessageSquareText, PenLine, Plus, Scissors, Sigma, Table2, TrendingUp, Trash2, Triangle, Type, ScrollText, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { BLOCK_AR, blocksForSubject, blockSummary, type BlockType } from '@/lib/exam-blocks'
import { cn } from '@/lib/utils'
import { deleteLibraryItemAction, listLibraryItemsAction, updateLibraryItemAction } from '@/server/actions/studio.actions'
import type { LibraryListItem } from '@/server/services/exam-studio.service'
import { DND } from './paper'

const ICONS: Record<BlockType, LucideIcon> = { HEADING: Type, PARAGRAPH: PenLine, EQUATION: Sigma, GRAPH: TrendingUp, GEOMETRY: Triangle, TABLE: Table2, VARIATION_TABLE: LayoutList, POETRY: ScrollText, IMAGE: ImageIcon, ANSWER_SPACE: ListOrdered, SEPARATOR: Minus, NOTE: MessageSquareText }

/**
 * شريط الكتل: الأنسب لمادة الامتحان أولاً (الوضع المركّز يُخفي الباقي)، ثم العناصر الأساسية، ثم كتلي المحفوظة.
 * كل زرّ يُضيف في آخر الورقة، وكل بطاقة تُسحب إلى الموضع المطلوب.
 */
export function BlockLibrary({ subjectCode, subjectId, focused, onAddBlock, onAddBasic, onInsertLibrary, pending, refreshKey }: { subjectCode: string | null; subjectId: string | null; focused: boolean; onAddBlock: (t: BlockType) => void; onAddBasic: (k: 'EXERCISE' | 'QUESTION' | 'TEXT' | 'PAGE_BREAK') => void; onInsertLibrary: (id: string) => void; pending: boolean; refreshKey: number }) {
  const { primary, secondary } = blocksForSubject(subjectCode)
  const [more, setMore] = useState(!focused)
  useEffect(() => setMore(!focused), [focused])
  const Tile = ({ t }: { t: BlockType }) => {
    const Icon = ICONS[t]
    return (
      <button type="button" draggable onDragStart={(e) => { e.dataTransfer.setData(DND.blockType, t); e.dataTransfer.effectAllowed = 'copy' }} onClick={() => onAddBlock(t)} disabled={pending} className="flex cursor-grab items-center gap-2 rounded-lg border bg-background p-2 text-start text-xs hover:border-primary/60 hover:bg-primary/5 active:cursor-grabbing" title={BLOCK_AR[t].hint}>
        <Icon className="size-4 shrink-0 text-primary" />
        <span className="font-semibold">{BLOCK_AR[t].label}</span>
      </button>
    )
  }
  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="mb-1.5 flex items-center justify-between font-bold">
          <span>الكتل</span>
          <span className="text-[11px] font-normal text-muted-foreground">اسحب أو اضغط</span>
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {primary.map((t) => (
            <Tile key={t} t={t} />
          ))}
          {more ? secondary.map((t) => <Tile key={t} t={t} />) : null}
        </div>
        {secondary.length ? (
          <button type="button" className="mt-1.5 flex items-center gap-1 text-xs text-primary" onClick={() => setMore((v) => !v)}>
            {more ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />} {more ? 'الأساسية فقط' : `كل الكتل (${secondary.length} أخرى)`}
          </button>
        ) : null}
      </div>
      <div>
        <p className="mb-1.5 font-bold">عناصر الورقة</p>
        <div className="grid grid-cols-2 gap-1.5">
          <Button size="sm" variant="outline" className="justify-start" onClick={() => onAddBasic('EXERCISE')} disabled={pending}>
            <Plus className="size-4" /> تمرين حرّ
          </Button>
          <Button size="sm" variant="outline" className="justify-start" onClick={() => onAddBasic('QUESTION')} disabled={pending}>
            <Plus className="size-4" /> سؤال
          </Button>
          <Button size="sm" variant="ghost" className="justify-start" onClick={() => onAddBasic('TEXT')} disabled={pending}>
            <FileText className="size-4" /> تعليمات
          </Button>
          <Button size="sm" variant="ghost" className="justify-start" onClick={() => onAddBasic('PAGE_BREAK')} disabled={pending}>
            <Scissors className="size-4" /> فاصل صفحة
          </Button>
        </div>
      </div>
      <MyBlocks subjectId={subjectId} onInsert={onInsertLibrary} pending={pending} refreshKey={refreshKey} />
    </div>
  )
}

function MyBlocks({ subjectId, onInsert, pending, refreshKey }: { subjectId: string | null; onInsert: (id: string) => void; pending: boolean; refreshKey: number }) {
  const [items, setItems] = useState<LibraryListItem[]>([])
  const [q, setQ] = useState('')
  const [loaded, setLoaded] = useState(false)
  const load = async () => {
    const r = await listLibraryItemsAction({ kind: 'BLOCK', subjectId, q: q || null })
    if (r.ok) setItems(r.data)
    setLoaded(true)
  }
  useEffect(() => {
    const t = setTimeout(() => void load(), 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, subjectId, refreshKey])
  const fav = async (it: LibraryListItem) => {
    const r = await updateLibraryItemAction(it.id, { isFavorite: !it.isFavorite })
    if (!r.ok) return toast('error', r.error.message)
    void load()
  }
  const del = async (it: LibraryListItem) => {
    if (!confirm(`حذف «${it.title}» من مكتبتك؟`)) return
    const r = await deleteLibraryItemAction(it.id)
    if (!r.ok) return toast('error', r.error.message)
    toast('success', 'حُذفت')
    void load()
  }
  return (
    <div>
      <p className="mb-1.5 flex items-center justify-between font-bold">
        <span>كتلي المحفوظة</span>
        <span className="text-[11px] font-normal text-muted-foreground">{items.length}</span>
      </p>
      {loaded && items.length === 0 && !q ? <p className="rounded-lg border border-dashed p-2 text-xs text-muted-foreground">احفظ أي كتلة من الورقة بزرّ «حفظ في مكتبتي» لتعيد استعمالها هنا.</p> : <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث في كتلي…" className="mb-1.5 h-8" />}
      <ul className="space-y-1">
        {items.map((it) => {
          const b = it.payload.block
          return (
            <li key={it.id} draggable onDragStart={(e) => { e.dataTransfer.setData(DND.library, it.id); e.dataTransfer.effectAllowed = 'copy' }} className="cursor-grab rounded-lg border bg-background p-2 text-xs hover:border-primary/60">
              <div className="flex items-center justify-between gap-1">
                <span className="truncate font-semibold">{it.title}</span>
                <span className="flex shrink-0 items-center gap-0.5">
                  <button type="button" onClick={() => void fav(it)} title="مفضّلة" className={cn('rounded p-0.5', it.isFavorite ? 'text-accent' : 'text-muted-foreground')}>
                    {it.isFavorite ? <BookmarkCheck className="size-3.5" /> : <Bookmark className="size-3.5" />}
                  </button>
                  <button type="button" onClick={() => void del(it)} title="حذف" className="rounded p-0.5 text-muted-foreground hover:text-destructive">
                    <Trash2 className="size-3.5" />
                  </button>
                </span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-muted-foreground" dir="auto">
                {b ? <Badge variant="muted">{BLOCK_AR[b.type].label}</Badge> : null} {b ? blockSummary(b) : ''}
              </p>
              <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{it.usageCount ? `استُعملت ${it.usageCount}` : ''}</span>
                <Button size="sm" variant="outline" className="h-6 px-2" onClick={() => onInsert(it.id)} disabled={pending}>
                  <Plus className="size-3" /> إدراج
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
