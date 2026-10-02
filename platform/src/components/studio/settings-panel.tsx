'use client'

import { Wand2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Alert } from '@/components/ui/misc'
import { markingSummary } from '@/lib/marking'
import { cn } from '@/lib/utils'
import { rebalanceAction, restoreItemsAction, updateExamAction } from '@/server/actions/exams.actions'
import type { ExamKind } from '@/server/db/schema/enums'
import { EXAM_KIND_AR } from '@/lib/exam-labels'
import type { ExamInput, ExamView } from '@/server/services/exams.service'
import { stateOf, type Opt, type Run } from './types'

/** النقاط والصعوبة وسلّم التنقيط: المجموع مقابل المستهدف، إعادة التوزيع (قابلة للتراجع)، تحذيرات الفرعيات */
export function PointsPanel({ exam, run, pending }: { exam: ExamView; run: Run; pending: boolean }) {
  const total = Number(exam.totalPoints)
  const target = Number(exam.targetPoints)
  const off = Math.round((total - target) * 100) / 100
  const d = exam.difficultySummary
  const counts = d.counts ?? {}
  const graded = Object.values(counts).reduce((a, b) => a + b, 0)
  const pct = (k: string) => (graded ? Math.round(((counts[k] ?? 0) / graded) * 100) : 0)
  const m = markingSummary(exam)
  const rebalance = () => {
    const before = exam.items.filter((i) => i.kind === 'EXERCISE' || i.kind === 'QUESTION').map((i) => stateOf(i))
    run(() => rebalanceAction(exam.id), 'أُعيد التوزيع', { label: 'إعادة توزيع النقاط', undo: () => restoreItemsAction(exam.id, before), redo: () => rebalanceAction(exam.id) })
  }
  return (
    <div className="space-y-2 text-sm">
      <p className="font-bold">النقاط والصعوبة</p>
      <p className="text-2xl font-bold tabular">
        <span className={off === 0 ? 'text-success' : 'text-warning'}>{total}</span> <span className="text-base text-muted-foreground">/ {target}</span>
      </p>
      {off !== 0 && graded > 0 ? (
        <Alert tone="warning">
          المجموع {off > 0 ? 'يزيد' : 'ينقص'} بـ{Math.abs(off)} نقطة عن {target}.
          <Button size="sm" variant="outline" className="mt-2" onClick={rebalance} loading={pending}>
            <Wand2 className="size-4" /> إعادة توزيع النقاط على {target}
          </Button>
        </Alert>
      ) : null}
      {m.warnings.filter((w) => !w.startsWith('المجموع')).map((w) => (
        <Alert key={w} tone="warning" className="text-xs">
          {w}
        </Alert>
      ))}
      {graded > 0 ? (
        <div className="space-y-1 text-xs">
          <p>
            مستوى الامتحان: <strong>{d.label ?? '—'}</strong>
            {d.minutes ? ` · زمن تقديري ${d.minutes} د من ${exam.durationMinutes}` : ''}
          </p>
          {d.minutes && d.minutes > exam.durationMinutes ? <p className="text-warning">الزمن التقديري يتجاوز مدة الامتحان.</p> : null}
          {[
            ['1', 'سهل', 'bg-success'],
            ['2', 'متوسط', 'bg-primary'],
            ['3', 'صعب', 'bg-warning'],
            ['4', 'صعب جداً', 'bg-destructive']
          ].map(([k, label, color]) => (
            <div key={k} className="flex items-center gap-2">
              <span className="w-16">{label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className={cn('h-full', color)} style={{ width: `${pct(k!)}%` }} />
              </div>
              <span className="w-10 text-end tabular">{pct(k!)}%</span>
            </div>
          ))}
        </div>
      ) : null}
      {m.rows.length ? (
        <table className="w-full text-xs">
          <tbody>
            {m.rows.map((r) => (
              <tr key={r.itemId} className={r.mismatch ? 'text-warning' : ''}>
                <td className="py-0.5">{r.label}</td>
                <td className="py-0.5 text-end tabular">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  )
}

/** إعدادات الامتحان: ما يحدّد التصنيف والمدة والمجموع والحالة والفوج والقالب (كل حفظ قابل للتراجع) */
export function ExamSettings({ exam, options, run, pending }: { exam: ExamView; options: { subjects: Opt[]; levels: Opt[]; streams: Opt[]; groups?: Opt[] }; run: Run; pending: boolean }) {
  const initial = () => ({
    title: exam.title,
    kind: exam.kind as ExamKind,
    subjectId: exam.subjectId ?? '',
    levelId: exam.levelId ?? '',
    streamId: exam.streamId ?? '',
    schoolTerm: exam.schoolTerm ? String(exam.schoolTerm) : '',
    durationMinutes: String(exam.durationMinutes),
    targetPoints: String(Number(exam.targetPoints)),
    academicYear: exam.academicYear ?? '',
    instructions: exam.instructions ?? '',
    status: exam.status === 'READY' ? 'READY' : 'DRAFT',
    groupId: exam.groupId ?? '',
    isTemplate: exam.isTemplate
  })
  const [f, setF] = useState(initial)
  useEffect(() => setF(initial()), [exam.id, exam.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof ReturnType<typeof initial>) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }))
  const inputOf = (v: ReturnType<typeof initial>): ExamInput => ({
    title: v.title,
    kind: v.kind,
    subjectId: v.subjectId || null,
    levelId: v.levelId || null,
    streamId: v.streamId || null,
    schoolTerm: v.schoolTerm ? Number(v.schoolTerm) : null,
    durationMinutes: Number(v.durationMinutes) || 120,
    targetPoints: Number(v.targetPoints) || 20,
    academicYear: v.academicYear || null,
    instructions: v.instructions || null,
    status: exam.status === 'ARCHIVED' ? undefined : (v.status as 'DRAFT' | 'READY'),
    groupId: v.groupId || null,
    isTemplate: v.isTemplate
  })
  const save = () => {
    const before = inputOf(initial())
    const after = inputOf(f)
    run(() => updateExamAction(exam.id, after), 'حُفظت الإعدادات', { label: 'إعدادات الامتحان', undo: () => updateExamAction(exam.id, before), redo: () => updateExamAction(exam.id, after) })
  }
  return (
    <div className="space-y-2 text-sm">
      <p className="font-bold">إعدادات الامتحان</p>
      <Field label="العنوان" htmlFor="ex-title">
        <Input id="ex-title" value={f.title} onChange={set('title')} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="النوع" htmlFor="ex-kind">
          <Select id="ex-kind" value={f.kind} onChange={set('kind')}>
            {Object.entries(EXAM_KIND_AR).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="الفصل" htmlFor="ex-term">
          <Select id="ex-term" value={f.schoolTerm} onChange={set('schoolTerm')}>
            <option value="">—</option>
            <option value="1">الأول</option>
            <option value="2">الثاني</option>
            <option value="3">الثالث</option>
          </Select>
        </Field>
        <Field label="المادة" htmlFor="ex-subject">
          <Select id="ex-subject" value={f.subjectId} onChange={set('subjectId')}>
            <option value="">—</option>
            {options.subjects.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="الصف" htmlFor="ex-level">
          <Select id="ex-level" value={f.levelId} onChange={set('levelId')}>
            <option value="">—</option>
            {options.levels.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="الشعبة" htmlFor="ex-stream">
          <Select id="ex-stream" value={f.streamId} onChange={set('streamId')}>
            <option value="">—</option>
            {options.streams.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="المدة (دقائق)" htmlFor="ex-duration">
          <Input id="ex-duration" type="number" min="5" max="600" value={f.durationMinutes} onChange={set('durationMinutes')} dir="ltr" />
        </Field>
        <Field label="المجموع المستهدف" htmlFor="ex-target">
          <Input id="ex-target" type="number" min="1" max="200" step="0.5" value={f.targetPoints} onChange={set('targetPoints')} dir="ltr" />
        </Field>
        <Field label="السنة الدراسية" htmlFor="ex-year">
          <Input id="ex-year" value={f.academicYear} onChange={set('academicYear')} dir="ltr" placeholder="2026/2027" />
        </Field>
      </div>
      <Field label="تعليمات للتلميذ" htmlFor="ex-instr">
        <Textarea id="ex-instr" rows={2} value={f.instructions} onChange={set('instructions')} dir="auto" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="الحالة" htmlFor="ex-status" hint="«جاهز» = اكتملت المراجعة">
          <Select id="ex-status" value={f.status} onChange={set('status')} disabled={exam.status === 'ARCHIVED'}>
            <option value="DRAFT">مسودة</option>
            <option value="READY">جاهز</option>
          </Select>
        </Field>
        <Field label="الفوج" htmlFor="ex-group">
          <Select id="ex-group" value={f.groupId} onChange={set('groupId')}>
            <option value="">—</option>
            {(options.groups ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <label className="flex items-start gap-2 rounded-lg border p-2">
        <input type="checkbox" className="mt-0.5 size-4" checked={f.isTemplate} onChange={(e) => setF((s) => ({ ...s, isTemplate: e.target.checked }))} />
        <span>
          <span className="font-semibold">قالب</span>
          <span className="block text-xs text-muted-foreground">يظهر في «القوالب» ويُنشأ منه امتحان جديد بترويسته وإعداداته وعناصره.</span>
        </span>
      </label>
      <Button size="sm" onClick={save} loading={pending} className="w-full">
        حفظ الإعدادات
      </Button>
    </div>
  )
}
