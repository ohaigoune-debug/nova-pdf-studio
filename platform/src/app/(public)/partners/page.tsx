import { asc } from 'drizzle-orm'
import { Megaphone, School, UserRound } from 'lucide-react'
import { PartnerApplicationForm } from '@/components/partners/partners-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { getDb } from '@/server/db/client'
import { wilayas } from '@/server/db/schema'
import { referralPolicy } from '@/server/services/referrals.service'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'كن شريكًا' }

/**
 * /partners — «كن شريكًا»: التسجيل في الموقع للتلاميذ فقط؛ المسوّقون ونقاط البيع والأساتذة يقدّمون طلبًا هنا،
 * ويراجعه مدير العمليات ثم يرسل الحساب عبر واتساب.
 */
export default async function PartnersPage() {
  const db = await getDb()
  const [ws, policy] = await Promise.all([db.select({ id: wilayas.id, code: wilayas.code, name: wilayas.nameAr }).from(wilayas).orderBy(asc(wilayas.code)), referralPolicy(db)])
  const kinds = [
    { icon: Megaphone, title: 'مسوّق بالعمولة', body: `لك صفحة أو حساب معروف (أكثر من 1000 متابع تقريبًا)؟ تأخذ كودًا خاصًّا و${policy.affiliateDefaultDzd} دج نقدًا عن كل تلميذ جديد يشتري دورته بكودك، وترى زبائنك في حسابك.` },
    { icon: School, title: 'نقطة بيع', body: 'مدرسة أو مكتبة؟ نرسل لك الباقات، وتبيعها بالسعر نفسه، وتولّد كود التفعيل من هاتفك بضغطة واحدة، وتأخذ عمولتك عن كل باقة.' },
    { icon: UserRound, title: 'أستاذ', body: 'تريد نشر دورتك في مدرسة؟ أرسل طلبك ونتواصل معك.' }
  ]
  return (
    <div className="container max-w-3xl space-y-6 py-10">
      <PageHeader title="كن شريكًا" description="التسجيل في مدرسة للتلاميذ. للشراكة: أرسل طلبك هنا، ونراجعه ونتصل بك." />
      <div className="grid gap-3 sm:grid-cols-3">
        {kinds.map((k) => (
          <Card key={k.title}>
            <CardContent className="space-y-2 pt-5">
              <k.icon className="size-6 text-primary" />
              <p className="font-bold">{k.title}</p>
              <p className="text-sm text-muted-foreground">{k.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>طلب الشراكة</CardTitle>
        </CardHeader>
        <CardContent>
          <PartnerApplicationForm wilayas={ws.map((w) => ({ id: w.id, name: `${w.code} — ${w.name}` }))} />
        </CardContent>
      </Card>
    </div>
  )
}
