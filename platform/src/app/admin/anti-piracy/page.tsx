import Link from 'next/link'
import { ShieldAlert, ExternalLink, RadioTower, CircleCheck, FileWarning } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getAntiPiracyDashboard } from '@/server/services/anti-piracy.service'

export const dynamic = 'force-dynamic'

function safeTelegramUrl(url: string): string | null {
  return /^https:\/\/t\.me\/[A-Za-z0-9_]{5,32}\/\d+$/.test(url) ? url : null
}

const labels: Record<string, string> = {
  suspected: 'تحتاج مراجعة', confirmed: 'مخالفة مؤكدة', dismissed: 'مستبعدة'
}

export default async function AntiPiracyPage() {
  await requirePageActor('SUPER_ADMIN')
  const data = await getAntiPiracyDashboard()
  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader title="حماية الدورات من التسريب" description="رصد المنشورات العامة على تيليغرام، ومراجعة الاشتباه قبل أي بلاغ حقوق نشر." />
      {data.status !== 'ready' ? (
        <Card><CardContent className="pt-5 text-sm text-muted-foreground">
          {data.message || 'الخدمة في انتظار الإعداد الأول. لا توجد نتائج موثقة بعد.'}
          {' '} راجع دليل تشغيل وحدة Anti-Piracy، أو افتح{' '}
          <a href="https://t.me/Madrasadz_bot" target="_blank" rel="noreferrer" className="font-medium text-blue-700 underline">@Madrasadz_bot</a>.
        </CardContent></Card>
      ) : null}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { title: 'قيد المراجعة', count: data.counts.suspected ?? 0, icon: ShieldAlert },
          { title: 'مؤكد بعد المراجعة', count: data.counts.confirmed ?? 0, icon: FileWarning },
          { title: 'حالات مستبعدة', count: data.counts.dismissed ?? 0, icon: CircleCheck },
          { title: 'قنوات عامة مراقبة', count: data.channels.length, icon: RadioTower }
        ].map(({ title, count, icon: Icon }) => (
          <Card key={title}><CardContent className="flex items-center justify-between gap-2 pt-5">
            <div><p className="text-sm text-muted-foreground">{title}</p><p className="text-2xl font-semibold tabular-nums">{count}</p></div>
            <Icon className="h-6 w-6 text-blue-700" aria-hidden />
          </CardContent></Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>آخر المنشورات المرصودة (حد أقصى 50)</CardTitle></CardHeader>
        <CardContent>
          {data.cases.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد منشورات مرصودة حتى الآن.</p> : (
            <div className="space-y-3">
              {data.cases.map((item) => {
                const href = safeTelegramUrl(item.url)
                return <div key={item.id} className="rounded-lg border p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">حالة #{item.id} · @{item.source}</span>
                    <span className="text-muted-foreground">{labels[item.status] ?? 'غير محدد'}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">{item.snippet}</p>
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>الكلمات: {item.matched_terms}</span>
                    <span>رُصد: {item.detected_at}</span>
                    {href ? <Link className="inline-flex items-center gap-1 text-blue-700 underline" href={href} target="_blank" rel="noopener noreferrer">فتح المنشور <ExternalLink size={13} /></Link> : null}
                  </div>
                </div>
              })}
            </div>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">الرصد لا يثبت وجود انتهاك تلقائيًا. مراجعة الحالات وإنشاء مسودات البلاغات تتم داخل بوت الإدارة فقط؛ ولا يُرسل أي بلاغ تلقائيًا.</p>
    </div>
  )
}
