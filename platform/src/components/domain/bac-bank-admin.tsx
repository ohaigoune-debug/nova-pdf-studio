'use client'

import { Check, Cog, Download, FileDown, FolderInput, Sparkles, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { DOC_STATUS_AR } from '@/lib/exam-engine-labels'
import { importBacFromDriveAction, processBatchAction, qualityPreviewAction, registerAllBacAction, requestSolutionDetailsAction, reviewSolutionDetailAction, verifyDocumentAction } from '@/server/actions/bac-bank.actions'
import type { BacInventory, DetailQueueItem } from '@/server/services/bac-bank.service'

type Result = { ok: boolean; error?: { message: string }; data?: Record<string, unknown> }

/** أزرار الدفعات: تسجيل الكل ← معالجة N ← حلول مفصّلة N (كلها في الخلفية بنقاط تحقّق) */
export function BacBatchControls({ inv, aiConfigured, jobs }: { inv: BacInventory; aiConfigured: boolean; jobs: { processing: boolean; detailing: boolean; detailProcessed: number; detailTotal: number; lastError: string | null } }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const busy = jobs.processing || jobs.detailing
  useEffect(() => {
    if (!busy) return
    const id = setInterval(() => router.refresh(), 5000)
    return () => clearInterval(id)
  }, [busy, router])
  const run = (fn: () => Promise<Result>, ok: (r: Result) => string) =>
    start(async () => {
      const r = await fn()
      if (!r.ok) return toast('error', r.error!.message)
      toast('success', ok(r))
      router.refresh()
    })
  const unregistered = inv.totals.exams - inv.totals.registered
  const pendingDocs = inv.cells.filter((c) => c.status === 'PENDING').length
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Cog className="size-5 text-primary" /> خطّ البناء (دفعة دفعة)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">1) «المنهاج والمكتبة ← جلب DzExams» يملأ المكتبة بالمواضيع. 2) التسجيل يضع كل المواضيع الرسمية في سجلّ المعالجة. 3) المعالجة تنزّل الملف وتقرأه وتقسّمه تمارين مصنّفة. 4) الحلول المفصّلة تُولَّد مرة وتُراجَع. 5) التوثيق والاعتماد من الجدول أدناه.</p>
        {!aiConfigured ? <Alert tone="warning">مفتاح الذكاء الاصطناعي غير مضبوط: المعالجة والحلول المفصّلة تحتاجه (لوحة «الذكاء الاصطناعي»).</Alert> : null}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" loading={pending} disabled={unregistered <= 0} onClick={() => run(() => registerAllBacAction({ limit: 1000 }), (r) => `سُجّلت ${Number(r.data?.registered ?? 0)} وثيقة`)}>
            <Download className="size-4" /> تسجيل كل المواضيع ({unregistered} غير مسجَّلة)
          </Button>
          <Button loading={pending} disabled={!aiConfigured || pendingDocs === 0 || jobs.processing} onClick={() => run(() => processBatchAction(20), (r) => (r.data?.reused ? 'المعالجة تعمل سلفاً' : `بدأت معالجة ${Number(r.data?.count ?? 0)} وثيقة`))}>
            <Cog className="size-4" /> معالجة دفعة (20 من {pendingDocs} معلّقة)
          </Button>
          <Button variant="outline" loading={pending} disabled={!aiConfigured || jobs.detailing} onClick={() => run(() => requestSolutionDetailsAction({ limit: 25 }), (r) => (r.data?.reused ? 'التوليد يعمل سلفاً' : `بدأ توليد ${Number(r.data?.count ?? 0)} حلاً مفصّلاً`))}>
            <Sparkles className="size-4" /> حلول مفصّلة (دفعة 25)
          </Button>
          <Button asChild variant="ghost">
            <a href="/admin/bac-bank/inventory.csv">
              <FileDown className="size-4" /> تقرير الجرد CSV
            </a>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/admin/exam-engine">تفاصيل المحرّك</Link>
          </Button>
        </div>
        {jobs.processing ? <Alert tone="info">معالجة الوثائق تعمل الآن في الخلفية؛ تُحدَّث الصفحة تلقائياً.</Alert> : null}
        {jobs.detailing ? (
          <Alert tone="info">
            توليد الحلول المفصّلة: {jobs.detailProcessed} / {jobs.detailTotal}.
          </Alert>
        ) : jobs.lastError ? (
          <Alert tone="destructive">آخر مهمة حلول فشلت: {jobs.lastError}</Alert>
        ) : null}
      </CardContent>
    </Card>
  )
}

