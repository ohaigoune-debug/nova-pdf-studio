import { Clock, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime } from '@/lib/utils'
import { cancelScopeRequestAction } from '@/server/actions/student-scope.actions'
import type { ScopeRequestView, StudentScope } from '@/server/services/student-scope.service'
import { LevelStreamForm, type LevelStreamOptions } from './level-stream-form'

/**
 * «حسابي ← مستواي وشعبتي» (وجهة رابط «تغيير» في «دروسي»):
 * بلا مستوى/شعبة ⇒ اختيار أول يُحفظ مباشرة. بعده ⇒ طلب تغيير يراجعه عون التأكيد (طلب معلَّق واحد، يُسحب).
 */
export function ScopeAccountCard({ scope, request, options }: { scope: StudentScope; request: ScopeRequestView | null; options: LevelStreamOptions }) {
  const pending = request?.status === 'PENDING' ? request : null
  const rejected = request?.status === 'REJECTED' ? request : null
  return (
    <Card data-testid="scope-account-card">
      <CardHeader>
        <CardTitle>مستواي وشعبتي</CardTitle>
        <p className="text-sm text-muted-foreground">تحدّد الدروس التي تظهر لك في «دروسي» (دروس مستواك وشعبتك والدروس المشتركة بين شعب مستواك).</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!scope.complete ? (
          <LevelStreamForm options={options} levelId={scope.levelId} streamId={scope.streamId} submitLabel="احفظ مستواي وشعبتي" savedText="تم الحفظ. «دروسي» تعرض الآن دروس مستواك وشعبتك." />
        ) : (
          <>
            <p className="text-sm">
              الآن: <span className="font-bold">{scope.label}</span>
            </p>
            {pending ? (
              <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm" data-testid="scope-request-pending">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  <Clock className="size-4 text-amber-600" aria-hidden /> طلبك قيد المراجعة
                  <Badge variant="warning">{pending.fromLabel ?? '—'} ← {pending.toLabel}</Badge>
                </p>
                <p className="text-xs text-muted-foreground">أُرسل {formatDateTime(pending.createdAt)}. يراجعه عون التأكيد ويصلك إشعار بقراره.</p>
                <form action={cancelScopeRequestAction}>
                  <Button type="submit" variant="outline" size="sm">
                    اسحب الطلب
                  </Button>
                </form>
              </div>
            ) : (
              <>
                {rejected ? (
                  <p className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm">
                    <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                    <span>
                      لم يُقبل طلبك الأخير ({rejected.toLabel}){rejected.decisionNote ? `: ${rejected.decisionNote}` : '.'}
                    </span>
                  </p>
                ) : null}
                <p className="text-sm text-muted-foreground">لتغيير شعبتك (أو مستواك) اختر الجديد وأرسل طلبًا؛ يراجعه عون التأكيد ثم يُطبَّق على حسابك.</p>
                <LevelStreamForm mode="request" options={options} levelId={scope.levelId} streamId={scope.streamId} submitLabel="أرسل طلب التغيير" savedText="أُرسل طلبك. يصلك إشعار بقرار عون التأكيد." />
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
