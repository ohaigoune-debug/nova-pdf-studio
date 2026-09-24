'use client'

import { BookOpenText, ClipboardList, ExternalLink, FileText, ListChecks, Loader2, Search } from 'lucide-react'
import Link from 'next/link'
import { useActionState, useMemo, useState, useTransition } from 'react'
import { FormError, SubmitButton } from '@/components/forms/form-bits'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'
import { draftFromDriveAction, publishExplanationAction } from '@/server/actions/drive-library.actions'
import { AssignmentForm } from './assignment-form'

type Opt = { id: string; name: string }
type LibFile = { id: string; name: string; mimeType: string; viewUrl: string }
type Draft = Awaited<ReturnType<typeof draftFromDriveAction>> extends infer R ? (R extends { ok: true; data: infer D } ? D : never) : never

export function DriveLibrary({ folderName, files, opts }: { folderName: string; files: LibFile[]; opts: { groups: Opt[]; students: Opt[]; skills: Opt[]; files: Opt[]; rubrics: Opt[] } }) {
  const [q, setQ] = useState('')
  const [pending, start] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ mode: 'assignment' | 'explanation'; data: Draft } | null>(null)
  const shown = useMemo(() => files.filter((f) => !q.trim() || f.name.includes(q.trim())), [files, q])

  const make = (f: LibFile, mode: 'assignment' | 'explanation') => {
    setBusyId(`${f.id}:${mode}`)
    start(async () => {
      const r = await draftFromDriveAction(f.id, mode)
      setBusyId(null)
      if (!r.ok) toast('error', r.error.message)
      else {
        setDraft({ mode, data: r.data })
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    })
  }

  return (
    <div className="space-y-6">
      {draft ? (
        <Card className="border-primary/40">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>{draft.mode === 'assignment' ? 'راجع الواجب قبل إنشائه' : 'راجع الشرح قبل نشره'}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                من الملف «{draft.data.fileName}» —{' '}
                <a href={draft.data.viewUrl} target="_blank" rel="noopener noreferrer" className="text-primary">
                  افتحه للمقارنة
                </a>
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(null)}>
              إلغاء
            </Button>
          </CardHeader>
          <CardContent>
            {draft.mode === 'assignment' ? (
              <div className="space-y-3">
                <Badge variant={draft.data.solutionInSource ? 'success' : 'warning'}>
                  {draft.data.solutionInSource ? 'الحل النموذجي منقول من الملف' : 'لا حل في الملف: الحل مقترح من الذكاء الاصطناعي — راجعه بدقّة'}
                </Badge>
                <p className="text-xs text-muted-foreground">بعد الإنشاء: كل إجابة يرسلها تلميذ يقارنها الذكاء الاصطناعي بهذا الحل ويقترح علامة، وأنت تعتمد بـ«نعم» أو ترفض بـ«لا» أو تعدّل.</p>
                <AssignmentForm key={draft.data.title} defaults={{ title: draft.data.title, description: draft.data.statement, modelAnswer: draft.data.modelAnswer }} {...opts} />
              </div>
            ) : (
              <ExplanationForm draft={draft.data} groups={opts.groups} />
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          المجلد: <strong className="text-foreground">{folderName}</strong> — {files.length} ملف
        </p>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم الملف…" className="ps-9" />
        </div>
      </div>
      <div className="space-y-2">
        {shown.map((f) => (
          <div key={f.id} className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex min-w-0 items-center gap-2 font-semibold">
              <FileText className="size-4 shrink-0 text-muted-foreground" /> <span className="truncate">{f.name}</span>
            </span>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => make(f, 'assignment')} disabled={pending}>
                {busyId === `${f.id}:assignment` ? <Loader2 className="size-4 animate-spin" /> : <ClipboardList className="size-4" />} واجب منه
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => make(f, 'explanation')} disabled={pending}>
                {busyId === `${f.id}:explanation` ? <Loader2 className="size-4 animate-spin" /> : <BookOpenText className="size-4" />} شرح للتلاميذ
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={`/teacher/quizzes/generate?drive=${encodeURIComponent(f.viewUrl)}`}>
                  <ListChecks className="size-4" /> اختبار منه
                </Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <a href={f.viewUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-4" />
                </a>
              </Button>
            </div>
          </div>
        ))}
        {shown.length === 0 ? <p className="text-sm text-muted-foreground">لا ملفات بهذا الاسم.</p> : null}
      </div>
    </div>
  )
}

function ExplanationForm({ draft, groups }: { draft: Draft; groups: Opt[] }) {
  const [state, action] = useActionState(publishExplanationAction, null)
  const [visibility, setVisibility] = useState('STUDENTS_ONLY')
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="sourceUrl" value={draft.viewUrl} />
      <Field label="العنوان" htmlFor="ex-title">
        <Input id="ex-title" name="title" defaultValue={draft.title} required />
      </Field>
      <Field label="الملخّص" htmlFor="ex-summary">
        <Textarea id="ex-summary" name="summary" rows={2} defaultValue={draft.summary} />
      </Field>
      <Field label="الشرح (عدّله كما تشاء)" htmlFor="ex-body">
        <Textarea id="ex-body" name="body" rows={16} defaultValue={draft.body} required />
      </Field>
      <Field label={t('contentMgmt.visibility')} htmlFor="ex-vis">
        <Select id="ex-vis" name="visibility" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
          {['STUDENTS_ONLY', 'GROUP_ONLY', 'PUBLIC'].map((v) => (
            <option key={v} value={v}>
              {t(`contentMgmt.visibility${v}` as never)}
            </option>
          ))}
        </Select>
      </Field>
      {visibility === 'GROUP_ONLY' ? (
        <div className="flex flex-wrap gap-2 text-sm">
          {groups.map((g) => (
            <label key={g.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
              <input type="checkbox" name="groupIds" value={g.id} className="size-4 accent-[hsl(var(--primary))]" /> {g.name}
            </label>
          ))}
        </div>
      ) : null}
      <FormError state={state} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="intent" value="publish">
          تأكيد ونشر للتلاميذ
        </SubmitButton>
        <SubmitButton name="intent" value="draft" variant="outline">
          احفظ مسودة
        </SubmitButton>
      </div>
    </form>
  )
}
