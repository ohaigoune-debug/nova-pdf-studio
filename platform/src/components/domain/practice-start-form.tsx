'use client'

import { Play } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { DIFF_AR } from '@/lib/bank-labels'
import { startPracticeAction } from '@/server/actions/practice.actions'

type Opt = { id: string; name?: string; title?: string; questions: number }

/** اختيار المادة والدرس والصعوبة وعدد الأسئلة؛ تغيير المادة يعيد تحميل الدروس عبر الرابط */
export function PracticeStartForm({ subjects, nodes, subjectId, nodeId, difficulty }: { subjects: Opt[]; nodes: Opt[]; subjectId: string; nodeId?: string | null; difficulty?: number | null }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [f, setF] = useState({ nodeId: nodeId ?? '', difficulty: difficulty ? String(difficulty) : '', count: '10', adaptive: true })
  const subject = subjects.find((s) => s.id === subjectId)
  const begin = () =>
    start(async () => {
      const r = await startPracticeAction({ subjectId, curriculumNodeId: f.nodeId || null, difficulty: f.difficulty ? Number(f.difficulty) : null, count: Number(f.count), adaptive: f.adaptive })
      if (!r.ok) return toast('error', r.error.message)
      router.push(`/student/practice/${r.data.id}`)
    })
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="المادة" htmlFor="pr-subject">
        <Select id="pr-subject" value={subjectId} onChange={(e) => router.replace(`/student/practice?subject=${e.target.value}`)}>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.questions})
            </option>
          ))}
        </Select>
      </Field>
      <Field label="الدرس" htmlFor="pr-node">
        <Select id="pr-node" value={f.nodeId} onChange={(e) => setF((s) => ({ ...s, nodeId: e.target.value }))}>
          <option value="">كل الدروس{subject ? ` (${subject.questions})` : ''}</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.title} ({n.questions})
            </option>
          ))}
        </Select>
      </Field>
      <Field label="الصعوبة" htmlFor="pr-diff">
        <Select id="pr-diff" value={f.difficulty} onChange={(e) => setF((s) => ({ ...s, difficulty: e.target.value }))}>
          <option value="">{f.adaptive ? 'تكيّفية (حسب تقدّمك)' : 'كل الصعوبات'}</option>
          {[1, 2, 3, 4].map((d) => (
            <option key={d} value={d}>
              {DIFF_AR[d]?.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="عدد الأسئلة" htmlFor="pr-count">
        <Select id="pr-count" value={f.count} onChange={(e) => setF((s) => ({ ...s, count: e.target.value }))}>
          {[5, 10, 15, 20, 30].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
      </Field>
      <label className="flex items-start gap-2 text-sm sm:col-span-2 lg:col-span-4">
        <input type="checkbox" className="mt-1 size-4" checked={f.adaptive} onChange={(e) => setF((s) => ({ ...s, adaptive: e.target.checked }))} disabled={Boolean(f.difficulty)} />
        <span>
          <span className="font-semibold">تكيّفي</span>
          <span className="block text-xs text-muted-foreground">تبدأ سهلة في الدرس الجديد، وترتفع الصعوبة كلما أتقنتَه، وتعود إلى الأسهل حيث تخطئ. اختيار صعوبة محدّدة يلغيه.</span>
        </span>
      </label>
      <div className="sm:col-span-2 lg:col-span-4">
        <Button onClick={begin} loading={pending} disabled={!subjectId} size="lg">
          <Play className="size-4" /> ابدأ التدريب
        </Button>
      </div>
    </div>
  )
}
