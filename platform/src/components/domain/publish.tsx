'use client'

import { CheckCircle2, FileText, FolderUp, Loader2, Sparkles, Trash2, Upload, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Alert } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { PUBLISH_ACCEPT } from '@/lib/file-types'
import { acceptedOnly, uploadMany, type UploadedFile } from '@/lib/upload-client'
import { cn } from '@/lib/utils'
import { createBatchAction, publishBatchAction, saveBatchAction, splitSeriesAction, unpublishAction } from '@/server/actions/publish.actions'
import type { BatchDefaults, BatchItem, PublishType } from '@/server/db/schema/publish'

type Opt = { id: string; name: string }
export interface PublishOptions {
  subjects: Opt[]
  levels: Opt[]
  streams: Opt[]
  groups: Opt[]
}

const TYPES: { value: PublishType | 'AUTO'; label: string }[] = [
  { value: 'AUTO', label: 'تلقائي' },
  { value: 'LESSON', label: 'درس' },
  { value: 'SUMMARY', label: 'ملخّص' },
  { value: 'EXERCISE', label: 'سلسلة تمارين' },
  { value: 'HOMEWORK', label: 'فرض' },
  { value: 'TEST', label: 'اختبار' },
  { value: 'SOLUTION', label: 'الحلّ' }
]
const ITEM_TYPES = TYPES.filter((t) => t.value !== 'AUTO') as { value: PublishType; label: string }[]
const FOLDER_PROPS = { webkitdirectory: '', directory: '' } as Record<string, string>
const chip = (on: boolean) => cn('rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors', on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/50')

function OptSelect({ id, label, value, onChange, options, empty }: { id: string; label: string; value: string; onChange: (v: string) => void; options: Opt[]; empty: string }) {
  return (
    <Field label={label} htmlFor={id}>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{empty}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </Select>
    </Field>
  )
}

/**
 * نشر درس / فرض / اختبار / حلّ: النوع والمادة والمستوى، عامّ أو لأفواج، «من إنشاء»، ثم الملفات (مفردة، مجلد، ZIP)،
 * ثم «نظّمها بالذكاء الاصطناعي» (يقسّم السلسلة ويصنّف ويربط الحلول — تراجعه) أو «كما رفعتها».
 */
export function PublishForm({ options, basePath, defaultAuthor, admin }: { options: PublishOptions; basePath: string; defaultAuthor: string; admin: boolean }) {
  const router = useRouter()
  const [type, setType] = useState<PublishType | 'AUTO'>('AUTO')
  const [subjectId, setSubject] = useState('')
  const [levelId, setLevel] = useState('')
  const [streamId, setStream] = useState('')
  const [term, setTerm] = useState('')
  const [year, setYear] = useState('')
  const [audience, setAudience] = useState<'PUBLIC' | 'GROUPS'>('PUBLIC')
  const [groupIds, setGroupIds] = useState<string[]>([])
  const [author, setAuthor] = useState(defaultAuthor)
  const [mode, setMode] = useState<'ai' | 'manual'>('ai')
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const filesRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)

  const onPick = async (list: FileList | null) => {
    const picked = list ? acceptedOnly(list, PUBLISH_ACCEPT) : []
    if (filesRef.current) filesRef.current.value = ''
    if (folderRef.current) folderRef.current.value = ''
    if (!picked.length) {
      if (list?.length) toast('error', 'الملفات المقبولة: PDF، Word، PowerPoint، صور، أو ZIP')
      return
    }
    const { ok, failed } = await uploadMany(picked, setBusy)
    setBusy(null)
    for (const f of failed.slice(0, 3)) toast('error', f)
    if (ok.length) setFiles((prev) => [...prev, ...ok])
  }

  const submit = () =>
    start(async () => {
      const defaults: BatchDefaults = { type, subjectId: subjectId || null, levelId: levelId || null, streamId: streamId || null, term: term ? Number(term) : null, year: year ? Number(year) : null, audience, groupIds, author }
      const r = await createBatchAction({ fileIds: files.map((f) => f.id), mode, defaults })
      if (!r.ok) toast('error', r.error.message)
      else router.push(`${basePath}/${r.data.id}`)
    })

  const pickBtn = 'flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 text-sm font-bold text-primary hover:bg-primary/10'
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-semibold">ماذا تنشر؟</p>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button key={t.value} type="button" className={chip(type === t.value)} onClick={() => setType(t.value)}>
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">«تلقائي»: يُعرف النوع من اسم الملف أو محتواه (فرض، اختبار، حلّ…). الفروض والاختبارات والتمارين والحلول تظهر في «الفروض والاختبارات»، والدروس والملخّصات في «الدروس والموارد».</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <OptSelect id="pub-subject" label="المادة" value={subjectId} onChange={setSubject} options={options.subjects} empty="— من المحتوى —" />
        <OptSelect id="pub-level" label="المستوى" value={levelId} onChange={setLevel} options={options.levels} empty="— من المحتوى —" />
        <OptSelect id="pub-stream" label="الشعبة (اختياري)" value={streamId} onChange={setStream} options={options.streams} empty="كل الشعب" />
        <Field label="الفصل (اختياري)" htmlFor="pub-term">
          <Select id="pub-term" value={term} onChange={(e) => setTerm(e.target.value)}>
            <option value="">—</option>
            <option value="1">الفصل الأول</option>
            <option value="2">الفصل الثاني</option>
            <option value="3">الفصل الثالث</option>
          </Select>
        </Field>
        <Field label="السنة الدراسية (اختياري)" htmlFor="pub-year">
          <Input id="pub-year" type="number" min={1990} max={2100} placeholder="2026" value={year} onChange={(e) => setYear(e.target.value)} dir="ltr" />
        </Field>
        <Field label="من إنشاء" htmlFor="pub-author">
          <Input id="pub-author" value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={120} />
        </Field>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">لمن؟</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={chip(audience === 'PUBLIC')} onClick={() => setAudience('PUBLIC')}>
            عامّ لكل التلاميذ
          </button>
          {!admin ? (
            <button type="button" className={chip(audience === 'GROUPS')} onClick={() => setAudience('GROUPS')} disabled={!options.groups.length}>
              أفواجي فقط
            </button>
          ) : null}
        </div>
        {audience === 'GROUPS' ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {options.groups.map((g) => (
              <label key={g.id} className={cn(chip(groupIds.includes(g.id)), 'cursor-pointer')}>
                <input type="checkbox" className="sr-only" checked={groupIds.includes(g.id)} onChange={(e) => setGroupIds((p) => (e.target.checked ? [...p, g.id] : p.filter((x) => x !== g.id)))} />
                {g.name}
              </label>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">الملفات</p>
        {busy ? (
          <p className={pickBtn}>
            <Loader2 className="size-4 animate-spin" /> جارٍ الرفع {busy}
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <label className={pickBtn}>
              <Upload className="size-4" /> ملفات (PDF، Word، صور، ZIP)
              <input ref={filesRef} type="file" multiple accept={PUBLISH_ACCEPT} className="sr-only" onChange={(e) => void onPick(e.target.files)} />
            </label>
            <label className={pickBtn}>
              <FolderUp className="size-4" /> مجلد كامل
              <input ref={folderRef} type="file" multiple className="sr-only" {...FOLDER_PROPS} onChange={(e) => void onPick(e.target.files)} />
            </label>
          </div>
        )}
        {files.length ? (
          <ul className="divide-y rounded-lg border text-sm">
            {files.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate" dir="auto">
                    {f.name}
                  </span>
                </span>
                <button type="button" aria-label="إزالة" onClick={() => setFiles((p) => p.filter((x) => x.id !== f.id))} className="text-muted-foreground hover:text-destructive">
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">التنظيم</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => setMode('ai')} className={cn('rounded-xl border p-3 text-start', mode === 'ai' ? 'border-primary bg-primary/5' : 'bg-card')}>
            <span className="flex items-center gap-2 font-bold">
              <Sparkles className="size-4 text-primary" /> اقترح التنظيم بالذكاء الاصطناعي
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">يقسّم السلسلة المجمَّعة إلى فروض واختبارات منفصلة، ويصنّف كل وثيقة ويربط كل حلّ بموضوعه. تراجع الاقتراح قبل النشر.</span>
          </button>
          <button type="button" onClick={() => setMode('manual')} className={cn('rounded-xl border p-3 text-start', mode === 'manual' ? 'border-primary bg-primary/5' : 'bg-card')}>
            <span className="flex items-center gap-2 font-bold">
              <FileText className="size-4 text-primary" /> كما رفعتها
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">كل ملف وثيقة واحدة بما اخترته أعلاه، والحلّ يُربط بالموضوع حين يحمل اسمه («حل الفرض 1»).</span>
          </button>
        </div>
      </div>

      <Button onClick={submit} loading={pending} disabled={!files.length || Boolean(busy) || (audience === 'GROUPS' && !groupIds.length)} size="lg" className="w-full sm:w-auto">
        متابعة إلى المراجعة
      </Button>
    </div>
  )
}

/** يحدّث الصفحة كل بضع ثوانٍ أثناء تحليل الذكاء الاصطناعي */
export function AnalyzingRefresher() {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 4000)
    return () => clearInterval(id)
  }, [router])
  return (
    <Alert tone="info">
      <span className="flex items-center gap-2">
        <Loader2 className="size-4 animate-spin" /> الذكاء الاصطناعي يقرأ الملفات ويقترح التقسيم والتصنيف… (دقيقة إلى بضع دقائق بحسب حجم السلسلة). يمكنك مغادرة الصفحة، يصلك إشعار حين يجهز.
      </span>
    </Alert>
  )
}

/** مراجعة الاقتراح: كل وثيقة بنوعها وعنوانها ومادتها ومستواها وحلّها — ثم النشر */
export function BatchReview({ batchId, items: initial, options, basePath, note }: { batchId: string; items: BatchItem[]; options: PublishOptions; basePath: string; note: string | null }) {
  const router = useRouter()
  const [items, setItems] = useState(initial)
  const [pending, start] = useTransition()
  const set = (key: string, patch: Partial<BatchItem>) => setItems((l) => l.map((i) => (i.key === key ? { ...i, ...patch } : i)))
  const targets = items.filter((i) => i.type !== 'SOLUTION')
  const titleOf = (k: string | null) => items.find((i) => i.key === k)?.title ?? ''
  const chosen = items.filter((i) => i.include).length

  const publish = () =>
    start(async () => {
      const r = await publishBatchAction(batchId, items)
      if (!r.ok) toast('error', r.error.message)
      else {
        toast('success', `نُشر: ${r.data.sections.exams} في «الفروض والاختبارات» و${r.data.sections.lessons} في «الدروس والموارد»`)
        router.push(`${basePath}?done=${r.data.published}`)
      }
    })
  const save = () =>
    start(async () => {
      const r = await saveBatchAction(batchId, items)
      toast(r.ok ? 'success' : 'error', r.ok ? 'حُفظت التعديلات' : r.error.message)
    })

  return (
    <div className="space-y-4">
      {note ? <Alert tone="warning">{note}</Alert> : null}
      <p className="text-sm text-muted-foreground">
        عدد الوثائق المقترحة: {items.length} — عدّل ما تريد، وألغِ تحديد ما لا تريد نشره. الحلّ يُرفق بموضوعه فيظهر زرّ «الحلّ» تحته.
      </p>
      <ul className="space-y-3">
        {items.map((it, n) => (
          <li key={it.key} className={cn('rounded-xl border bg-card p-3', !it.include && 'opacity-55')}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={it.include} onChange={(e) => set(it.key, { include: e.target.checked })} className="size-4" />
                {n + 1}.
              </label>
              <Badge variant="muted" className="max-w-full truncate" dir="auto">
                {it.fileName.split(' / ').pop()}
                {it.fromPage ? ` — ص ${it.fromPage}${it.toPage && it.toPage !== it.fromPage ? `–${it.toPage}` : ''}` : ''}
              </Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
              <Select aria-label="النوع" value={it.type} onChange={(e) => set(it.key, { type: e.target.value as PublishType, solutionFor: e.target.value === 'SOLUTION' ? it.solutionFor : null })}>
                {ITEM_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
              <Input aria-label="العنوان" value={it.title} onChange={(e) => set(it.key, { title: e.target.value })} className="lg:col-span-2" dir="auto" />
              <Select aria-label="المادة" value={it.subjectId ?? ''} onChange={(e) => set(it.key, { subjectId: e.target.value || null })}>
                <option value="">المادة —</option>
                {options.subjects.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
              <Select aria-label="المستوى" value={it.levelId ?? ''} onChange={(e) => set(it.key, { levelId: e.target.value || null })}>
                <option value="">المستوى —</option>
                {options.levels.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
              <Select aria-label="الفصل" value={it.term ?? ''} onChange={(e) => set(it.key, { term: e.target.value ? Number(e.target.value) : null })}>
                <option value="">الفصل —</option>
                <option value="1">الفصل الأول</option>
                <option value="2">الفصل الثاني</option>
                <option value="3">الفصل الثالث</option>
              </Select>
              {it.type === 'SOLUTION' ? (
                <Select aria-label="حلّ لـ" value={it.solutionFor ?? ''} onChange={(e) => set(it.key, { solutionFor: e.target.value || null })} className="lg:col-span-6">
                  <option value="">حلّ لـ… (اختر الموضوع)</option>
                  {targets.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.title}
                    </option>
                  ))}
                </Select>
              ) : null}
            </div>
            {it.type === 'SOLUTION' && it.solutionFor ? <p className="mt-1.5 text-xs text-success">يُرفق حلاً لـ «{titleOf(it.solutionFor)}»</p> : null}
          </li>
        ))}
      </ul>
      <div className="sticky bottom-3 flex flex-wrap gap-2 rounded-xl border bg-background/95 p-3 shadow-lift backdrop-blur">
        <Button onClick={publish} loading={pending} disabled={!chosen}>
          <CheckCircle2 className="size-4" /> انشر ({chosen})
        </Button>
        <Button variant="outline" onClick={save} disabled={pending}>
          حفظ دون نشر
        </Button>
      </div>
    </div>
  )
}

export function UnpublishButton({ id }: { id: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-destructive"
      loading={pending}
      onClick={() =>
        start(async () => {
          if (!window.confirm('سحب هذا المورد من المنصة؟')) return
          const r = await unpublishAction(id)
          if (!r.ok) toast('error', r.error.message)
          else router.refresh()
        })
      }
    >
      <Trash2 className="size-4" /> سحب
    </Button>
  )
}

export function SplitSeriesButton({ contentId }: { contentId: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await splitSeriesAction(contentId)
          if (!r.ok) toast('error', r.error.message)
          else router.push(`/admin/publish/${r.data.id}`)
        })
      }
    >
      <Sparkles className="size-4" /> فكّها وانقلها
    </Button>
  )
}
