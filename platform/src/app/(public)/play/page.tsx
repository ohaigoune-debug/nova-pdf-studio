import { Gamepad2, Sparkles, Target, Trophy } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { getCurrentActor } from '@/server/auth/current-user'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PublicPlayPage() {
  const actor = await getCurrentActor()
  if (actor?.role === 'STUDENT') redirect('/student/play')
  return (
    <div className="container py-10">
      <section className="mx-auto max-w-3xl rounded-3xl border bg-gradient-to-br from-primary/15 via-card to-accent/15 p-8 text-center shadow-sm">
        <Gamepad2 className="mx-auto mb-4 size-14 text-primary" />
        <h1 className="text-3xl font-extrabold sm:text-4xl">MADRASADZ PLAY</h1>
        <p className="mt-2 text-lg font-bold text-primary">العب، تعلّم، أتقن.</p>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">ألعاب تعليمية مبنية على المنهاج الجزائري: اختر سنتك وشعبتك ومادتك ودرسك، ثم تدرّب بأسئلة اختيار من متعدد وملء الفراغ مع تصحيح فوري وشرح، ونقاط خبرة، ومستويات، ومراجعة ذكية لأخطائك.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/register">أنشئ حساباً مجانياً</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">تسجيل الدخول</Link>
          </Button>
        </div>
      </section>
      <section className="mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-3">
        {[
          { icon: Target, title: 'حسب درسك', text: 'الرابعة متوسط إلى الثالثة ثانوي، بكل الشعب والمواد.' },
          { icon: Sparkles, title: 'تصحيح وشرح', text: 'كل إجابة تتبعها لماذا؛ الخطأ فرصة للتعلم.' },
          { icon: Trophy, title: 'نقاط وشارات', text: 'XP ومستويات وتحدٍّ يومي وتحدي البكالوريا.' }
        ].map((f) => (
          <div key={f.title} className="rounded-2xl border bg-card p-5">
            <f.icon className="mb-2 size-7 text-primary" />
            <h2 className="font-extrabold">{f.title}</h2>
            <p className="text-sm text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
