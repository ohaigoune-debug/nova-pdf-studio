import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, PageHeader } from '@/components/ui/misc'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { getAiCredentials } from '@/server/services/ai-credentials.service'
import { recentSupportAiActivity, supportAiToday } from '@/server/support-ai/agent'
import { readSupportAiSettings, SUPPORT_AI_MODELS, SUPPORT_AI_NAME } from '@/server/support-ai/settings'
import { SupportAiForm } from './form'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'مساعد الدعم الذكي' }

const MODE_BADGE = {
  OFF: { label: 'متوقف', variant: 'secondary' },
  DRAFT: { label: 'مسودّات فقط', variant: 'warning' },
  PILOT: { label: 'تجربة على أرقام محددة', variant: 'warning' },
  ALL: { label: 'يردّ على كل التلاميذ', variant: 'success' }
} as const

export default async function SupportAiSettingsPage() {
  const actor = await requirePageActor('SUPER_ADMIN')
  const db = await getDb()
  const [settings, creds, today, activity] = await Promise.all([readSupportAiSettings(db), getAiCredentials(db, actor), supportAiToday(db), recentSupportAiActivity(db, 15)])
  const keyOk = creds?.provider === 'anthropic' && creds.usable
  const badge = MODE_BADGE[settings.mode]
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={SUPPORT_AI_NAME}
        description="يقرأ تذكرة التلميذ وحسابه ودوراته وطلبياته ثم يجيبه، ويحوّل إلى موظف كل ما يحتاج إجراءً (تفعيل، تغيير شعبة، مال) أو لم يتأكد منه. لا يغيّر شيئًا في الحسابات. لا يعمل في الشكاوى عن الأساتذة."
      />

      {!keyOk ? (
        <Alert tone="warning" title="المفتاح غير جاهز">
          {creds && creds.provider !== 'anthropic' ? 'المفتاح المحفوظ في «الذكاء الاصطناعي» لمزوّد آخر. ' : creds && !creds.usable ? 'المفتاح المحفوظ لم يعد يُفتح، أدخله من جديد. ' : 'لا يوجد مفتاح محفوظ. '}
          الصق مفتاح Anthropic (يبدأ بـ sk-ant-) في{' '}
          <Link href="/admin/ai" className="font-semibold text-primary underline">
            الذكاء الاصطناعي
          </Link>{' '}
          ثم عُد إلى هنا. المفتاح يُحفظ مختومًا داخل المنصة ولا يظهر بعد الحفظ.
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            الحالة <Badge variant={badge.variant}>{badge.label}</Badge>
            {keyOk ? <Badge variant="success">مفتاح Anthropic …{creds.hint}</Badge> : <Badge variant="destructive">بلا مفتاح</Badge>}
          </CardTitle>
          <CardDescription>
            اليوم: <span className="tabular-nums">{today.replies}</span> من <span className="tabular-nums">{settings.dailyLimit}</span> ردّ، وتكلفة تقديرية <span className="tabular-nums" dir="ltr">${today.costUsd.toFixed(2)}</span> من <span className="tabular-nums" dir="ltr">${settings.dailyBudgetUsd.toFixed(2)}</span>.
            {settings.updatedAt ? <> آخر تعديل {formatDateTime(settings.updatedAt)}.</> : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SupportAiForm values={{ mode: settings.mode, model: settings.model, pilotPhones: settings.pilotPhones, dailyLimit: settings.dailyLimit, dailyBudgetUsd: settings.dailyBudgetUsd, knowledge: settings.knowledge }} models={SUPPORT_AI_MODELS} />
        </CardContent>
      </Card>

      <Alert tone="info" title="الإطلاق بالتدريج">
        ابدأ بـ «مسودّات فقط» يومًا أو يومين وراجع أجوبته في التذاكر. ثم «تجربة على أرقام محددة» بحسابك التجريبي وبضعة تلاميذ. ثم «يردّ على كل التلاميذ». في أي تذكرة يمكنك إيقافه بزر «أوقف المساعد هنا»، ويستطيع التلميذ طلب موظف بزر «أريد موظفًا».
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>آخر ما كتبه المساعد</CardTitle>
          <CardDescription>افتح التذكرة لترى الجواب كاملًا.</CardDescription>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا شيء بعد.</p>
          ) : (
            <ul className="divide-y rounded-lg border text-sm">
              {activity.map((a, i) => (
                <li key={`${a.ticketId}-${i}`} className="flex flex-wrap items-center justify-between gap-2 p-2.5">
                  <Link href={`/admin/support/${a.ticketId}`} className="min-w-0 truncate hover:underline">
                    <span className="tabular-nums text-muted-foreground">#{a.number}</span> {a.subject}
                  </Link>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {formatDateTime(a.at)}
                    {a.handoff ? <Badge variant="warning">حُوّلت: {a.handoff}</Badge> : null}
                    <Badge variant={a.kind === 'reply' ? 'success' : 'secondary'}>{a.kind === 'reply' ? 'ردّ' : 'مسودّة'}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
