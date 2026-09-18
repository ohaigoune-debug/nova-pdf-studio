import { WifiOff } from 'lucide-react'
import Link from 'next/link'
import { t } from '@/i18n'

export const metadata = { title: 'بلا اتصال' }

export default function OfflinePage() {
  return (
    <main className="container flex min-h-dvh flex-col items-center justify-center gap-4 text-center">
      <WifiOff className="size-12 text-muted-foreground" />
      <h1 className="text-2xl font-extrabold">لا يوجد اتصال بالإنترنت</h1>
      <p className="max-w-md text-sm text-muted-foreground">تعذّر الوصول إلى {t('app.name')}. تحقق من الاتصال ثم أعد المحاولة؛ ستعود صفحاتك تلقائياً عند عودة الشبكة.</p>
      <Link href="/" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
        إعادة المحاولة
      </Link>
    </main>
  )
}
