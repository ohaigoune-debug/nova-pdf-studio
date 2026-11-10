import { SearchX } from 'lucide-react'
import Link from 'next/link'
import { t } from '@/i18n'

export const metadata = { title: 'الصفحة غير موجودة' }

/** رابط خاطئ أو صفحة حُذفت: رسالة عربية واضحة وطريق رجوع، بدل صفحة Next الإنجليزية الافتراضية. */
export default function NotFound() {
  return (
    <main className="container flex min-h-dvh flex-col items-center justify-center gap-4 text-center">
      <SearchX className="size-12 text-muted-foreground" aria-hidden />
      <h1 className="text-2xl font-extrabold">الصفحة غير موجودة</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        الرابط الذي فتحته غير صحيح أو أن الصفحة نُقلت. ارجع إلى الصفحة الرئيسية لـ{t('app.name')} وأكمل من هناك.
      </p>
      <Link href="/" className="rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">
        العودة إلى الرئيسية
      </Link>
    </main>
  )
}
