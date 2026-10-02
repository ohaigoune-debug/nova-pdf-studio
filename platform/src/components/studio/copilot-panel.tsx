'use client'

import { Check, Sparkles, X } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/input'
import { Alert } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { itemPoints } from '@/lib/exam-points'
import { cn } from '@/lib/utils'
import { copilotProposeAction } from '@/server/actions/studio.actions'
import { addFreeItemAction, removeItemAction, restoreItemsAction, updateItemAction } from '@/server/actions/exams.actions'
import type { CopilotOp, ExamCopilotOutput } from '@/server/ai/types'
import type { ExamItemRow } from '@/server/db/schema'
import type { ExamView, ItemPatch } from '@/server/services/exams.service'
import { stateOf, type Run } from './types'

const RichText = dynamic(() => import('./block-view').then((m) => m.RichText), { ssr: false })

const OPS: { op: CopilotOp; label: string; hint: string; mcqOnly?: boolean }[] = [
  { op: 'easier', label: 'أسهل', hint: 'نفس الدرس بدرجة أسهل' },
  { op: 'harder', label: 'أصعب', hint: 'خطوة استدلال إضافية' },
  { op: 'similar', label: 'تمرين مشابه', hint: 'نسخة بديلة بمعطيات مختلفة تُضاف بعد هذا' },
  { op: 'rewrite', label: 'إعادة صياغة', hint: 'عربية مدرسية أوضح بلا تغيير المضمون' },
  { op: 'solution', label: 'الحلّ النموذجي', hint: 'خطوة بخطوة لورقة التصحيح' },
  { op: 'marking', label: 'سلّم التنقيط', hint: 'توزيع النقاط على الخطوات' },
  { op: 'subquestions', label: 'أسئلة فرعية', hint: 'تقسيم متدرّج يقود إلى الحلّ' },
  { op: 'to_mcq', label: 'تحويل إلى QCM', hint: 'أربعة اختيارات بمشتّتات' },
  { op: 'distractors', label: 'مشتّتات', hint: 'لأسئلة الاختيار المتعدد', mcqOnly: true },
  { op: 'points', label: 'اقتراح النقاط', hint: 'حسب الحجم والصعوبة والمجموع' },
  { op: 'time', label: 'الزمن التقديري', hint: 'لتلميذ متوسط' }
]

