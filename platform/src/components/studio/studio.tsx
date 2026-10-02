'use client'

import { BookTemplate, Check, Cloud, CloudOff, Eye, FileCheck2, FileDown, FileText, Focus, History, Library, ListOrdered, Loader2, MonitorPlay, Pencil, Printer, Redo2, RotateCcw, Save, Settings2, Sparkles, Undo2 } from 'lucide-react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/toast'
import { defaultBlock, type BlockType } from '@/lib/exam-blocks'
import { formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { addBlockAction, addFreeItemAction, addFromBankAction, removeItemAction, reorderItemsAction, restoreItemsAction, updateExamAction } from '@/server/actions/exams.actions'
import { createRevisionAction, insertLibraryBlockAction, listRevisionsAction, restoreRevisionAction } from '@/server/actions/studio.actions'
import type { ExamItemRow } from '@/server/db/schema'
import type { RevisionListItem } from '@/server/services/exam-studio.service'
import type { ExamView } from '@/server/services/exams.service'
import { BankPanel } from './bank-panel'
import { BlockLibrary } from './block-library'
import { CopilotPanel } from './copilot-panel'
import { HeaderBuilder } from './header-builder'
import { Paper, type DropPayload } from './paper'
import { ExamSettings, PointsPanel } from './settings-panel'
import { stateOf, type Opt, type Result, type Run, type UndoEntry } from './types'

const A4Preview = dynamic(() => import('./preview').then((m) => m.A4Preview), { ssr: false, loading: () => <div className="h-40 animate-pulse rounded-xl bg-muted" /> })
const BlockStyles = dynamic(() => import('./block-view').then((m) => m.BlockStyles), { ssr: false })

const FOCUS_KEY = 'studio.focused'

/**
 * استوديو امتحان الأستاذ: الشريط (كتل/بنك) ← الورقة ← الإعدادات (ترويسة/نقاط/مساعد).
 * كل تغيير يُحفظ فوراً في الخادم، ومكدّس التراجع يعكسه بإجراء معاكس حقيقي (Ctrl+Z / Ctrl+Y).
 */
export function ExamStudio({ exam, options, aiConfigured }: { exam: ExamView; options: { subjects: Opt[]; levels: Opt[]; streams: Opt[]; groups?: Opt[] }; aiConfigured: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')
  const undoStack = useRef<UndoEntry[]>([])
  const redoStack = useRef<UndoEntry[]>([])
  const [, bump] = useState(0)
  const [libraryKey, setLibraryKey] = useState(0)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [view, setView] = useState<'edit' | 'preview'>('edit')
  const [focused, setFocused] = useState(false)
  const [drawer, setDrawer] = useState<'blocks' | 'bank' | 'settings' | null>(null)
  const [copilotItem, setCopilotItem] = useState<ExamItemRow | null>(null)
  const [revisionsOpen, setRevisionsOpen] = useState(false)
  useEffect(() => {
    try {
      setFocused(localStorage.getItem(FOCUS_KEY) === '1')
    } catch {
      /* لا تخزين */
    }
  }, [])
  const toggleFocused = () => {
    setFocused((v) => {
      try {
        localStorage.setItem(FOCUS_KEY, v ? '0' : '1')
      } catch {
        /* لا تخزين */
      }
      return !v
    })
  }

  const run: Run = useCallback(
    (fn, ok, undo) =>
      start(async () => {
        setSaveState('saving')
        const r = await fn()
        if (!r.ok) {
          setSaveState('error')
          toast('error', r.error!.message)
          return
        }
        setSaveState('saved')
        if (ok) toast('success', ok)
        if (undo) {
          undoStack.current.push(undo)
          if (undoStack.current.length > 60) undoStack.current.shift()
          redoStack.current = []
          bump((n) => n + 1)
        }
        if (/مكتبت/.test(ok ?? '')) setLibraryKey((k) => k + 1)
        router.refresh()
      }),
    [router]
  )
  const undo = useCallback(() => {
    const e = undoStack.current.pop()
    if (!e) return
    bump((n) => n + 1)
    start(async () => {
      setSaveState('saving')
      const r = await e.undo()
      if (!r.ok) {
        setSaveState('error')
        return toast('error', r.error!.message)
      }
      setSaveState('saved')
      redoStack.current.push(e)
      toast('success', `تراجع: ${e.label}`)
      router.refresh()
    })
  }, [router])
  const redo = useCallback(() => {
    const e = redoStack.current.pop()
    if (!e) return
    bump((n) => n + 1)
    start(async () => {
      setSaveState('saving')
      const r = await e.redo()
      if (!r.ok) {
        setSaveState('error')
        return toast('error', r.error!.message)
      }
      setSaveState('saved')
      undoStack.current.push(e)
      toast('success', `إعادة: ${e.label}`)
      router.refresh()
    })
  }, [router])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const t = e.target as HTMLElement | null
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      if (typing) return
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  // ── الورقة: ترتيب محلي متفائل أثناء السحب
  const [order, setOrder] = useState(exam.items.map((i) => i.id))
  useEffect(() => setOrder(exam.items.map((i) => i.id)), [exam.items])
  const byId = useMemo(() => new Map(exam.items.map((i) => [i.id, i])), [exam.items])

  /** تراجع عن إضافة: يحفظ حالة العنصر لحظة التراجع (بتعديلاته) ليعيدها «إعادة» بالمعرّف نفسه */
  const addedUndo = (label: string, id: string): UndoEntry => {
    let saved: ReturnType<typeof stateOf> | null = null
    return {
      label,
      undo: () => {
        const it = byIdRef.current.get(id)
        saved = it ? stateOf(it, orderRef.current.indexOf(id)) : null
        return removeItemAction(exam.id, id)
      },
      redo: () => (saved ? restoreItemsAction(exam.id, [saved]) : Promise.resolve({ ok: false, error: { message: 'تعذّرت الإعادة' } } as Result))
    }
  }
  const afterAdd = (label: string, r: Result & { data?: { id: string } }, open = false) => {
    if (!r.ok || !r.data) return
    const id = r.data.id
    if (open) setFocusId(id)
    undoStack.current.push(addedUndo(label, id))
    redoStack.current = []
    bump((n) => n + 1)
  }
  const byIdRef = useRef(byId)
  const orderRef = useRef(order)
  useEffect(() => {
    byIdRef.current = byId
    orderRef.current = order
  }, [byId, order])

  const addBank = (qid: string, position: number | null = null) => run(async () => { const r = await addFromBankAction(exam.id, qid, position); afterAdd('إضافة من البنك', r); return r }, 'أُضيف إلى الورقة')
  const addBlock = (t: BlockType, position: number | null = null) => run(async () => { const r = await addBlockAction(exam.id, defaultBlock(t), position); afterAdd('إضافة كتلة', r, true); return r })
  const addBasic = (kind: 'EXERCISE' | 'QUESTION' | 'TEXT' | 'PAGE_BREAK', position: number | null = null) =>
    run(async () => {
      const body = kind === 'EXERCISE' ? 'نصّ التمرين…' : kind === 'QUESTION' ? 'نصّ السؤال…' : kind === 'TEXT' ? 'تعليمات للتلميذ…' : undefined
      const r = await addFreeItemAction(exam.id, { kind, body, points: kind === 'EXERCISE' ? 4 : kind === 'QUESTION' ? 1 : null, position })
      afterAdd(kind === 'PAGE_BREAK' ? 'فاصل صفحة' : 'إضافة عنصر', r, kind !== 'PAGE_BREAK')
      return r
    })
  const insertLibrary = (id: string, position: number | null = null) => run(async () => { const r = await insertLibraryBlockAction(exam.id, id, position); afterAdd('إدراج من مكتبتي', r); return r }, 'أُدرجت الكتلة')
  const onDrop = (p: DropPayload, position: number | null) => {
    if (p.kind === 'bank') addBank(p.value, position)
    else if (p.kind === 'blockType') addBlock(p.value as BlockType, position)
    else if (p.kind === 'library') insertLibrary(p.value, position)
  }
  const onReorder = (next: string[]) => {
    const prev = order
    setOrder(next)
    run(() => reorderItemsAction(exam.id, next), null, { label: 'إعادة ترتيب', undo: () => reorderItemsAction(exam.id, prev), redo: () => reorderItemsAction(exam.id, next) })
  }
  const toggleFavorite = () => run(() => updateExamAction(exam.id, { isFavorite: !exam.isFavorite }), exam.isFavorite ? 'أُزيل من المفضّلة' : 'أُضيف إلى المفضّلة')

  const sidebar = (
    <Tabs defaultValue="blocks" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="blocks">الكتل</TabsTrigger>
        <TabsTrigger value="bank">البنك</TabsTrigger>
      </TabsList>
      <TabsContent value="blocks" className="mt-2">
        <BlockLibrary subjectCode={exam.subjectCode} subjectId={exam.subjectId} focused={focused} onAddBlock={(t) => addBlock(t)} onAddBasic={(k) => addBasic(k)} onInsertLibrary={(id) => insertLibrary(id)} pending={pending} refreshKey={libraryKey} />
      </TabsContent>
      <TabsContent value="bank" className="mt-2">
        <BankPanel exam={exam} focused={focused} onAdd={(q) => addBank(q)} pending={pending} />
      </TabsContent>
    </Tabs>
  )
  const settings = (
    <Tabs defaultValue="points" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="points">النقاط</TabsTrigger>
        <TabsTrigger value="header">الترويسة</TabsTrigger>
        <TabsTrigger value="settings">الإعدادات</TabsTrigger>
      </TabsList>
      <TabsContent value="points" className="mt-2 space-y-3">
        <ExportsCard exam={exam} />
        <div className="rounded-xl border bg-card p-3">
          <PointsPanel exam={exam} run={run} pending={pending} />
        </div>
      </TabsContent>
      <TabsContent value="header" className="mt-2 rounded-xl border bg-card p-3">
        <HeaderBuilder exam={exam} run={run} pending={pending} />
      </TabsContent>
      <TabsContent value="settings" className="mt-2 rounded-xl border bg-card p-3">
        <ExamSettings exam={exam} options={options} run={run} pending={pending} />
      </TabsContent>
    </Tabs>
  )

  return (
    <div className="studio -mt-2">
      <link rel="stylesheet" href="/katex/katex.min.css" />
      <BlockStyles />
      <Toolbar exam={exam} saveState={saveState} canUndo={undoStack.current.length > 0} canRedo={redoStack.current.length > 0} onUndo={undo} onRedo={redo} view={view} setView={setView} focused={focused} toggleFocused={toggleFocused} onRevisions={() => setRevisionsOpen(true)} onFavorite={toggleFavorite} pending={pending} />
      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_330px]">
        <aside className="hidden xl:sticky xl:top-4 xl:block xl:max-h-[calc(100dvh-2rem)] xl:overflow-auto">
          <div className="rounded-xl border bg-card p-3">{sidebar}</div>
        </aside>
        <main className="min-w-0 pb-16 xl:pb-0">
          {view === 'edit' ? (
            <Paper exam={exam} order={order} byId={byId} run={run} pending={pending} onDrop={onDrop} onReorder={onReorder} onCopilot={aiConfigured ? (it) => setCopilotItem(it) : undefined} focusId={focusId} />
          ) : (
            <A4Preview exam={exam} />
          )}
        </main>
        <aside className="hidden xl:sticky xl:top-4 xl:block xl:max-h-[calc(100dvh-2rem)] xl:overflow-auto">{settings}</aside>
      </div>

      {/* الهاتف واللوحة: شريط سفلي يفتح الأدراج */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t bg-background/95 p-1.5 backdrop-blur xl:hidden">
        <Button size="sm" variant="ghost" onClick={() => setDrawer('blocks')}>
          <Library className="size-4" /> الكتل والبنك
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setDrawer('settings')}>
          <Settings2 className="size-4" /> الإعدادات
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setView(view === 'edit' ? 'preview' : 'edit')}>
          {view === 'edit' ? <Eye className="size-4" /> : <Pencil className="size-4" />} {view === 'edit' ? 'معاينة' : 'تحرير'}
        </Button>
      </div>
      <Dialog open={drawer !== null} onOpenChange={(o) => !o && setDrawer(null)}>
        <DialogContent className="max-h-[85dvh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{drawer === 'settings' ? 'الإعدادات' : 'الكتل والبنك'}</DialogTitle>
            <DialogDescription>{drawer === 'settings' ? 'النقاط والترويسة وإعدادات الامتحان' : 'اضغط لإضافة العنصر في آخر الورقة'}</DialogDescription>
          </DialogHeader>
          {drawer === 'settings' ? settings : sidebar}
        </DialogContent>
      </Dialog>

      <RevisionsDialog examId={exam.id} open={revisionsOpen} onOpenChange={setRevisionsOpen} run={run} pending={pending} />
      {copilotItem ? <CopilotPanel exam={exam} item={byId.get(copilotItem.id) ?? copilotItem} onClose={() => setCopilotItem(null)} run={run} pending={pending} /> : null}
    </div>
  )
}

