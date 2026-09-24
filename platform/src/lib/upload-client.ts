'use client'

import { mimeOf } from './file-types'

export interface UploadedFile {
  id: string
  name: string
}

/** اسم يحفظ مسار الملف داخل المجلد المرفوع («الوحدة 1 / درس.pdf») فيستفيد منه الترتيب */
export function displayName(file: File): string {
  const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath
  const parts = rel ? rel.split('/').slice(1) : [file.name]
  return parts.join(' / ').slice(-200)
}

/**
 * رفع ملف واحد: تذكرة من الخادم ← PUT (إلى S3 مباشرة أو تيار عبر الخادم) ← إكمال.
 * لا يمرّ عبر Server Action (حدّها 10 MB) ولا يُحمَّل كله في ذاكرة الخادم.
 */
export async function uploadViaTicket(file: File): Promise<UploadedFile> {
  const name = displayName(file)
  const tr = await fetch('/api/v1/files/upload-ticket', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, mime: mimeOf(file), size: file.size }) })
  const tj = await tr.json()
  if (!tj.ok) throw new Error(`${name}: ${tj.error?.message ?? 'تعذّر الرفع'}`)
  const ticket = tj.data as { fileId: string; url: string; headers: Record<string, string> }
  const headers = Object.fromEntries(Object.entries(ticket.headers).filter(([k]) => k.toLowerCase() !== 'content-length'))
  const put = await fetch(ticket.url, { method: 'PUT', headers, body: file })
  if (!put.ok) throw new Error(`تعذّر رفع ${name}`)
  const cr = await fetch(`/api/v1/files/${ticket.fileId}/complete`, { method: 'POST' })
  const cj = await cr.json()
  if (!cj.ok) throw new Error(`${name}: ${cj.error?.message ?? 'تعذّر الرفع'}`)
  return { id: ticket.fileId, name }
}

/** من مجلد مختار: الملفات المقبولة فقط (نافذة المجلد لا تطبّق accept)، بلا الملفات المخفية */
export function acceptedOnly(list: FileList | File[], accept: string): File[] {
  const exts = accept.split(',').map((e) => e.trim().toLowerCase())
  return [...list].filter((f) => !f.name.startsWith('.') && exts.some((e) => f.name.toLowerCase().endsWith(e)))
}

/** رفع متتابع مع تقدّم؛ الفاشل لا يوقف البقية */
export async function uploadMany(files: File[], onProgress: (label: string) => void): Promise<{ ok: UploadedFile[]; failed: string[] }> {
  const ok: UploadedFile[] = []
  const failed: string[] = []
  for (const [i, f] of files.entries()) {
    onProgress(`${i + 1}/${files.length} — ${displayName(f)}`)
    try {
      ok.push(await uploadViaTicket(f))
    } catch (e) {
      failed.push(e instanceof Error ? e.message : f.name)
    }
  }
  return { ok, failed }
}
