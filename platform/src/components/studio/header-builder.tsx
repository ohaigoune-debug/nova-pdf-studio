'use client'

import { BookmarkPlus, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { resolveLayout, type ExamLayout } from '@/lib/exam-blocks'
import { uploadViaTicket } from '@/lib/upload-client'
import { cn } from '@/lib/utils'
import { updateExamAction } from '@/server/actions/exams.actions'
import { applyLibraryHeaderAction, listLibraryItemsAction, saveLibraryItemAction } from '@/server/actions/studio.actions'
import type { ExamHeader } from '@/server/db/schema'
import type { LibraryListItem } from '@/server/services/exam-studio.service'
import type { ExamView } from '@/server/services/exams.service'
import type { Run } from './types'

const HEADER_LAYOUTS: { v: NonNullable<ExamLayout['headerLayout']>; label: string; hint: string }[] = [
  { v: 'classic', label: 'كلاسيكي', hint: 'الجمهورية والوزارة ثم جدول البيانات' },
  { v: 'boxed', label: 'مؤطّر', hint: 'الترويسة داخل إطار بجدول مؤطّر' },
  { v: 'compact', label: 'مضغوط', hint: 'سطر واحد للبيانات (يوفّر مساحة)' },
  { v: 'bilingual', label: 'ثنائي اللغة', hint: 'يضيف السطور الفرنسية الرسمية' }
]

/**
 * باني الترويسة الجزائرية: التخطيط، الجمهورية/الوزارة/المديرية، المؤسسة والولاية والأستاذ والتاريخ،
 * حقول التلميذ، الشعار، QR، التذييل وترقيم الصفحات، الخطّ والهوامش. يُحفظ كله في `header` و`layout`.
 */
export function HeaderBuilder({ exam, run, pending }: { exam: ExamView; run: Run; pending: boolean }) {
  const L = resolveLayout(exam.layout)
  const initial = () => ({
    heading: exam.header.heading ?? '',
    school: exam.header.school ?? '',
    wilaya: exam.header.wilaya ?? '',
    teacherName: exam.header.teacherName ?? '',
    date: exam.header.date ?? '',
    showSources: Boolean(exam.header.showSources),
    headerLayout: L.headerLayout,
    showRepublic: L.showRepublic,
    showMinistry: L.showMinistry,
    directorate: L.directorate ?? '',
    studentFields: L.studentFields,
    showDate: L.showDate,
    logoFileId: L.logoFileId ?? '',
    footerText: L.footer.text,
    pageNumbers: L.footer.pageNumbers,
    qr: Boolean(L.qr),
    qrUrl: L.qrUrl ?? '',
    numbering: L.numbering,
    variantLabel: L.variantLabel,
    fontSize: String(L.fontSize),
    lineHeight: String(L.lineHeight),
    marginTop: String(L.margins.top),
    marginBottom: String(L.margins.bottom),
    marginSide: String(L.margins.side),
    optionsColumns: String(L.optionsColumns)
  })
  const [f, setF] = useState(initial)
  useEffect(() => setF(initial()), [exam.id, exam.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps
  const toInput = (v: ReturnType<typeof initial>): { header: ExamHeader; layout: ExamLayout } => ({
    header: { heading: v.heading, school: v.school, wilaya: v.wilaya, teacherName: v.teacherName, date: v.date, showSources: v.showSources },
    layout: {
      headerLayout: v.headerLayout,
      showRepublic: v.showRepublic,
      showMinistry: v.showMinistry,
      directorate: v.directorate || undefined,
      studentFields: v.studentFields,
      showDate: v.showDate,
      logoFileId: v.logoFileId || null,
      footer: { text: v.footerText, pageNumbers: v.pageNumbers },
      qr: v.qr,
      qrUrl: v.qrUrl || undefined,
      numbering: v.numbering,
      variantLabel: v.variantLabel,
      fontSize: Number(v.fontSize) || 13.5,
      lineHeight: Number(v.lineHeight) || 1.75,
      margins: { top: Number(v.marginTop) || 14, bottom: Number(v.marginBottom) || 16, side: Number(v.marginSide) || 14 },
      optionsColumns: (Number(v.optionsColumns) || 1) as 1 | 2 | 3 | 4
    }
  })
  const set = <K extends keyof ReturnType<typeof initial>>(k: K, v: ReturnType<typeof initial>[K]) => setF((s) => ({ ...s, [k]: v }))
  const save = () => {
    const before = toInput(initial())
    const after = toInput(f)
    run(() => updateExamAction(exam.id, after), 'حُفظت الترويسة والتخطيط', { label: 'الترويسة والتخطيط', undo: () => updateExamAction(exam.id, before), redo: () => updateExamAction(exam.id, after) })
  }
  const logoRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const uploadLogo = async (file: File | undefined) => {
    if (!file) return
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast('error', 'الشعار: jpg أو png أو webp')
    setUploading(true)
    try {
      const up = await uploadViaTicket(file)
      set('logoFileId', up.id)
      toast('success', 'رُفع الشعار؛ اضغط «حفظ» لتطبيقه')
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'تعذّر الرفع')
    } finally {
      setUploading(false)
    }
  }
  const [saved, setSaved] = useState<LibraryListItem[]>([])
  const loadSaved = async () => {
    const r = await listLibraryItemsAction({ kind: 'HEADER' })
    if (r.ok) setSaved(r.data)
  }
  useEffect(() => {
    void loadSaved()
  }, [])
  const saveHeader = async () => {
    const title = prompt('اسم الترويسة في مكتبتك:', f.school || 'ترويستي')
    if (title === null) return
    const inp = toInput(f)
    const r = await saveLibraryItemAction({ kind: 'HEADER', title: title || 'ترويستي', header: inp.header, layout: inp.layout })
    if (!r.ok) return toast('error', r.error.message)
    toast('success', 'حُفظت الترويسة في مكتبتك')
    void loadSaved()
  }
  const applySaved = (id: string) => run(() => applyLibraryHeaderAction(exam.id, id), 'طُبّقت الترويسة المحفوظة')

  return (
    <div className="space-y-3 text-sm">
      <p className="font-bold">الترويسة والتخطيط</p>
      {saved.length ? (
        <Select value="" onChange={(e) => e.target.value && applySaved(e.target.value)} className="h-8" disabled={pending}>
          <option value="">تطبيق ترويسة محفوظة…</option>
          {saved.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </Select>
      ) : null}
      <div className="grid grid-cols-2 gap-1.5">
        {HEADER_LAYOUTS.map((h) => (
          <button key={h.v} type="button" onClick={() => set('headerLayout', h.v)} className={cn('rounded-lg border p-2 text-start text-xs', f.headerLayout === h.v ? 'border-primary bg-primary/5' : 'hover:border-primary/40')} title={h.hint}>
            <span className="block font-semibold">{h.label}</span>
            <span className="block text-muted-foreground">{h.hint}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={f.showRepublic} onChange={(e) => set('showRepublic', e.target.checked)} /> الجمهورية
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={f.showMinistry} onChange={(e) => set('showMinistry', e.target.checked)} /> الوزارة
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={f.studentFields} onChange={(e) => set('studentFields', e.target.checked)} /> حقول التلميذ (الاسم/القسم/الرقم/العلامة)
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={f.showDate} onChange={(e) => set('showDate', e.target.checked)} /> التاريخ
        </label>
      </div>
      <Field label="عنوان الترويسة" htmlFor="h-heading" hint="فارغ = يُشتقّ من النوع والفصل (اختبار الفصل الأول)">
        <Input id="h-heading" value={f.heading} onChange={(e) => set('heading', e.target.value)} placeholder="بكالوريا تجريبية" />
      </Field>
      <Field label="مديرية التربية" htmlFor="h-dir">
        <Input id="h-dir" value={f.directorate} onChange={(e) => set('directorate', e.target.value)} placeholder="مديرية التربية لولاية قالمة" />
      </Field>
      <Field label="المؤسسة" htmlFor="h-school">
        <Input id="h-school" value={f.school} onChange={(e) => set('school', e.target.value)} placeholder="ثانوية …" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="الولاية" htmlFor="h-wilaya">
          <Input id="h-wilaya" value={f.wilaya} onChange={(e) => set('wilaya', e.target.value)} />
        </Field>
        <Field label="الأستاذ" htmlFor="h-teacher">
          <Input id="h-teacher" value={f.teacherName} onChange={(e) => set('teacherName', e.target.value)} />
        </Field>
        <Field label="التاريخ" htmlFor="h-date">
          <Input id="h-date" value={f.date} onChange={(e) => set('date', e.target.value)} placeholder="12 / 12 / 2026" dir="ltr" />
        </Field>
        <Field label="ترقيم التمارين" htmlFor="h-num">
          <Select id="h-num" value={f.numbering} onChange={(e) => set('numbering', e.target.value as 'words' | 'digits')}>
            <option value="words">التمرين الأول</option>
            <option value="digits">التمرين 1</option>
          </Select>
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input ref={logoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void uploadLogo(e.target.files?.[0])} />
        <Button type="button" size="sm" variant="outline" loading={uploading} onClick={() => logoRef.current?.click()}>
          <Upload className="size-4" /> {f.logoFileId ? 'استبدال الشعار' : 'شعار المؤسسة'}
        </Button>
        {f.logoFileId ? (
          <button type="button" className="text-xs text-destructive underline" onClick={() => set('logoFileId', '')}>
            إزالة الشعار
          </button>
        ) : null}
      </div>
      <div className="space-y-1 rounded-lg border p-2 text-xs">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={f.qr} onChange={(e) => set('qr', e.target.checked)} /> رمز QR في الترويسة
        </label>
        {f.qr ? <Input value={f.qrUrl} onChange={(e) => set('qrUrl', e.target.value)} placeholder="الرابط (فارغ = موقع المنصة)" dir="ltr" className="h-8" /> : null}
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={f.pageNumbers} onChange={(e) => set('pageNumbers', e.target.checked)} /> ترقيم الصفحات عند الطباعة
        </label>
        <Input value={f.footerText} onChange={(e) => set('footerText', e.target.value)} placeholder="نصّ التذييل (اختياري): بالتوفيق — الأستاذ…" className="h-8" dir="auto" />
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={f.showSources} onChange={(e) => set('showSources', e.target.checked)} /> إظهار مصادر التمارين في أسفل الورقة
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={f.variantLabel} onChange={(e) => set('variantLabel', e.target.checked)} /> كتابة «النسخة B/C/D» في الورقة
        </label>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <Field label="الخطّ (pt)" htmlFor="l-font">
          <Input id="l-font" type="number" step="0.5" min="10" max="18" value={f.fontSize} onChange={(e) => set('fontSize', e.target.value)} dir="ltr" />
        </Field>
        <Field label="تباعد الأسطر" htmlFor="l-lh">
          <Input id="l-lh" type="number" step="0.05" min="1.2" max="2.4" value={f.lineHeight} onChange={(e) => set('lineHeight', e.target.value)} dir="ltr" />
        </Field>
        <Field label="أعمدة QCM" htmlFor="l-cols">
          <Select id="l-cols" value={f.optionsColumns} onChange={(e) => set('optionsColumns', e.target.value)}>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
          </Select>
        </Field>
        <Field label="هامش علوي" htmlFor="l-mt">
          <Input id="l-mt" type="number" min="5" max="40" value={f.marginTop} onChange={(e) => set('marginTop', e.target.value)} dir="ltr" />
        </Field>
        <Field label="هامش سفلي" htmlFor="l-mb">
          <Input id="l-mb" type="number" min="5" max="40" value={f.marginBottom} onChange={(e) => set('marginBottom', e.target.value)} dir="ltr" />
        </Field>
        <Field label="هامش جانبي" htmlFor="l-ms">
          <Input id="l-ms" type="number" min="5" max="40" value={f.marginSide} onChange={(e) => set('marginSide', e.target.value)} dir="ltr" />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} loading={pending} className="flex-1">
          حفظ الترويسة والتخطيط
        </Button>
        <Button size="sm" variant="outline" onClick={() => void saveHeader()} title="حفظ هذه الترويسة في مكتبتي لإعادة استعمالها">
          <BookmarkPlus className="size-4" />
        </Button>
      </div>
    </div>
  )
}