function Toolbar({ exam, saveState, canUndo, canRedo, onUndo, onRedo, view, setView, focused, toggleFocused, onRevisions, onFavorite, pending }: { exam: ExamView; saveState: 'saved' | 'saving' | 'error'; canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void; view: 'edit' | 'preview'; setView: (v: 'edit' | 'preview') => void; focused: boolean; toggleFocused: () => void; onRevisions: () => void; onFavorite: () => void; pending: boolean }) {
  return (
    <div className="sticky top-0 z-20 mb-4 flex flex-wrap items-center gap-2 rounded-xl border bg-background/95 px-3 py-2 backdrop-blur">
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" onClick={onUndo} disabled={!canUndo || pending} title="تراجع (Ctrl+Z)">
          <Undo2 className="size-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onRedo} disabled={!canRedo || pending} title="إعادة (Ctrl+Y)">
          <Redo2 className="size-4" />
        </Button>
        <span className={cn('inline-flex items-center gap-1 text-xs', saveState === 'error' ? 'text-destructive' : 'text-muted-foreground')} title="كل تغيير يُحفظ في الخادم فور حدوثه">
          {saveState === 'saving' ? <Loader2 className="size-3.5 animate-spin" /> : saveState === 'error' ? <CloudOff className="size-3.5" /> : <Cloud className="size-3.5" />}
          {saveState === 'saving' ? 'يُحفظ…' : saveState === 'error' ? 'تعذّر الحفظ' : 'محفوظ'}
        </span>
      </div>
      <div className="ms-auto flex flex-wrap items-center gap-1">
        <Badge variant={exam.status === 'READY' ? 'success' : 'secondary'}>{exam.status === 'READY' ? 'جاهز' : exam.status === 'ARCHIVED' ? 'مؤرشف' : 'مسودة'}</Badge>
        {exam.isTemplate ? (
          <Badge variant="secondary">
            <BookTemplate className="size-3" /> قالب
          </Badge>
        ) : null}
        <Button size="sm" variant={focused ? 'default' : 'outline'} onClick={toggleFocused} title={focused ? 'الوضع المركّز: كتل المادة وبنكها فقط' : 'الوضع الكامل: كل الكتل وكل البنك'}>
          <Focus className="size-4" /> {focused ? 'مركّز' : 'كامل'}
        </Button>
        <Button size="sm" variant={view === 'preview' ? 'default' : 'outline'} onClick={() => setView(view === 'edit' ? 'preview' : 'edit')}>
          {view === 'edit' ? <Eye className="size-4" /> : <Pencil className="size-4" />} {view === 'edit' ? 'معاينة A4' : 'تحرير'}
        </Button>
        <Button size="sm" variant="outline" onClick={onRevisions} title="المراجعات: لقطات تلقائية ويدوية قابلة للاسترجاع">
          <History className="size-4" /> المراجعات
        </Button>
        <Button size="sm" variant="ghost" onClick={onFavorite} title={exam.isFavorite ? 'إزالة من المفضّلة' : 'إضافة إلى المفضّلة'}>
          <Save className={cn('size-4', exam.isFavorite ? 'text-accent' : '')} />
        </Button>
        <Button asChild size="sm" variant="ghost" title="وضع السبّورة: عرض الورقة على الشاشة الكبيرة">
          <Link href={`/teacher/exams/${exam.id}/board`}>
            <MonitorPlay className="size-4" /> السبّورة
          </Link>
        </Button>
      </div>
    </div>
  )
}