/** استيراد من مجلد Drive عامّ: بديل الجلب من DzExams عندما يحجب الخادم، أو لملفات Madrasadz النظيفة */
export function BacImportCard({ last, driveConfigured }: { last: { at: Date; logs: string[]; running: boolean; processed: number; total: number; error: string | null } | null; driveConfigured: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [url, setUrl] = useState('')
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!last?.running) return
    const id = setInterval(() => router.refresh(), 5000)
    return () => clearInterval(id)
  }, [last?.running, router])
  const submit = () =>
    start(async () => {
      const r = await importBacFromDriveAction(url)
      if (!r.ok) return toast('error', r.error.message)
      toast('success', r.data.reused ? 'استيراد يعمل سلفاً' : 'بدأ الاستيراد في الخلفية')
      setUrl('')
      router.refresh()
    })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FolderInput className="size-5 text-primary" /> استيراد ملفات من Google Drive
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">ضع ملفات PDF للمواضيع والتصحيحات في مجلد Drive مشارَك «أي شخص لديه الرابط — عارض». يُستنتج التصنيف من اسم الملف (مثال: bac-2023-math-se-sujet1.pdf وbac-2023-math-se-sujet1-corrige.pdf) ويكمل الذكاء الاصطناعي الناقص من أول صفحة. المكرّر يُتجاهل، وما لم يُصنَّف يُعرض هنا ولا يُخمَّن.</p>
        {!driveConfigured ? <Alert tone="warning">قراءة Drive تحتاج GOOGLE_API_KEY (أو مفتاح يوتيوب مع تفعيل Drive API) في ملف البيئة.</Alert> : null}
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" dir="ltr" className="min-w-64 flex-1" required />
          <Button type="submit" loading={pending} disabled={!driveConfigured || Boolean(last?.running)}>
            <FolderInput className="size-4" /> استيراد
          </Button>
        </form>
        {last?.running ? <Alert tone="info">الاستيراد يعمل: {last.processed} / {last.total || '…'} ملفاً.</Alert> : null}
        {last && !last.running ? (
          <div className="space-y-1">
            {last.error ? <Alert tone="destructive">آخر استيراد فشل: {last.error}</Alert> : null}
            <button type="button" className="text-xs text-primary underline" onClick={() => setOpen((o) => !o)}>
              {open ? 'إخفاء' : 'عرض'} سجلّ آخر استيراد ({last.logs.length} سطراً)
            </button>
            {open ? (
              <ul className="max-h-64 space-y-0.5 overflow-auto rounded-md border bg-muted/30 p-2 text-xs">
                {last.logs.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

const QC_ITEMS: [string, string][] = [
  ['year', 'السنة'],
  ['subject', 'المادة'],
  ['stream', 'الشعبة'],
  ['topic', 'الموضوع (الأول/الثاني)'],
  ['pages', 'عدد الصفحات'],
  ['questions', 'جميع الأسئلة'],
  ['numbers', 'الأرقام'],
  ['equations', 'المعادلات'],
  ['figures', 'الرسوم والصور'],
  ['bareme', 'سلّم التنقيط'],
  ['solution', 'الحلّ'],
  ['complete', 'لا صفحات ناقصة'],
  ['notDuplicate', 'ليس مكرّراً']
]

/** قائمة فحص الجودة قبل التوثيق (البنود الآلية مملوءة سلفاً؛ المشرف يؤكّد الباقي) */
export function VerifyDialog({ doc, onClose }: { doc: { id: string; title: string; quality: Record<string, boolean | string | undefined> } | null; onClose: () => void }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [f, setF] = useState<Record<string, boolean>>({})
  const [note, setNote] = useState('')
  useEffect(() => {
    if (!doc) return
    setF(Object.fromEntries(QC_ITEMS.map(([k]) => [k, doc.quality[k] === true])))
    setNote(typeof doc.quality.note === 'string' ? doc.quality.note : '')
    // البنود الآلية (السنة، المادة، الشعبة، الصفحات، الأسئلة، الحلّ، التكرار) تُملأ من الخادم
    qualityPreviewAction(doc.id).then((r) => {
      if (!r.ok) return
      setF((s) => ({ ...s, ...Object.fromEntries(Object.entries(r.data).filter(([, v]) => typeof v === 'boolean') as [string, boolean][]) }))
    })
  }, [doc])
  if (!doc) return null
  const submit = () =>
    start(async () => {
      const r = await verifyDocumentAction(doc.id, { ...f, note })
      if (!r.ok) return toast('error', r.error.message)
      toast('success', r.data.missing.length ? `وُثّقت مع ${r.data.missing.length} بنود غير مؤكَّدة` : 'وُثّقت: كل البنود مؤكَّدة')
      router.refresh()
      onClose()
    })
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85dvh] overflow-auto">
        <DialogHeader>
          <DialogTitle>مراقبة الجودة — {doc.title}</DialogTitle>
          <DialogDescription>تحقّق من كل بند قبل التوثيق. البنود المملوءة استُنتجت آلياً (السنة، المادة، الشعبة، الصفحات، الأسئلة، الحلّ، التكرار).</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-1.5 text-sm">
          {QC_ITEMS.map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 rounded-lg border p-2">
              <input type="checkbox" className="size-4" checked={Boolean(f[k])} onChange={(e) => setF((s) => ({ ...s, [k]: e.target.checked }))} /> {label}
            </label>
          ))}
        </div>
        <textarea className="w-full rounded-lg border bg-background p-2 text-sm" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة (اختياري): ما يحتاج مراجعة لاحقة…" dir="auto" />
        <div className="flex gap-2">
          <Button onClick={submit} loading={pending}>
            <Check className="size-4" /> توثيق
          </Button>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** طابور الحلول المفصّلة: اعتماد أو رفض (الرفض يعيد التمرين إلى طابور التوليد) */
export function DetailQueue({ items }: { items: DetailQueueItem[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [open, setOpen] = useState<string | null>(null)
  const act = (id: string, decision: 'approve' | 'reject') =>
    start(async () => {
      const r = await reviewSolutionDetailAction(id, decision)
      if (!r.ok) return toast('error', r.error.message)
      toast('success', decision === 'approve' ? 'اعتُمد الحلّ المفصّل' : 'رُفض وسيُعاد توليده')
      router.refresh()
    })
  if (items.length === 0) return <p className="p-4 text-sm text-muted-foreground">لا حلول مفصّلة بانتظار المراجعة.</p>
  return (
    <ul className="divide-y text-sm">
      {items.map((it) => (
        <li key={it.id} className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold">
                {it.title ?? it.body.slice(0, 60)} <Badge variant="muted">{it.sourceLabel ?? it.subjectName ?? ''}</Badge> {it.detail.selfChecked ? <Badge variant="success">تحقّق ذاتي</Badge> : <Badge variant="warning">بلا تحقّق</Badge>}
              </p>
              <p className="text-xs text-muted-foreground" dir="auto">
                {it.detail.shortAnswer.slice(0, 160)}
              </p>
            </div>
            <span className="flex shrink-0 gap-1">
              <Button size="sm" variant="ghost" onClick={() => setOpen(open === it.id ? null : it.id)}>
                {open === it.id ? 'إخفاء' : 'عرض'}
              </Button>
              <Button size="sm" variant="outline" loading={pending} onClick={() => act(it.id, 'approve')}>
                <Check className="size-4" /> اعتماد
              </Button>
              <Button size="sm" variant="ghost" loading={pending} onClick={() => act(it.id, 'reject')} title="رفض">
                <X className="size-4 text-destructive" />
              </Button>
            </span>
          </div>
          {open === it.id ? (
            <div className="mt-2 space-y-1 rounded-lg border bg-muted/30 p-3 text-xs" dir="auto">
              <p className="whitespace-pre-line">{it.body}</p>
              <ol className="list-decimal space-y-0.5 ps-5">
                {it.detail.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              {it.detail.rule ? <p>القاعدة: {it.detail.rule}</p> : null}
              {it.detail.commonMistakes.length ? <p>أخطاء شائعة: {it.detail.commonMistakes.join(' · ')}</p> : null}
              {it.detail.teacherNotes ? <p className="text-warning">{it.detail.teacherNotes}</p> : null}
              {it.detail.bareme.length ? <p>السلّم: {it.detail.bareme.map((b) => `${b.label} ${b.points}`).join(' · ')}</p> : null}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

/** جدول الجرد مع زرّ التوثيق لكل وثيقة محلَّلة */
export function InventoryTable({ cells, docs }: { cells: BacInventory['cells']; docs: Record<string, { id: string; title: string; quality: Record<string, boolean | string | undefined> }> }) {
  const [verify, setVerify] = useState<{ id: string; title: string; quality: Record<string, boolean | string | undefined> } | null>(null)
  return (
    <>
      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-start text-muted-foreground">
              <th className="p-2 text-start">السنة</th>
              <th className="p-2 text-start">الشعبة</th>
              <th className="p-2 text-start">المادة</th>
              <th className="p-2">الموضوع</th>
              <th className="p-2">PDF</th>
              <th className="p-2">الحلّ</th>
              <th className="p-2">تمارين</th>
              <th className="p-2">مصنَّفة</th>
              <th className="p-2">مفصّلة</th>
              <th className="p-2">الحالة</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {cells.map((c) => (
              <tr key={c.resourceId} className="border-b">
                <td className="p-2 tabular">{c.year || '—'}</td>
                <td className="p-2">{c.streamName ?? '—'}</td>
                <td className="p-2">{c.subjectName ?? '—'}</td>
                <td className="p-2 text-center">{c.topic ?? '—'}</td>
                <td className="p-2 text-center">{c.hasLocalPdf ? '✔ محلي' : c.hasPdf ? 'رابط' : '✖'}</td>
                <td className="p-2 text-center">{c.hasSolution ? '✔' : '✖'}</td>
                <td className="p-2 text-center tabular">{c.exercises || '—'}</td>
                <td className="p-2 text-center tabular">{c.classified || '—'}</td>
                <td className="p-2 text-center tabular">{c.detailed || '—'}</td>
                <td className="p-2 text-center">
                  <Badge variant={c.status === 'PUBLISHED' ? 'success' : c.status === 'VERIFIED' ? 'default' : c.status === 'NEEDS_REVIEW' ? 'warning' : c.status === 'FAILED' ? 'destructive' : 'muted'}>{c.status ? (DOC_STATUS_AR[c.status as keyof typeof DOC_STATUS_AR] ?? c.status) : 'غير مسجَّل'}</Badge>
                  {c.resources > 1 ? <Badge variant="warning">مكرّر</Badge> : null}
                </td>
                <td className="p-2">
                  <span className="flex justify-end gap-1">
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/bac/${c.resourceId}`} target="_blank">
                        عرض
                      </Link>
                    </Button>
                    {c.documentId && (c.status === 'NEEDS_REVIEW' || c.status === 'VERIFIED' || c.status === 'PUBLISHED') && docs[c.documentId] ? (
                      <Button size="sm" variant="outline" onClick={() => setVerify(docs[c.documentId!]!)}>
                        فحص الجودة
                      </Button>
                    ) : null}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <VerifyDialog doc={verify} onClose={() => setVerify(null)} />
    </>
  )
}
