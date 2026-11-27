'use client'

import { FileSearch, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ScanResult {
  query: string | null
  date: string | null
}

/** رفع ملف PDF مسرَّب: يقرأ الخادم البصمة الخفية ثم تُفتح نتيجة البحث مباشرة */
export function LeakScanForm() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) return
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/v1/admin/leak-scan', { method: 'POST', body: form })
      const json = (await res.json().catch(() => null)) as { ok: boolean; data?: ScanResult; error?: { message: string } } | null
      if (!json?.ok || !json.data) {
        setMessage(json?.error?.message ?? 'تعذّر فحص الملف.')
        return
      }
      if (!json.data.query) {
        setMessage('لم أجد بصمة في هذا الملف (ربما أُعيد تصويره أو طباعته). ابحث في الصفحة عن «Ref.» الصغير أعلى اليسار أو على الحافة اليمنى واكتبه في البحث.')
        return
      }
      const params = new URLSearchParams({ q: json.data.query })
      if (json.data.date) params.set('date', json.data.date)
      router.push(`?${params.toString()}`)
    } catch {
      setMessage('تعذّر رفع الملف. تحقّق من الاتصال وأعد المحاولة.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2" data-testid="leak-scan-form">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Input name="file" type="file" accept="application/pdf,.pdf" aria-label="ملف PDF المسرَّب" required />
        <Button type="submit" variant="secondary" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <FileSearch className="size-4" />} افحص الملف
        </Button>
      </div>
      {message ? <p className="text-sm text-destructive">{message}</p> : null}
    </form>
  )
}