/** مقترح الذكاء الاصطناعي ← معاينة ← قبول (يُطبَّق بإجراء تعديل قابل للتراجع) أو رفض */
export function CopilotPanel({ exam, item, onClose, run, pending }: { exam: ExamView; item: ExamItemRow; onClose: () => void; run: Run; pending: boolean }) {
  const [op, setOp] = useState<CopilotOp | null>(null)
  const [instructions, setInstructions] = useState('')
  const [busy, setBusy] = useState(false)
  const [proposal, setProposal] = useState<ExamCopilotOutput | null>(null)
  const s = item.snapshot
  const isMcq = s.type === 'MCQ'
  const propose = async (o: CopilotOp) => {
    setOp(o)
    setProposal(null)
    setBusy(true)
    const r = await copilotProposeAction(exam.id, item.id, o, instructions || null)
    setBusy(false)
    if (!r.ok) return toast('error', r.error.message)
    setProposal(r.data)
  }
  const accept = () => {
    if (!proposal || !op) return
    if (op === 'similar') {
      const body = proposal.body ?? s.body
      const position = exam.items.findIndex((i) => i.id === item.id) + 1
      run(
        async () => {
          const r = await addFreeItemAction(exam.id, { kind: 'EXERCISE', body, title: null, points: proposal.points ?? itemPoints(item) ?? 4, position })
          if (!r.ok) return r
          const id = (r as { data: { id: string } }).data.id
          const p: ItemPatch = { children: (proposal.children ?? s.children?.map((c) => ({ body: c.body, points: c.points ?? 1, solution: c.solution ?? null })) ?? []).map((c) => ({ body: c.body, points: c.points, solution: c.solution })), solution: proposal.solution ?? null, difficulty: proposal.difficulty ?? s.difficulty ?? null, estimatedMinutes: proposal.estimatedMinutes ?? s.estimatedMinutes ?? null }
          if (p.children?.length) p.points = null
          const u = await updateItemAction(exam.id, id, p)
          if (!u.ok) return u
          return { ok: true, data: { id } }
        },
        'أُضيف التمرين المشابه بعد هذا العنصر'
      )
      onClose()
      return
    }
    const patch: ItemPatch = {}
    if (proposal.title != null) patch.title = proposal.title
    if (proposal.body != null) patch.body = proposal.body
    if (proposal.children) {
      patch.children = proposal.children.map((c) => ({ body: c.body, points: c.points, solution: c.solution }))
      patch.points = null
    }
    if (proposal.options) {
      patch.options = proposal.options
      patch.type = 'MCQ'
      if (op === 'to_mcq') patch.children = []
    }
    if (proposal.solution != null) patch.solution = proposal.solution
    if (proposal.bareme) patch.bareme = proposal.bareme
    if (proposal.points != null && !proposal.children) patch.points = proposal.points
    if (proposal.estimatedMinutes != null) patch.estimatedMinutes = proposal.estimatedMinutes
    if (proposal.difficulty != null) patch.difficulty = proposal.difficulty
    const before = stateOf(item)
    run(() => updateItemAction(exam.id, item.id, patch), 'طُبّق المقترح (يمكن التراجع)', { label: 'مقترح الذكاء الاصطناعي', undo: () => restoreItemsAction(exam.id, [before]), redo: () => updateItemAction(exam.id, item.id, patch) })
    onClose()
  }
  void removeItemAction
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88dvh] max-w-2xl overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-accent" /> مساعد الذكاء الاصطناعي — {exam.numbering[item.id] ?? 'عنصر'}
          </DialogTitle>
          <DialogDescription>يقترح فقط؛ لا يتغيّر شيء في الورقة قبل أن تقبل. المفتاح في الخادم، والاستهلاك يُسجَّل.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {OPS.filter((o) => !o.mcqOnly || isMcq).map((o) => (
            <button key={o.op} type="button" onClick={() => void propose(o.op)} disabled={busy || pending} className={cn('rounded-lg border p-2 text-start text-xs', op === o.op ? 'border-primary bg-primary/5' : 'hover:border-primary/40')} title={o.hint}>
              <span className="block font-semibold">{o.label}</span>
              <span className="block text-muted-foreground">{o.hint}</span>
            </button>
          ))}
        </div>
        <Textarea rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="توجيه اختياري قبل الاختيار: مثلاً «استعمل متتالية هندسية بدل الحسابية» أو «بالفرنسية»" dir="auto" />
        {busy ? <p className="text-sm text-muted-foreground">يُحضَّر المقترح…</p> : null}
        {proposal ? (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
            {proposal.note ? <Alert tone="info">{proposal.note}</Alert> : null}
            <div className="studio-paper space-y-2 rounded-md bg-white p-3 text-[13px] text-black" dir="rtl">
              {proposal.title ? <p className="font-bold">{proposal.title}</p> : null}
              {proposal.body ? (
                <div>
                  <p className="text-[11px] text-muted-foreground">النصّ المقترح:</p>
                  <RichText text={proposal.body} />
                </div>
              ) : null}
              {proposal.children ? (
                <ol className="list-decimal space-y-1 ps-6">
                  {proposal.children.map((c, i) => (
                    <li key={i}>
                      <RichText text={c.body} inline /> <span className="text-xs text-muted-foreground">({c.points} ن)</span>
                      {c.solution ? (
                        <div className="mt-0.5 border-s-2 border-primary/50 ps-2 text-xs text-neutral-700">
                          <RichText text={c.solution} />
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : null}
              {proposal.options ? (
                <ol className="ps-4">
                  {proposal.options.map((o, i) => (
                    <li key={i} className={o.isCorrect ? 'font-bold text-success' : ''}>
                      {['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح'][i]}) <RichText text={o.label} inline />
                    </li>
                  ))}
                </ol>
              ) : null}
              {proposal.solution ? (
                <div className="border-s-2 border-primary ps-2">
                  <p className="text-[11px] text-muted-foreground">الحلّ:</p>
                  <RichText text={proposal.solution} />
                </div>
              ) : null}
              {proposal.bareme ? (
                <table className="text-xs">
                  <tbody>
                    {proposal.bareme.map((b, i) => (
                      <tr key={i}>
                        <td className="border px-2 py-0.5">{b.label}</td>
                        <td className="border px-2 py-0.5 tabular">{b.points} ن</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
              <p className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {proposal.points != null ? <span>النقاط المقترحة: {proposal.points}</span> : null}
                {proposal.estimatedMinutes != null ? <span>الزمن: {proposal.estimatedMinutes} د</span> : null}
                {proposal.difficulty != null ? <span>الصعوبة: {proposal.difficulty}/4</span> : null}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={accept} loading={pending}>
                <Check className="size-4" /> {op === 'similar' ? 'إضافة بعد هذا العنصر' : 'قبول وتطبيق'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setProposal(null)}>
                <X className="size-4" /> رفض
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
