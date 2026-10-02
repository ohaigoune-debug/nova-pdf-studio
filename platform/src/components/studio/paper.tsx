'use client'

import { FileText } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { EmptyState } from '@/components/ui/misc'
import { cn } from '@/lib/utils'
import type { ExamItemRow } from '@/server/db/schema'
import type { ExamView } from '@/server/services/exams.service'
import { BlockCard } from './block-card'
import { ItemCard } from './item-card'
import type { Run } from './types'

export const DND = { item: 'text/x-exam-item', bank: 'text/x-bank-question', blockType: 'text/x-block-type', library: 'text/x-library-item' } as const

export interface DropPayload {
  kind: 'item' | 'bank' | 'blockType' | 'library'
  value: string
}

/** يقسّم العناصر صفحاتٍ عند فواصل الصفحات (الصفحة = ما بين فاصلين) */
export function pagesOf(order: string[], byId: Map<string, ExamItemRow>): { items: string[]; breakId: string | null }[] {
  const pages: { items: string[]; breakId: string | null }[] = [{ items: [], breakId: null }]
  for (const id of order) {
    const it = byId.get(id)
    if (it?.kind === 'PAGE_BREAK') {
      pages[pages.length - 1]!.breakId = id
      pages.push({ items: [], breakId: null })
    } else pages[pages.length - 1]!.items.push(id)
  }
  return pages
}

/**
 * الورقة: صفحات مرقّمة، كل عنصر بطاقة قابلة للسحب، ومناطق إفلات قبل كل عنصر وفي آخر الورقة.
 * يقبل: عنصراً من الورقة (إعادة ترتيب)، سؤالاً من البنك، نوع كتلة من الشريط، كتلة من المكتبة.
 */
export function Paper({ exam, order, byId, run, pending, onDrop, onReorder, onCopilot, focusId }: { exam: ExamView; order: string[]; byId: Map<string, ExamItemRow>; run: Run; pending: boolean; onDrop: (p: DropPayload, position: number | null) => void; onReorder: (next: string[]) => void; onCopilot?: (item: ExamItemRow) => void; focusId?: string | null }) {
  const dragId = useRef<string | null>(null)
  const [over, setOver] = useState<string | 'end' | null>(null)
  const pages = pagesOf(order, byId)

  const payloadOf = (dt: DataTransfer): DropPayload | null => {
    const bank = dt.getData(DND.bank)
    if (bank) return { kind: 'bank', value: bank }
    const bt = dt.getData(DND.blockType)
    if (bt) return { kind: 'blockType', value: bt }
    const lib = dt.getData(DND.library)
    if (lib) return { kind: 'library', value: lib }
    return null
  }
  const allow = (e: DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = dragId.current ? 'move' : 'copy'
  }
  const onDragStart = (e: DragEvent, id: string) => {
    dragId.current = id
    e.dataTransfer.setData(DND.item, id)
    e.dataTransfer.effectAllowed = 'move'
  }
  const dropAt = (e: DragEvent, targetId: string | null) => {
    e.preventDefault()
    e.stopPropagation()
    setOver(null)
    const external = payloadOf(e.dataTransfer)
    const position = targetId ? order.indexOf(targetId) : null
    if (external) return onDrop(external, position)
    const from = dragId.current ?? e.dataTransfer.getData(DND.item)
    dragId.current = null
    if (!from || from === targetId) return
    const next = order.filter((x) => x !== from)
    if (targetId) next.splice(next.indexOf(targetId), 0, from)
    else next.push(from)
    onReorder(next)
  }

  let pageNo = 0
  return (
    <div className="space-y-4">
      {order.length === 0 ? (
        <div className="rounded-xl border bg-card p-4">
          <EmptyState icon={FileText} title="الورقة فارغة" description="اسحب سؤالاً من البنك أو كتلة من الشريط إلى هنا، أو اضغط عليها لإضافتها في آخر الورقة. أو ابدأ من قالب." />
        </div>
      ) : null}
      {pages.map((page, pi) => {
        pageNo++
        const isLast = pi === pages.length - 1
        return (
          <section key={pi} className="relative rounded-xl border bg-card shadow-sm">
            <span className="absolute -top-2.5 start-3 rounded-full border bg-background px-2 text-[10px] text-muted-foreground">صفحة {pageNo}</span>
            <ol className="space-y-2 p-3 pt-4">
              {page.items.map((id) => {
                const it = byId.get(id)
                if (!it) return null
                const position = order.indexOf(id)
                return (
                  <li key={id} draggable onDragStart={(e) => onDragStart(e, id)} onDragOver={(e) => { allow(e); setOver(id) }} onDragLeave={() => setOver((o) => (o === id ? null : o))} onDrop={(e) => dropAt(e, id)} className={cn('rounded-lg border bg-background transition-colors', over === id ? 'border-primary ring-2 ring-primary/20' : '', focusId === id ? 'ring-2 ring-accent' : '')} id={`item-${id}`}>
                    {it.kind === 'BLOCK' && it.snapshot.block ? <BlockCard item={it} examId={exam.id} position={position} assets={exam.assets} subjectId={exam.subjectId} run={run} pending={pending} openOnMount={focusId === id} /> : <ItemCard item={it} label={exam.numbering[id]} examId={exam.id} position={position} assets={exam.assets} run={run} pending={pending} onCopilot={onCopilot} openOnMount={focusId === id} />}
                  </li>
                )
              })}
              {page.breakId ? (
                <li key={page.breakId} draggable onDragStart={(e) => onDragStart(e, page.breakId!)} onDragOver={(e) => { allow(e); setOver(page.breakId) }} onDragLeave={() => setOver(null)} onDrop={(e) => dropAt(e, page.breakId)} className={cn('rounded-lg border border-dashed bg-muted/40', over === page.breakId ? 'border-primary' : '')}>
                  <ItemCard item={byId.get(page.breakId)!} examId={exam.id} position={order.indexOf(page.breakId)} assets={exam.assets} run={run} pending={pending} />
                </li>
              ) : null}
              {isLast ? (
                <li onDragOver={(e) => { allow(e); setOver('end') }} onDragLeave={() => setOver((o) => (o === 'end' ? null : o))} onDrop={(e) => dropAt(e, null)} className={cn('rounded-lg border border-dashed p-2 text-center text-xs text-muted-foreground', over === 'end' ? 'border-primary bg-primary/5' : '')}>
                  أفلت هنا للإضافة في آخر الورقة
                </li>
              ) : null}
            </ol>
          </section>
        )
      })}
    </div>
  )
}
