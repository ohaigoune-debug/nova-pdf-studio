'use client'

import { Sparkles, Wand2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Alert } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { buildExamAction, parseExamRequestAction } from '@/server/actions/exams.actions'
import type { ExamKind } from '@/server/db/schema/enums'
import { EXAM_KIND_AR } from '@/server/services/exams.service'

type Opt = { id: string; name: string }

/**
 * «ابنِ لي الامتحان»: طلب حرّ يُحوَّل إلى الحقول، ثم بناء من البنك (فوري) والناقص بالذكاء الاصطناعي (خلفية).
 */
export function ExamGenerateForm({ subjects, levels, streams, aiConfigured }: { subjects: Opt[]; levels: Opt[]; streams: Opt[]; aiConfigured: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [text, setText] = useState('')
  const [f, setF] = useState({ subjectId: '', levelId: '', streamId: '', schoolTerm: '1', kind: 'TEST' as ExamKind, durationMinutes: '120', exercises: '4', targetPoints: '20', easy: '30', medium: '50', hard: '20', allowAi: true })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  const parse = () =>
    start(async () => {
      const r = await parseExamRequestAction(text)
      if (!r.ok) return toast('error', r.error.message)
      const d = r.data
      setF((s) => ({
        ...s,
        subjectId: d.subjectId ?? s.subjectId,
        levelId: d.levelId ?? s.levelId,
        streamId: d.streamId ?? s.streamId,
        schoolTerm: d.schoolTerm ? String(d.schoolTerm) : s.schoolTerm,
        kind: d.kind,
        durationMinutes: d.durationMinutes ? String(d.durationMinutes) : s.durationMinutes,
        exercises: d.exercises ? String(d.exercises) : s.exercises,
        easy: d.profile ? String(d.profile.easy) : s.easy,
        medium: d.profile ? String(d.profile.medium) : s.medium,
        hard: d.profile ? String(d.profile.hard) : s.hard
      }))
      const missing = [!d.subjectId && 'المادة', !d.levelId && 'الصف'].filter(Boolean)
      toast(missing.length ? 'error' : 'success', missing.length ? `فهمتُ الطلب إلا: ${missing.join(' و')} — اخترهما يدوياً` : 'فهمتُ الطلب: راجع الحقول ثم ابنِ')
    })

  const build = () =>
    start(async () => {
      const r = await buildExamAction({ subjectId: f.subjectId, levelId: f.levelId, streamId: f.streamId || null, schoolTerm: f.schoolTerm ? Number(f.schoolTerm) : null, kind: f.kind, durationMinutes: Number(f.durationMinutes), exercises: Number(f.exercises), targetPoints: Number(f.targetPoints) || 20, profile: { easy: Number(f.easy), medium: Number(f.medium), hard: Number(f.hard) }, allowAi: f.allowAi && aiConfigured })
      if (!r.ok) return toast('error', r.error.message)
      const d = r.data
      toast('success', d.missing === 0 ? `بُني الامتحان من ${d.picked} تمريناً من البنك` : d.jobId ? `${d.picked} من البنك، و${d.missing} يولّدها الذكاء الاصطناعي الآن — يصلك إشعار` : `${d.picked} من البنك؛ ${d.missing} لم يجدها البنك (أضفها يدوياً)`)
      router.push(`/teacher/exams/${d.examId}`)
    })

  const sum = Number(f.easy) + Number(f.medium) + Number(f.hard)
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" /> اكتب طلبك
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} dir="auto" placeholder="مثال: أنشئ اختباراً لمدة ساعتين للسنة الثالثة ثانوي علوم تجريبية في اللغة العربية، الفصل الأول، أربعة تمارين، مستوى متوسط إلى صعب" />
          <Button variant="outline" onClick={parse} loading={pending} disabled={text.trim().length < 3}>
            <Wand2 className="size-4" /> املأ الحقول من الطلب
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>مواصفات الامتحان</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="المادة" htmlFor="g-subject">
              <Select id="g-subject" value={f.subjectId} onChange={set('subjectId')}>
                <option value="">—</option>
                {subjects.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="الصف" htmlFor="g-level">
              <Select id="g-level" value={f.levelId} onChange={set('levelId')}>
                <option value="">—</option>
                {levels.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="الشعبة" htmlFor="g-stream">
              <Select id="g-stream" value={f.streamId} onChange={set('streamId')}>
                <option value="">كل الشعب</option>
                {streams.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="الفصل" htmlFor="g-term">
              <Select id="g-term" value={f.schoolTerm} onChange={set('schoolTerm')}>
                <option value="">—</option>
                <option value="1">الأول</option>
                <option value="2">الثاني</option>
                <option value="3">الثالث</option>
              </Select>
            </Field>
            <Field label="النوع" htmlFor="g-kind">
              <Select id="g-kind" value={f.kind} onChange={set('kind')}>
                {Object.entries(EXAM_KIND_AR).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="المدة (دقائق)" htmlFor="g-duration">
              <Input id="g-duration" type="number" min="5" max="600" value={f.durationMinutes} onChange={set('durationMinutes')} dir="ltr" />
            </Field>
            <Field label="عدد التمارين" htmlFor="g-ex">
              <Input id="g-ex" type="number" min="1" max="12" value={f.exercises} onChange={set('exercises')} dir="ltr" />
            </Field>
            <Field label="المجموع" htmlFor="g-target">
              <Input id="g-target" type="number" min="1" max="200" step="0.5" value={f.targetPoints} onChange={set('targetPoints')} dir="ltr" />
            </Field>
          </div>
          <div className="rounded-lg border p-3">
            <p className="mb-2 font-semibold">توزيع الصعوبة (%)</p>
            <div className="grid grid-cols-3 gap-2">
              <Field label="سهل" htmlFor="g-easy">
                <Input id="g-easy" type="number" min="0" max="100" value={f.easy} onChange={set('easy')} dir="ltr" />
              </Field>
              <Field label="متوسط" htmlFor="g-medium">
                <Input id="g-medium" type="number" min="0" max="100" value={f.medium} onChange={set('medium')} dir="ltr" />
              </Field>
              <Field label="صعب" htmlFor="g-hard">
                <Input id="g-hard" type="number" min="0" max="100" value={f.hard} onChange={set('hard')} dir="ltr" />
              </Field>
            </div>
            {sum !== 100 ? <p className="mt-1 text-xs text-warning">المجموع {sum}% — سيُوزَّع نسبياً.</p> : null}
          </div>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-1 size-4" checked={f.allowAi} onChange={set('allowAi')} disabled={!aiConfigured} />
            <span>
              إن لم يكفِ البنك، يولّد الذكاء الاصطناعي الناقص <strong>مشابهاً لأسئلة بنكك</strong> (في الخلفية، موسوماً «راجعه»، ونسخة في المراجعة).
              {!aiConfigured ? <span className="block text-xs text-muted-foreground">غير متاح: مفتاح الذكاء الاصطناعي غير مضبوط.</span> : null}
            </span>
          </label>
          {!aiConfigured ? null : <Alert tone="info">البنك أولاً دائماً: الذكاء الاصطناعي لا يولّد إلا ما نقص، ولا يُنشر شيء منه في البنك قبل مراجعتك.</Alert>}
          <Button onClick={build} loading={pending} disabled={!f.subjectId || !f.levelId}>
            <Wand2 className="size-4" /> ابنِ الامتحان
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
