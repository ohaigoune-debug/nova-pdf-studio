'use client'

import { TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { isStaleDeployError, reloadOnceForStaleDeploy } from '@/lib/stale-deploy'

/**
 * عطل غير متوقع داخل صفحة (القاعدة متوقفة، خطأ في الخادم…): رسالة عربية مع «أعد المحاولة» وطريق رجوع،
 * بدل الصفحة البيضاء «Application error». الرمز المرجعي (digest) يطابق سطر الخطأ في سجل الخادم.
 * صفحة مفتوحة من نسخة سابقة بعد نشر جديد: تعيد التحميل تلقائيًا مرة واحدة (src/lib/stale-deploy.ts).
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const stale = isStaleDeployError(error)
  const [reloading, setReloading] = useState(false)
  useEffect(() => {
    console.error(error)
    if (stale && reloadOnceForStaleDeploy()) setReloading(true)
  }, [error, stale])

  if (reloading) {
    return (
      <main className="container flex min-h-dvh flex-col items-center justify-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">صدرت نسخة جديدة من المنصة، نحدّث الصفحة…</p>
      </main>
    )
  }

  return (
    <main className="container flex min-h-dvh flex-col items-center justify-center gap-4 text-center">
      <TriangleAlert className="size-12 text-muted-foreground" aria-hidden />
      <h1 className="text-2xl font-extrabold">حدث خطأ غير متوقع</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        لم نتمكن من عرض هذه الصفحة الآن. حسابك وتقدّمك محفوظان. أعد المحاولة بعد لحظات، وإن تكرر الخطأ فارجع إلى الرئيسية.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={() => (stale ? window.location.reload() : reset())} className="rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">
          أعد المحاولة
        </button>
        <Link href="/" className="rounded-md border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground">
          العودة إلى الرئيسية
        </Link>
      </div>
      {error.digest ? (
        <p className="text-xs text-muted-foreground" dir="ltr">
          رمز الخطأ: {error.digest}
        </p>
      ) : null}
    </main>
  )
}
