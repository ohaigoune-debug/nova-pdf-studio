'use client'

import { FileText, Film, Upload, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Alert, Progress } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { tusUpload } from '@/lib/bunny-tus'
import { createBunnyUploadAction, saveCourseLessonAction } from '@/server/actions/course-lessons.actions'

export interface EditorLesson {
  id: string
  title: string
  summary: string | null
  body: string | null
  pdf: { id: string; name: string } | null
  videoProvider: string | null
  bunnyVideoId: string | null
  youtubeUrl: string | null
  published: boolean
  allowDownload: boolean
  legacyUploadVideo: boolean
}

type VideoKind = 'NONE' | 'BUNNY' | 'YOUTUBE'

async function uploadPdf(file: File, onPct: (n: number) => void): Promise<{ id: string; name: string }> {
  const tr = await fetch('/api/v1/files/upload-ticket', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: file.name, mime: 'application/pdf', size: file.size }) })
  const tj = await tr.json()
  if (!tj.ok) throw new Error(tj.error?.message ?? 'تعذّر الرفع')
  const t = tj.data as { fileId: string; url: string; headers: Record<string, string> }
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', t.url, true)
    for (const [k, v] of Object.entries(t.headers)) if (k.toLowerCase() !== 'content-length') xhr.setRequestHeader(k, v)
    xhr.upload.onprogress = (e) => e.lengthComputable && onPct(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`رفع ${xhr.status}`)))
    xhr.onerror = () => reject(new Error('انقطع الاتصال'))
    xhr.send(file)
  })
  const cr = await fetch(`/api/v1/files/${t.fileId}/complete`, { method: 'POST' })
  const cj = await cr.json()
  if (!cj.ok) throw new Error(cj.error?.message ?? 'تعذّر الرفع')
  return { id: t.fileId, name: file.name }
}

