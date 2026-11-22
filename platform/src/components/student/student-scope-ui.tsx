import { GraduationCap, Lock } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CHANGE_SCOPE_HREF } from '@/lib/student-scope'
import { LevelStreamForm, type LevelStreamOptions } from './level-stream-form'

/** السطر الصغير أعلى قائمة الدروس: «السنة الثالثة ثانوي · آداب وفلسفة» ورابط «تغيير» إلى «حسابي» */
export function StudentScopeLine({ label }: { label: string }) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground" data-testid="student-scope-line">
      <GraduationCap className="size-4 text-primary" aria-hidden />
      <span className="font-semibold text-foreground">{label}</span>
      <Link href={CHANGE_SCOPE_HREF} className="text-xs text-primary underline underline-offset-2">
        تغيير
      </Link>
    </p>
  )
}

/** طلب الاختيار مرة واحدة: تلميذ بلا مستوى (أو ثانوي بلا شعبة) في حسابه */
export function ChooseScopeCard({ options, levelId, streamId }: { options: LevelStreamOptions; levelId?: string | null; streamId?: string | null }) {
  return (
    <Card className="border-primary/40" data-testid="choose-scope">
      <CardHeader>
        <CardTitle>اختر مستواك وشعبتك</CardTitle>
        <p className="text-sm text-muted-foreground">مرة واحدة فقط: نحفظهما في حسابك لنرسل لك كتب شعبتك الصحيحة ونعرض لك دروسها. اخترهما بعناية: تغييرهما بعد ذلك بطلب من «حسابي» يراجعه عون التأكيد.</p>
      </CardHeader>
      <CardContent>
        <LevelStreamForm options={options} levelId={levelId} streamId={streamId} submitLabel="احفظ" />
      </CardContent>
    </Card>
  )
}

/** درس منشور لكنه لمستوى أو شعبة أخرى (فُتح برابط مباشر) */
export function OutOfScopeNotice({ label }: { label: string | null }) {
  return (
    <Card className="mx-auto max-w-xl" data-testid="out-of-scope">
      <CardContent className="space-y-4 p-6 text-center sm:p-6">
        <Lock className="mx-auto size-8 text-muted-foreground" aria-hidden />
        <h1 className="text-lg font-extrabold">هذا الدرس ليس لمستواك وشعبتك</h1>
        {label ? (
          <p className="text-sm text-muted-foreground">
            حسابك مسجَّل في: <span className="font-semibold text-foreground">{label}</span>
          </p>
        ) : null}
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/student/lessons">دروسي</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={CHANGE_SCOPE_HREF}>طلب تغيير الشعبة</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
