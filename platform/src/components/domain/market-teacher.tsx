'use client'

import { Archive, Send, Store } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Alert } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { archiveListingAction, createListingAction, submitListingAction, updateListingAction } from '@/server/actions/market.actions'
import { LISTING_KINDS, type ListingKind } from '@/server/db/schema/enums'

type Opt = { id: string; name: string }
const KIND_AR: Record<ListingKind, string> = { EXAM: 'امتحان جاهز', EXERCISE_SET: 'مجموعة تمارين', SUMMARY: 'ملخّص (PDF)', QUESTION_BANK: 'حزمة أسئلة للبنك' }
const KIND_HINT: Record<ListingKind, string> = { EXAM: 'يحصل الأستاذ المشتري على نسخة قابلة للتعديل والطباعة في ورشته.', EXERCISE_SET: 'تُنسخ التمارين المختارة إلى بنك المشتري (أساتذة فقط).', SUMMARY: 'ملف PDF يُنزَّل بعد التأكيد (للجميع).', QUESTION_BANK: 'تُنسخ الأسئلة المختارة إلى بنك المشتري (أساتذة فقط).' }

/** إنشاء عرض: النوع ← المصدر (امتحان / ملف / أسئلة) ← السعر ← تأكيد الحقوق */
export function ListingForm({ sources, options, sharePct }: { sources: { exams: { id: string; title: string; items: number }[]; files: { id: string; name: string }[]; questions: { id: string; title: string | null; body: string; rights: string }[] }; options: { subjects: Opt[]; levels: Opt[]; streams: Opt[] }; sharePct: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [f, setF] = useState({ kind: 'EXAM' as ListingKind, title: '', description: '', priceDzd: '0', subjectId: '', levelId: '', streamId: '', examId: '', fileId: '', questionIds: [] as string[], rights: false })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }))
  const sellable = sources.questions.filter((q) => q.rights !== 'THIRD_PARTY' && q.rights !== 'UNKNOWN')
  const submit = (andSend: boolean) =>
    start(async () => {
      const r = await createListingAction({ kind: f.kind, title: f.title, description: f.description || null, priceDzd: Number(f.priceDzd), subjectId: f.subjectId || null, levelId: f.levelId || null, streamId: f.streamId || null, examId: f.kind === 'EXAM' ? f.examId || null : null, fileId: f.kind === 'SUMMARY' ? f.fileId || null : null, questionIds: f.kind === 'EXERCISE_SET' || f.kind === 'QUESTION_BANK' ? f.questionIds : undefined, rightsConfirmed: f.rights })
      if (!r.ok) return toast('error', r.error.message)
      if (andSend) {
        const s = await submitListingAction(r.data.id)
        if (!s.ok) return toast('error', s.error.message)
        toast('success', 'أُرسل العرض للمراجعة')
      } else toast('success', 'حُفظ كمسودة')
      router.push('/teacher/market')
      router.refresh()
    })
  const sourceOk = f.kind === 'EXAM' ? Boolean(f.examId) : f.kind === 'SUMMARY' ? Boolean(f.fileId) : f.questionIds.length > 0
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="size-5 text-primary" /> عرض جديد في السوق
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="النوع" htmlFor="l-kind" hint={KIND_HINT[f.kind]}>
            <Select id="l-kind" value={f.kind} onChange={(e) => setF((s) => ({ ...s, kind: e.target.value as ListingKind, examId: '', fileId: '', questionIds: [] }))}>
              {LISTING_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_AR[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="السعر (دج)" htmlFor="l-price" hint={`0 = مجاني · نصيبك ${sharePct}% من كل بيع`}>
            <Input id="l-price" type="number" min="0" step="1" value={f.priceDzd} onChange={set('priceDzd')} dir="ltr" />
          </Field>
          {f.kind === 'EXAM' ? (
            <Field label="الامتحان" htmlFor="l-exam" className="sm:col-span-2">
              <Select id="l-exam" value={f.examId} onChange={(e) => { const ex = sources.exams.find((x) => x.id === e.target.value); setF((s) => ({ ...s, examId: e.target.value, title: s.title || ex?.title || '' })) }}>
                <option value="">—</option>
                {sources.exams.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.title} ({x.items} عنصر)
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          {f.kind === 'SUMMARY' ? (
            <Field label="ملف PDF من ملفاتك" htmlFor="l-file" hint="ارفع الملف أولاً من «الملفات»" className="sm:col-span-2">
              <Select id="l-file" value={f.fileId} onChange={set('fileId')}>
                <option value="">—</option>
                {sources.files.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          {f.kind === 'EXERCISE_SET' || f.kind === 'QUESTION_BANK' ? (
            <div className="sm:col-span-2">
              <p className="mb-1 font-semibold">الأسئلة من بنكك ({f.questionIds.length} مختار)</p>
              {sellable.length === 0 ? (
                <p className="text-xs text-muted-foreground">لا أسئلة منشورة من إنتاجك بعد (أسئلة الطرف الثالث لا تُباع).</p>
              ) : (
                <ul className="max-h-64 space-y-1 overflow-auto rounded-lg border p-2">
                  {sellable.map((q) => (
                    <li key={q.id}>
                      <label className="flex items-start gap-2">
                        <input type="checkbox" className="mt-1 size-4" checked={f.questionIds.includes(q.id)} onChange={(e) => setF((s) => ({ ...s, questionIds: e.target.checked ? [...s.questionIds, q.id] : s.questionIds.filter((x) => x !== q.id) }))} />
                        <span className="line-clamp-2" dir="auto">
                          {q.title ? <strong>{q.title} — </strong> : null}
                          {q.body}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
          <Field label="العنوان" htmlFor="l-title" className="sm:col-span-2">
            <Input id="l-title" value={f.title} onChange={set('title')} maxLength={200} dir="auto" />
          </Field>
          <Field label="الوصف" htmlFor="l-desc" className="sm:col-span-2">
            <Textarea id="l-desc" rows={3} value={f.description} onChange={set('description')} maxLength={2000} dir="auto" />
          </Field>
          <Field label="المادة" htmlFor="l-subject">
            <Select id="l-subject" value={f.subjectId} onChange={set('subjectId')}>
              <option value="">—</option>
              {options.subjects.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="الصف" htmlFor="l-level">
            <Select id="l-level" value={f.levelId} onChange={set('levelId')}>
              <option value="">—</option>
              {options.levels.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <label className="flex items-start gap-2 rounded-lg border p-3">
          <input type="checkbox" className="mt-1 size-4" checked={f.rights} onChange={(e) => setF((s) => ({ ...s, rights: e.target.checked }))} />
          <span>
            <span className="font-semibold">أؤكّد أن هذا المحتوى من إنتاجي أو مرخَّص لي نشره وبيعه</span>
            <span className="block text-xs text-muted-foreground">لا تُقبل مواضيع رسمية أو مواد لأطراف أخرى بلا إذن. المصدر يُذكر للمشتري دائماً.</span>
          </span>
        </label>
        <Alert tone="info">يراجع المشرف العرض قبل نشره في المتجر. بعد النشر تصلك إشعارات البيع وتظهر أرباحك هنا.</Alert>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => submit(true)} loading={pending} disabled={!f.title.trim() || !sourceOk || !f.rights}>
            <Send className="size-4" /> إرسال للمراجعة
          </Button>
          <Button variant="outline" onClick={() => submit(false)} loading={pending} disabled={!f.title.trim() || !sourceOk}>
            حفظ كمسودة
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function ListingActions({ id, status, rightsConfirmed }: { id: string; status: string; rightsConfirmed: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, ok: string) =>
    start(async () => {
      const r = await fn()
      if (!r.ok) return toast('error', r.error!.message)
      toast('success', ok)
      router.refresh()
    })
  return (
    <div className="flex justify-end gap-1">
      {status === 'DRAFT' || status === 'REJECTED' ? (
        <Button size="sm" variant="outline" loading={pending} onClick={() => (rightsConfirmed ? run(() => submitListingAction(id), 'أُرسل للمراجعة') : run(async () => { const u = await updateListingAction(id, { rightsConfirmed: confirm('أؤكّد أن المحتوى من إنتاجي أو مرخَّص لي نشره.') }); return u.ok ? submitListingAction(id) : u }, 'أُرسل للمراجعة'))}>
          <Send className="size-4" /> إرسال
        </Button>
      ) : null}
      {status !== 'ARCHIVED' ? (
        <Button size="sm" variant="ghost" title="سحب العرض" loading={pending} onClick={() => confirm('سحب العرض من السوق؟') && run(() => archiveListingAction(id), 'سُحب العرض')}>
          <Archive className="size-4" />
        </Button>
      ) : null}
    </div>
  )
}
