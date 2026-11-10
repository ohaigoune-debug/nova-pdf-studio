'use client'

import { TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'

/**
 * عطل غير متوقع داخل صفحة (القاعدة متوقفة، خطأ في الخادم…): رسالة عربية مع «أعد المحاولة» وطريق رجوع،
 * بدل الصفحة البيضاء «Application error». الرمز المرجعي (digest) يطابق سطر الخطأ في سجل الخادم.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="container flex min-h-dvh flex-col items-center justify-center gap-4 text-center">
      <TriangleAlert className="size-12 text-muted-foreground" aria-hidden />
      <h1 className="text-2xl font-extrabold">حدث خطأ غير متوقع</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        لم نتمكن من عرض هذه الصفحة الآن. حسابك وتقدّمك محفوظان. أعد المحاولة بعد لحظات، وإن تكرر الخطأ فارجع إلى الرئيسية.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={() => reset()} className="rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">
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
