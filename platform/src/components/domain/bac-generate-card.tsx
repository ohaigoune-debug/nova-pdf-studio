'use client'

import { GraduationCap } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { resolveBacTemplate, totalPointsOf } from '@/lib/bac-templates'
import { DIFF_AR } from '@/lib/bank-labels'
import { buildBacMockAction } from '@/server/actions/exams.actions'

type Opt = { id: string; name: string; code: string }

/** بكالوريا تجريبية بالهيكلة الرسمية: المادة والشعبة ← معاينة الأجزاء ← بناء من البنك */
export function BacGenerateCard({ subjects, streams }: { subjects: Opt[]; streams: Opt[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '')
  const [streamId, setStreamId] = useState('')
  const subject = subjects.find((s) => s.id === subjectId)
  const stream = streams.find((s) => s.id === streamId)
  const tpl = useMemo(() => (subject ? resolveBacTemplate(subject.code, stream?.code ?? null) : null), [subject, stream])
  const build = () =>
    start(async () => {
      const r = await buildBacMockAction({ subjectId, streamId: streamId || null })
      if (!r.ok) return toast('error', r.error.message)
      toast(r.data.missing.length ? 'error' : 'success', r.data.missing.length ? `بُنيت الورقة؛ ${r.data.missing.length} جزء لم يجده البنك (موسوم «أكمل»)` : `بُنيت البكالوريا التجريبية: ${r.data.filled} جزءاً من البنك`)
      router.push(`/teacher/exams/${r.data.examId}`)
    })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="size-5 text-primary" /> بكالوريا تجريبية بالهيكلة الرسمية
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="المادة" htmlFor="bac-subject">
            <Select id="bac-subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              {subjects.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="الشعبة" htmlFor="bac-stream">
            <Select id="bac-stream" value={streamId} onChange={(e) => setStreamId(e.target.value)}>
              <option value="">— (الهيكلة العامة للمادة)</option>
              {streams.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {tpl ? (
          <div className="rounded-lg border p-3">
            <p className="mb-2 flex flex-wrap items-center gap-2 font-semibold">
              {tpl.label}
              <Badge variant="muted">{Math.floor(tpl.durationMinutes / 60)} سا{tpl.durationMinutes % 60 ? ` و${tpl.durationMinutes % 60} د` : ''}</Badge>
              <Badge variant="muted">{totalPointsOf(tpl)} ن{tpl.chooseOne ? ' (موضوع واحد)' : ''}</Badge>
            </p>
            <ol className="space-y-1">
              {tpl.parts.map((p) => (
                <li key={p.title} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {p.title}
                    {p.kind === 'TEXT' ? <span className="text-xs text-muted-foreground"> (نصّ تضعه أنت)</span> : null}
                  </span>
                  <span className="flex items-center gap-1 text-xs">
                    {p.kind === 'EXERCISE' ? <Badge variant={DIFF_AR[p.difficulty]?.variant ?? 'default'}>{DIFF_AR[p.difficulty]?.label}</Badge> : null}
                    {p.points ? <span className="tabular text-muted-foreground">{p.points} ن</span> : null}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-muted-foreground">{tpl.instructions} الهيكلة والنقاط قابلة للتعديل في الورقة بعد البناء.</p>
          </div>
        ) : null}
        <Button onClick={build} loading={pending} disabled={!subjectId}>
          <GraduationCap className="size-4" /> ابنِ البكالوريا التجريبية
        </Button>
      </CardContent>
    </Card>
  )
}