/** التصدير: PDF (موضوع/تصحيح/سلّم) بالنسخ A–D عبر صفحة الطباعة، وWord عبر المسار الخادمي */
function ExportsCard({ exam }: { exam: ExamView }) {
  const [variant, setVariant] = useState('A')
  const print = (mode: string) => `/print/exams/${exam.id}?mode=${mode}&variant=${variant}`
  return (
    <div className="space-y-2 rounded-xl border bg-card p-3 text-sm">
      <p className="flex items-center justify-between font-bold">
        <span>التصدير</span>
        <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
          النسخة:
          {['A', 'B', 'C', 'D'].map((v) => (
            <button key={v} type="button" onClick={() => setVariant(v)} className={cn('rounded border px-1.5', variant === v ? 'border-primary bg-primary text-primary-foreground' : '')} title="ترتيب مختلف للتمارين والاختيارات بنفس الصعوبة">
              {v}
            </button>
          ))}
        </span>
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        <Button asChild size="sm">
          <a href={print('subject')} target="_blank" rel="noreferrer">
            <Printer className="size-4" /> الموضوع
          </a>
        </Button>
        <Button asChild size="sm" variant="outline">
          <a href={print('correction')} target="_blank" rel="noreferrer">
            <FileCheck2 className="size-4" /> التصحيح
          </a>
        </Button>
        <Button asChild size="sm" variant="outline">
          <a href={print('marking')} target="_blank" rel="noreferrer">
            <ListOrdered className="size-4" /> السلّم
          </a>
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Button asChild size="sm" variant="ghost">
          <a href={`/api/v1/exams/${exam.id}/docx?mode=subject&variant=${variant}`}>
            <FileDown className="size-4" /> Word الموضوع
          </a>
        </Button>
        <Button asChild size="sm" variant="ghost">
          <a href={`/api/v1/exams/${exam.id}/docx?mode=correction&variant=${variant}`}>
            <FileDown className="size-4" /> Word التصحيح
          </a>
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">PDF: من نافذة الطباعة اختر «حفظ كـ PDF». في Word تُكتب المعادلات نصّاً خطّياً والمنحنيات صوراً.</p>
    </div>
  )
}