/** شاشة الدرس الواحدة: العنوان، PDF، الفيديو، ثم «احفظ وانشر» أو «احفظ مسودة» */
export function LessonEditor({ courseId, basePath, lesson, bunnyConfigured, isAdmin }: { courseId: string; basePath: string; lesson: EditorLesson | null; bunnyConfigured: boolean; isAdmin: boolean }) {
  const router = useRouter()
  const [state, action] = useActionState(saveCourseLessonAction, null)
  const [pdf, setPdf] = useState(lesson?.pdf ?? null)
  const [pdfPct, setPdfPct] = useState<number | null>(null)
  const [kind, setKind] = useState<VideoKind>(lesson?.videoProvider === 'BUNNY' ? 'BUNNY' : lesson?.videoProvider === 'YOUTUBE' ? 'YOUTUBE' : bunnyConfigured ? 'BUNNY' : 'NONE')
  const [bunnyId, setBunnyId] = useState(lesson?.bunnyVideoId ?? '')
  const [vidPct, setVidPct] = useState<number | null>(null)
  const [title, setTitle] = useState(lesson?.title ?? '')
  const busy = (pdfPct !== null && pdfPct < 100) || (vidPct !== null && vidPct < 100)

  useEffect(() => {
    if (state?.ok) {
      toast('success', state.data.published ? 'نُشر الدرس' : 'حُفظ الدرس مسودة')
      router.push(basePath)
      router.refresh()
    }
  }, [state, router, basePath])
  useEffect(() => {
    if (!busy) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [busy])

  const onPdf = async (file: File) => {
    if (file.type !== 'application/pdf') return toast('error', 'اختر ملف PDF')
    setPdfPct(0)
    try {
      setPdf(await uploadPdf(file, setPdfPct))
      setPdfPct(100)
    } catch (e) {
      setPdfPct(null)
      toast('error', 'تعذّر رفع الملف', e instanceof Error ? e.message : undefined)
    }
  }
  const onVideo = async (file: File) => {
    setVidPct(0)
    try {
      const t = await createBunnyUploadAction(courseId, title || file.name)
      if (!t.ok) throw new Error(t.error.message)
      await tusUpload(file, t.data, (f) => setVidPct(Math.round(f * 100)))
      setBunnyId(t.data.videoId)
      setVidPct(100)
      toast('success', 'رُفع الفيديو', 'يعالجه Bunny بضع دقائق ثم يظهر للتلاميذ')
    } catch (e) {
      setVidPct(null)
      toast('error', 'تعذّر رفع الفيديو', e instanceof Error ? e.message : undefined)
    }
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="lessonId" value={lesson?.id ?? ''} />
      <input type="hidden" name="pdfFileId" value={pdf?.id ?? ''} />
      <input type="hidden" name="videoKind" value={lesson?.legacyUploadVideo ? 'NONE' : kind} />
      <input type="hidden" name="bunnyVideoId" value={bunnyId} />

      <Field label="عنوان الدرس" htmlFor="l-title" error={fieldError(state, 'title')}>
        <Input id="l-title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required dir="auto" placeholder="مثال: الدرس 3 — الصورة الشعرية" />
      </Field>

      {lesson?.legacyUploadVideo ? (
        <Alert tone="info">فيديو هذا الدرس مرفوع بالطريقة القديمة ويبقى كما هو؛ يمكنك تعديل العنوان والنشر فقط.</Alert>
      ) : (
        <>
          <section className="space-y-2 rounded-lg border p-4">
            <h2 className="flex items-center gap-2 font-bold"><FileText className="size-4 text-primary" /> ملف PDF</h2>
            {pdf ? (
              <div className="flex items-center justify-between gap-2 rounded-md bg-muted/60 p-2 text-sm">
                <span className="truncate">{pdf.name}</span>
                <Button type="button" size="sm" variant="ghost" onClick={() => { setPdf(null); setPdfPct(null) }}><X className="size-4" /> إزالة</Button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground hover:bg-muted/40">
                <Upload className="size-4" /> اختر ملف PDF من جهازك
                <input type="file" accept="application/pdf" className="sr-only" disabled={busy} onChange={(e) => e.target.files?.[0] && void onPdf(e.target.files[0])} />
              </label>
            )}
            {pdfPct !== null && pdfPct < 100 ? <Progress value={pdfPct} /> : null}
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" name="allowDownload" className="size-4" defaultChecked={lesson?.allowDownload ?? false} /> السماح للتلاميذ بتنزيل الملف (الافتراضي: عرض فقط مع ختم باسم التلميذ)
            </label>
          </section>

          <section className="space-y-3 rounded-lg border p-4">
            <h2 className="flex items-center gap-2 font-bold"><Film className="size-4 text-primary" /> الفيديو</h2>
            <div className="flex flex-wrap gap-2 text-sm">
              {([['BUNNY', 'رفع فيديو'], ['YOUTUBE', 'رابط يوتيوب'], ['NONE', 'بلا فيديو']] as const).map(([k, label]) => (
                <Button key={k} type="button" size="sm" variant={kind === k ? 'default' : 'outline'} onClick={() => setKind(k)}>{label}</Button>
              ))}
            </div>
            {kind === 'BUNNY' ? (
              bunnyConfigured ? (
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground hover:bg-muted/40">
                    <Upload className="size-4" /> {bunnyId ? 'استبدل الفيديو بملف آخر' : 'اختر ملف الفيديو من جهازك (أي حجم)'}
                    <input type="file" accept="video/*" className="sr-only" disabled={busy} onChange={(e) => e.target.files?.[0] && void onVideo(e.target.files[0])} />
                  </label>
                  {vidPct !== null && vidPct < 100 ? <><Progress value={vidPct} /><p className="text-xs text-muted-foreground">يُرفع… {vidPct}% — لا تغلق الصفحة</p></> : null}
                  {bunnyId && (vidPct === null || vidPct === 100) ? <p className="text-xs text-success">الفيديو مرتبط بالدرس ✓</p> : null}
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer">لديّ معرّف فيديو من لوحة Bunny</summary>
                    <Input className="mt-2" value={bunnyId} onChange={(e) => setBunnyId(e.target.value)} dir="ltr" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                    {fieldError(state, 'bunnyVideoId') ? <p className="mt-1 text-destructive">{fieldError(state, 'bunnyVideoId')}</p> : null}
                  </details>
                </div>
              ) : (
                <Alert tone="warning">خدمة الفيديو (Bunny) غير مضبوطة بعد. {isAdmin ? 'اضبطها من الإعدادات ← الفيديو (Bunny)، أو استعمل رابط يوتيوب.' : 'اطلب من الإدارة ضبطها، أو استعمل رابط يوتيوب.'}</Alert>
              )
            ) : null}
            {kind === 'YOUTUBE' ? (
              <Field label="رابط الفيديو على يوتيوب" htmlFor="l-yt" error={fieldError(state, 'youtubeUrl')} hint="يظهر للمشتركين فقط داخل الدرس">
                <Input id="l-yt" name="youtubeUrl" defaultValue={lesson?.youtubeUrl ?? ''} dir="ltr" placeholder="https://youtu.be/…" />
              </Field>
            ) : null}
          </section>
        </>
      )}

      <details className="rounded-lg border p-4">
        <summary className="cursor-pointer font-bold">وصف ونص إضافي (اختياري)</summary>
        <div className="mt-3 space-y-3">
          <Field label="وصف قصير" htmlFor="l-sum">
            <Textarea id="l-sum" name="summary" rows={2} maxLength={1000} defaultValue={lesson?.summary ?? ''} dir="auto" />
          </Field>
          <Field label="نص الدرس (Markdown)" htmlFor="l-body">
            <Textarea id="l-body" name="body" rows={6} defaultValue={lesson?.body ?? ''} dir="auto" />
          </Field>
        </div>
      </details>

      <FormError state={state} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="intent" value="publish" disabled={busy}>احفظ وانشر</SubmitButton>
        <SubmitButton name="intent" value="draft" variant="outline" disabled={busy}>احفظ مسودة</SubmitButton>
      </div>
    </form>
  )
}
