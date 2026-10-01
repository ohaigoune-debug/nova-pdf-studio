'use client'

import { FileUp, ListChecks } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Alert, Progress } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { importQuizToBankAction, requestExtractionAction } from '@/server/actions/bank.actions'
import { EXAM_KIND_AR } from '@/lib/bank-labels'

type Opt = { id: string; name: string }

/**
 * تغذية البنك من مصدرين: ملفات الأستاذ (استخراج بالذكاء الاصطناعي ← قائمة مراجعة)
 * واختباراته الإلكترونية (نسخ مباشر بنفس المفاتيح).
 */
export function BankImportForm({ files, quizzes, subjects, levels, streams, extraction }: { files: Opt[]; quizzes: Opt[]; subjects: Opt[]; levels: Opt[]; streams: Opt[]; extraction: { running: boolean; processed: number; total: number; aiConfigured: boolean } }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [picked, setPicked] = useState<Set<string>>(() => new Set())
  const [meta, setMeta] = useState({ subjectId: '', levelId: '', streamId: '', schoolTerm: '', examKind: '', sourceLabel: '', sourceYear: '', rightsStatus: 'OWN' })
  const [quizId, setQuizId] = useState('')

  useEffect(() => {
    if (!extraction.running) return
    const id = setInterval(() => router.refresh(), 5000)
    return () => clearInterval(id)
  }, [extraction.running, router])

  const m = (k: keyof typeof meta) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setMeta((s) => ({ ...s, [k]: e.target.value }))
  const nullable = (v: string) => v || null
  const extract = () =>
    start(async () => {
      const r = await requestExtractionAction({ fileIds: [...picked], subjectId: nullable(meta.subjectId), levelId: nullable(meta.levelId), streamId: nullable(meta.streamId), schoolTerm: meta.schoolTerm ? Number(meta.schoolTerm) : null, examKind: nullable(meta.examKind), sourceLabel: nullable(meta.sourceLabel), sourceYear: meta.sourceYear ? Number(meta.sourceYear) : null, rightsStatus: meta.rightsStatus })
      if (!r.ok) toast('error', r.error.message)
      else {
        toast('success', `بدأ استخراج الأسئلة من ${r.data.files} ملف — تصلك النتيجة في قائمة المراجعة`)
        setPicked(new Set())
        router.refresh()
      }
    })
  const fromQuiz = () =>
    start(async () => {
      const r = await importQuizToBankAction(quizId, { subjectId: nullable(meta.subjectId), levelId: nullable(meta.levelId), streamId: nullable(meta.streamId), schoolTerm: meta.schoolTerm ? Number(meta.schoolTerm) : null })
      if (!r.ok) toast('error', r.error.message)
      else {
        toast('success', `نُسخ ${r.data.imported} سؤالاً${r.data.skipped ? ` (تُرك ${r.data.skipped} مكرّراً)` : ''}`)
        router.push('/teacher/bank?scope=mine')
      }
    })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>التصنيف المشترك لما سيُستورد</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="المادة" htmlFor="i-subject">
            <Select id="i-subject" value={meta.subjectId} onChange={m('subjectId')}>
              <option value="">—</option>
              {subjects.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="الصف" htmlFor="i-level">
            <Select id="i-level" value={meta.levelId} onChange={m('levelId')}>
              <option value="">—</option>
              {levels.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="الشعبة" htmlFor="i-stream">
            <Select id="i-stream" value={meta.streamId} onChange={m('streamId')}>
              <option value="">كل الشعب</option>
              {streams.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="الفصل" htmlFor="i-term">
            <Select id="i-term" value={meta.schoolTerm} onChange={m('schoolTerm')}>
              <option value="">—</option>
              <option value="1">الأول</option>
              <option value="2">الثاني</option>
              <option value="3">الثالث</option>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="size-5 text-primary" /> من ملفاتي (اختبار قديم، سلسلة تمارين)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!extraction.aiConfigured ? <Alert tone="warning">الاستخراج يحتاج مفتاح الذكاء الاصطناعي (يضبطه المشرف).</Alert> : null}
          {extraction.running ? (
            <div className="space-y-1 rounded-lg border p-3">
              <p>الاستخراج جارٍ… {extraction.processed}/{extraction.total} ملف</p>
              <Progress value={extraction.total ? Math.round((extraction.processed / extraction.total) * 100) : 10} />
            </div>
          ) : null}
          <p className="text-muted-foreground">
            يُقرأ نصّ الملف (PDF/Word) ويُقسَّم إلى تمارين وأسئلة بمفاتيحها إن وُجدت، ثم <strong>تراجعها أنت وتعتمدها</strong> قبل أن تدخل البنك. الحلّ لا يُؤلَّف: يُنقل فقط إن كان في الملف. الملفات المصوّرة لا تُقرأ بعد.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="نوع الامتحان الأصلي" htmlFor="i-kind">
              <Select id="i-kind" value={meta.examKind} onChange={m('examKind')}>
                <option value="">—</option>
                {Object.entries(EXAM_KIND_AR).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="المصدر" htmlFor="i-src">
              <Input id="i-src" value={meta.sourceLabel} onChange={m('sourceLabel')} placeholder="ثانوية … — قسنطينة" />
            </Field>
            <Field label="السنة" htmlFor="i-year">
              <Input id="i-year" type="number" min="1990" max="2100" value={meta.sourceYear} onChange={m('sourceYear')} dir="ltr" />
            </Field>
            <Field label="الحقوق" htmlFor="i-rights">
              <Select id="i-rights" value={meta.rightsStatus} onChange={m('rightsStatus')}>
                <option value="OWN">من تأليفي</option>
                <option value="PUBLIC_DOMAIN">ملك عام (امتحان رسمي)</option>
                <option value="THIRD_PARTY">لطرف آخر</option>
                <option value="LICENSED">مرخَّص لي</option>
                <option value="UNKNOWN">غير معروف</option>
              </Select>
            </Field>
          </div>
          {files.length === 0 ? (
            <p className="text-muted-foreground">
              لا ملفات نصّية في مكتبتك.{' '}
              <Link href="/teacher/files" className="text-primary underline">
                ارفع ملفاً أولاً
              </Link>
              .
            </p>
          ) : (
            <ul className="max-h-72 divide-y overflow-auto rounded-lg border">
              {files.map((f) => (
                <li key={f.id}>
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-muted/50">
                    <input type="checkbox" className="size-4" checked={picked.has(f.id)} onChange={() => setPicked((s) => { const n = new Set(s); n.has(f.id) ? n.delete(f.id) : n.add(f.id); return n })} />
                    <span className="truncate" dir="auto">
                      {f.name}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <Button onClick={extract} loading={pending} disabled={picked.size === 0 || !extraction.aiConfigured || extraction.running}>
            استخراج الأسئلة من {picked.size || ''} ملف
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="size-5 text-primary" /> من اختبار إلكتروني موجود
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">تُنسخ أسئلة الاختبار بمفاتيحها إلى بنكك مباشرة (بلا مراجعة لأنها من صنعك)؛ المكرّر لا يُنسخ.</p>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="الاختبار" htmlFor="i-quiz" className="min-w-64 flex-1">
              <Select id="i-quiz" value={quizId} onChange={(e) => setQuizId(e.target.value)}>
                <option value="">اختر…</option>
                {quizzes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Button variant="outline" onClick={fromQuiz} loading={pending} disabled={!quizId}>
              نسخ الأسئلة إلى البنك
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