function RevisionsDialog({ examId, open, onOpenChange, run, pending }: { examId: string; open: boolean; onOpenChange: (o: boolean) => void; run: Run; pending: boolean }) {
  const [rows, setRows] = useState<RevisionListItem[] | null>(null)
  const load = useCallback(async () => {
    const r = await listRevisionsAction(examId)
    if (r.ok) setRows(r.data)
  }, [examId])
  useEffect(() => {
    if (open) void load()
  }, [open, load])
  const save = async () => {
    const label = prompt('اسم المراجعة (اختياري):', '')
    if (label === null) return
    const r = await createRevisionAction(examId, label || null)
    if (!r.ok) return toast('error', r.error.message)
    toast('success', `حُفظت المراجعة ${r.data.number}`)
    void load()
  }
  const restore = (rev: RevisionListItem) => {
    if (!confirm(`استرجاع المراجعة ${rev.number}؟ الحالة الحالية تُحفظ أولاً كمراجعة.`)) return
    run(() => restoreRevisionAction(examId, rev.id), `استُرجعت المراجعة ${rev.number}`)
    onOpenChange(false)
  }
  const REASON: Record<string, string> = { AUTO: 'تلقائية', MANUAL: 'يدوية', RESTORE: 'قبل استرجاع' }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-auto">
        <DialogHeader>
          <DialogTitle>مراجعات الورقة</DialogTitle>
          <DialogDescription>لقطة تلقائية قبل أول تغيير كل 10 دقائق، ولقطات يدوية عند الطلب. الاسترجاع يحفظ الحالة الحالية أولاً.</DialogDescription>
        </DialogHeader>
        <Button size="sm" onClick={() => void save()} disabled={pending}>
          <Save className="size-4" /> حفظ مراجعة الآن
        </Button>
        {rows === null ? <p className="text-sm text-muted-foreground">يُحمَّل…</p> : rows.length === 0 ? <p className="text-sm text-muted-foreground">لا مراجعات بعد.</p> : null}
        <ul className="divide-y text-sm">
          {rows?.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 py-2">
              <div>
                <p className="font-semibold">
                  #{r.number} {r.label ? `— ${r.label}` : ''} <Badge variant="muted">{REASON[r.reason] ?? r.reason}</Badge>
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(r.createdAt)} · {r.itemsCount} عنصر مرقّم · {Number(r.totalPoints ?? 0)} ن
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => restore(r)} disabled={pending}>
                <RotateCcw className="size-4" /> استرجاع
              </Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}

export { Check, FileText, Sparkles }
