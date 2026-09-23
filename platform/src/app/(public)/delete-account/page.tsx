import { CheckCircle2 } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { contactEmail } from '@/server/lib/contact'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'حذف الحساب' }

/**
 * رابط «حذف الحساب» الذي يطلبه Google Play: يشرح الطريقة لمن لم يعد التطبيق عنده،
 * ويؤكّد الحذف بعد تنفيذه (?done=1).
 */
export default async function DeleteAccountPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const { done } = await searchParams
  const email = contactEmail()
  if (done === '1') {
    return (
      <div dir="rtl" className="container max-w-xl space-y-4 py-16 text-center">
        <CheckCircle2 className="mx-auto size-14 text-success" />
        <h1 className="font-display text-3xl font-bold">حُذف حسابك</h1>
        <p className="text-muted-foreground">مُحيت بيانات هويّتك وأُنهيت كل جلساتك. نتمنّى لك التوفيق في دراستك.</p>
        <Button asChild variant="outline">
          <Link href="/">العودة إلى الرئيسية</Link>
        </Button>
      </div>
    )
  }
  return (
    <article dir="rtl" className="container max-w-2xl space-y-6 py-12 leading-loose">
      <h1 className="font-display text-4xl font-bold">حذف حسابك في «مدرسة»</h1>
      <p className="text-muted-foreground">تستطيع حذف حسابك بنفسك في أي وقت، من المتصفّح أو من التطبيق، دون أن تراسل أحداً.</p>

      <ol className="list-decimal space-y-2 ps-6">
        <li>
          سجّل الدخول في{' '}
          <Link href="/login?next=/student/profile%23delete" className="font-bold text-primary">
            madrasadz.com
          </Link>
          .
        </li>
        <li>افتح «ملفي».</li>
        <li>في أسفل الصفحة، في قسم «حذف حسابي»، أدخل كلمة السر وأكّد، ثم اضغط «احذف حسابي نهائياً».</li>
      </ol>

      <Button asChild variant="destructive" size="lg">
        <Link href="/login?next=/student/profile%23delete">ادخل واحذف حسابي</Link>
      </Button>

      <section className="space-y-2 rounded-lg border bg-card p-5 text-sm">
        <h2 className="font-bold">ما الذي يُحذف؟</h2>
        <ul className="list-disc space-y-1 ps-5 text-muted-foreground">
          <li>يُمحى نهائياً: الاسم، والبريد، والهاتف، والولاية، والمؤسسة، وهاتف الوليّ، وكلمة السر، والجلسات، واشتراكات الإشعارات.</li>
          <li>تغادر كل أفواجك فوراً.</li>
          <li>يبقى الحضور والعلامات السابقة عند أستاذك بلا اسم ولا أي وسيلة تعرّف، ضمن إحصاءات فوجه.</li>
        </ul>
        <p className="text-muted-foreground">
          الحذف فوري ونهائي. التفاصيل في{' '}
          <Link href="/privacy" className="font-bold text-primary">
            سياسة الخصوصية
          </Link>
          .
        </p>
      </section>

      {email ? (
        <p className="text-sm text-muted-foreground">
          نسيت كلمة السر ولا تستطيع الدخول؟ استعملها من «نسيت كلمة السر؟»، أو راسلنا من بريد حسابك على{' '}
          <a href={`mailto:${email}?subject=${encodeURIComponent('طلب حذف حساب')}`} dir="ltr" className="font-bold text-primary">
            {email}
          </a>{' '}
          ونحذفه خلال 7 أيام.
        </p>
      ) : null}
    </article>
  )
}
