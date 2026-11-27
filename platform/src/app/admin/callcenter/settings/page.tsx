import { AgentTokenCard, CallCenterRunButtons, CallCenterSettingsForm } from '@/components/call-center/call-center-forms'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { ACTION_AR, SCRIPTS, type CcAction } from '@/lib/call-center'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { getCallCenterConfig, publicConfig, smsProviderAcceptsFreeText } from '@/server/services/call-center.service'

export const dynamic = 'force-dynamic'

const SCRIPT_AR: Record<string, string> = { SUSPENDED: 'طرد معلّق (للولي)', HOME_STUCK: 'توصيل المنزل متأخر (للولي)', CONFIRM_SPECIAL: 'تأكيد حالة خاصة (هاتف الطلب)' }

export default async function CallCenterSettingsPage() {
  await requirePageActor('SUPER_ADMIN')
  const db = await getDb()
  const [cfg, sms] = await Promise.all([getCallCenterConfig(db).then(publicConfig), smsProviderAcceptsFreeText(db)])
  const base = process.env.APP_URL?.replace(/\/$/, '') ?? 'https://madrasadz.com'
  return (
    <div className="space-y-6">
      <PageHeader title="إعدادات مركز الاتصال" description="ابدأ بوضع «تجربة» مع أرقامك أنت: يُخطَّط كل شيء ويظهر في اللوحة، ولا يُتّصل بأي زبون. «تشغيل حقيقي» بعد موافقة Ooredoo المكتوبة واختبار الجهاز." />

      <Card>
        <CardHeader>
          <CardTitle>التشغيل</CardTitle>
          <CardDescription>
            {cfg.enabledAt ? `يعمل منذ ${formatDateTime(cfg.enabledAt)}: لا رسائل ولا مكالمات لأحداث 48HR التي سبقت هذا الوقت.` : 'لم يُشغَّل بعد.'} الدورة تجري تلقائيًا كل 5 دقائق.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CallCenterRunButtons mode={cfg.mode} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>الإعدادات</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {cfg.smsChannel === 'provider' && !sms.ok ? (
            <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
              مزوّد الرسائل المربوط الآن ({sms.provider}) لا يقبل إلا قوالب رمز التحقق المعتمدة، فرسائل التوصيل لن تخرج منه وتبقى في الطابور. اختر «شرائح الجهاز» حين يصل الجهاز، أو اربط مزوّدًا يقبل النص الحرّ.
            </p>
          ) : null}
          <CallCenterSettingsForm config={cfg} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>الجهاز في بوسعادة</CardTitle>
          <CardDescription>الصندوق المحلي (Asterisk مع Yeastar TG400L) هو من يتصل بالمنصة عبر HTTPS برمز سرّي؛ لا يُفتح أي منفذ عندك.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <AgentTokenCard paired={cfg.agent.paired} hint={cfg.agent.hint} />
          <div className="flex flex-wrap gap-2">
            <Badge variant={cfg.agent.lastSeenAt ? 'secondary' : 'muted'}>آخر ظهور: {cfg.agent.lastSeenAt ? formatDateTime(cfg.agent.lastSeenAt) : 'لم يتصل بعد'}</Badge>
            {cfg.agent.version ? <Badge variant="muted">النسخة {cfg.agent.version}</Badge> : null}
            {cfg.agent.sims.map((s) => (
              <Badge key={s.slot} variant={s.ok ? 'success' : 'destructive'}>
                شريحة {s.slot} {s.ok ? '✓' : '✗'}
                {s.signal != null ? ` · إشارة ${s.signal}%` : ''}
              </Badge>
            ))}
          </div>
          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer font-semibold">عناوين الجهاز (للمبرمج)</summary>
            <ul className="mt-2 space-y-1 font-mono text-xs" dir="ltr">
              <li>GET {base}/api/v1/callcenter/agent/ping</li>
              <li>POST {base}/api/v1/callcenter/agent/pull</li>
              <li>POST {base}/api/v1/callcenter/agent/report</li>
              <li>POST {base}/api/v1/callcenter/agent/inbound</li>
              <li>Authorization: Bearer &lt;token&gt;</li>
            </ul>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>نصوص المكالمات</CardTitle>
          <CardDescription>تسجّلها بصوتك ملفاتٍ بالاسم نفسه (SUSPENDED.wav…) وتوضع في الجهاز. 3 خيارات على الأكثر، ولا خيار «ألغِ» في مكالمات التوصيل.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {Object.entries(SCRIPTS).map(([key, s]) => (
            <div key={key} className="space-y-1 rounded-lg border p-3">
              <p className="font-semibold">
                <span className="font-mono text-xs" dir="ltr">
                  {key}
                </span>{' '}
                — {SCRIPT_AR[key] ?? key}
              </p>
              <p className="leading-relaxed">{s.text}</p>
              <ul className="text-xs text-muted-foreground">
                {Object.entries(s.options).map(([d, a]) => (
                  <li key={d}>
                    {d} ← {ACTION_AR[a as CcAction]}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="rounded-lg border p-3">
            <p className="font-semibold">القائمة الصوتية للرقم الرسمي</p>
            <ul className="text-xs text-muted-foreground">
              {Object.entries(cfg.inboundMenu).map(([d, label]) => (
                <li key={d}>
                  {d} ← {label}
                  {cfg.texts.inboundReply[d] ? ` (تصله رسالة: ${cfg.texts.inboundReply[d]})` : ''}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
