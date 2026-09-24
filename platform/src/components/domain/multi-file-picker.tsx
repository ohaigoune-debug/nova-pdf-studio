'use client'

import { FileText, Loader2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from '@/components/ui/toast'

export interface PickableFile {
  id: string
  name: string
}

const ACCEPT = '.pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain'

async function uploadOne(file: File): Promise<PickableFile> {
  const mime = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : file.name.toLowerCase().endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'text/plain')
  const tr = await fetch('/api/v1/files/upload-ticket', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: file.name, mime, size: file.size }) })
  const tj = await tr.json()
  if (!tj.ok) throw new Error(tj.error?.message ?? 'تعذّر الرفع')
  const ticket = tj.data as { fileId: string; url: string; headers: Record<string, string> }
  const headers = Object.fromEntries(Object.entries(ticket.headers).filter(([k]) => k.toLowerCase() !== 'content-length'))
  const put = await fetch(ticket.url, { method: 'PUT', headers, body: file })
  if (!put.ok) throw new Error(`تعذّر رفع ${file.name}`)
  const cr = await fetch(`/api/v1/files/${ticket.fileId}/complete`, { method: 'POST' })
  const cj = await cr.json()
  if (!cj.ok) throw new Error(cj.error?.message ?? 'تعذّر الرفع')
  return { id: ticket.fileId, name: file.name }
}

/**
 * اختيار ملفات كثيرة دفعة واحدة: من ملفاتك على المنصة، أو برفع جديدة (PDF وWord ونص).
 * كل ملف مختار يُرسل مع النموذج كحقل name (معرّفه).
 */
export function MultiFilePicker({ files: initial, name = 'fileIds' }: { files: PickableFile[]; name?: string }) {
  const [files, setFiles] = useState(initial)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const onPick = async (list: FileList | null) => {
    if (!list?.length) return
    const added: PickableFile[] = []
    for (const [i, f] of [...list].entries()) {
      setBusy(`${i + 1}/${list.length} — ${f.name}`)
      try {
        added.push(await uploadOne(f))
      } catch (e) {
        toast('error', e instanceof Error ? e.message : 'تعذّر الرفع')
      }
    }
    setBusy(null)
    if (inputRef.current) inputRef.current.value = ''
    if (added.length) {
      setFiles((prev) => [...added, ...prev])
      setChecked((prev) => new Set([...prev, ...added.map((a) => a.id)]))
      toast('success', `رُفع ${added.length} ملف واختير`)
    }
  }

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 text-sm font-bold text-primary hover:bg-primary/10">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {busy ? `جارٍ الرفع ${busy}` : 'ارفع ملفات من جهازك (يمكن اختيار عدة ملفات)'}
        <input ref={inputRef} type="file" multiple accept={ACCEPT} className="sr-only" disabled={!!busy} onChange={(e) => void onPick(e.target.files)} />
      </label>
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
        <p className="text-xs text-muted-foreground">لا ملفات بعد — ارفع ملفاتك أعلاه.</p>
      )}
      <p className="text-xs text-muted-foreground">{checked.size} ملف مختار</p>
    </div>
  )
}
