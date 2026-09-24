'use client'

import { FileText, FolderUp, Loader2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from '@/components/ui/toast'
import { LESSON_ACCEPT } from '@/lib/file-types'
import { acceptedOnly, uploadMany } from '@/lib/upload-client'

export interface PickableFile {
  id: string
  name: string
}

/** خاصية اختيار مجلد كامل (غير معرّفة في أنواع React) */
const FOLDER_PROPS = { webkitdirectory: '', directory: '' } as Record<string, string>

/**
 * اختيار ملفات كثيرة دفعة واحدة: من ملفاتك على المنصة، أو برفع جديدة، أو مجلد كامل بمجلداته الفرعية.
 * كل ملف مختار يُرسل مع النموذج كحقل name (معرّفه).
 */
export function MultiFilePicker({ files: initial, name = 'fileIds' }: { files: PickableFile[]; name?: string }) {
  const [files, setFiles] = useState(initial)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)
  const filesRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const onPick = async (list: FileList | null) => {
    const picked = list ? acceptedOnly(list, LESSON_ACCEPT) : []
    if (filesRef.current) filesRef.current.value = ''
    if (folderRef.current) folderRef.current.value = ''
    if (picked.length === 0) {
      if (list?.length) toast('error', 'لا ملفات دروس في الاختيار (PDF، Word، PowerPoint، نص)')
      return
    }
    const { ok, failed } = await uploadMany(picked, setBusy)
    setBusy(null)
    for (const f of failed.slice(0, 3)) toast('error', f)
    if (ok.length) {
      setFiles((prev) => [...ok, ...prev])
      setChecked((prev) => new Set([...prev, ...ok.map((a) => a.id)]))
      toast('success', `رُفع ${ok.length} ملف واختير${failed.length ? ` — وتعذّر ${failed.length}` : ''}`)
    }
  }

  const btn = 'flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 text-sm font-bold text-primary hover:bg-primary/10'
  return (
    <div className="space-y-3">
      {busy ? (
        <p className={btn}>
          <Loader2 className="size-4 animate-spin" /> جارٍ الرفع {busy}
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={btn}>
            <Upload className="size-4" /> ارفع ملفات
            <input ref={filesRef} type="file" multiple accept={LESSON_ACCEPT} className="sr-only" onChange={(e) => void onPick(e.target.files)} />
          </label>
          <label className={btn}>
            <FolderUp className="size-4" /> ارفع مجلداً كاملاً
            <input ref={folderRef} type="file" multiple {...FOLDER_PROPS} className="sr-only" onChange={(e) => void onPick(e.target.files)} />
          </label>
        </div>
      )}
      {files.length ? (
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-2">
          {files.map((f) => (
            <label key={f.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
              <input type="checkbox" name={name} value={f.id} checked={checked.has(f.id)} onChange={() => toggle(f.id)} className="size-4 accent-[hsl(var(--primary))]" />
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{f.name}</span>
            </label>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">لا ملفات بعد — ارفع ملفاتك أو مجلداً كاملاً أعلاه.</p>
      )}
      <p className="text-xs text-muted-foreground">
        {checked.size} ملف مختار · PDF وWord (.docx) وPowerPoint (.pptx) والنص تُقرأ. الصيغ القديمة (.doc و.ppt) تُرفع لكن لا تُقرأ: احفظها من Word أو PowerPoint بصيغة .docx/.pptx أو PDF.
      </p>
    </div>
  )
}
