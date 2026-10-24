'use client'

import { PhoneCall, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { OtpVerifyCard } from '@/components/domain/otp-verify-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * شاشة تأكيد الهاتف للحساب الجديد: رمز SMS، و/أو مكالمة فائتة مجانية إلى رقم المشرف.
 * مع المكالمة تُحدَّث الصفحة كل 5 ثوانٍ: ما إن يبلّغ تطبيق الهاتف بالمكالمة يُفتح الحساب وحده.
 */
export function PhoneGate({ phone, sms, callNumber }: { phone: string | null; sms: boolean; callNumber: string | null }) {
  const router = useRouter()
  useEffect(() => {
    if (!callNumber) return
    const id = window.setInterval(() => router.refresh(), 5000)
    return () => window.clearInterval(id)
  }, [callNumber, router])
  return (
    <div className="mx-auto max-w-lg space-y-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" /> أكّد رقم هاتفك للمتابعة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>نقبل الأرقام الحقيقية فقط: بها تُؤكَّد طلباتك ويصلك كود التفعيل والتذكير بالحصص.</p>
          {phone ? (
            <p>
              الرقم المسجَّل: <span dir="ltr" className="font-mono font-bold text-foreground">{phone}</span>
            </p>
          ) : null}
        </CardContent>
      </Card>
      {callNumber ? (
        <Card className="border-primary/40">
          <CardContent className="space-y-2 p-5 text-sm">
            <p className="flex items-center gap-2 font-bold">
              <PhoneCall className="size-4 text-primary" /> مجاناً: اتصل من هاتفك بهذا الرقم ولا تنتظر الردّ
            </p>
            <a href={`tel:${callNumber}`} dir="ltr" className="block text-center font-mono text-2xl font-extrabold text-primary underline">
              {callNumber}
            </a>
            <p className="text-xs text-muted-foreground">يُقطع الاتصال وحده بعد رنّة، ويُفتح حسابك خلال ثوانٍ (هذه الصفحة تتحدّث تلقائياً).</p>
          </CardContent>
        </Card>
      ) : null}
      {sms ? <OtpVerifyCard purpose="REGISTER" phone={phone} refreshOnVerified title={callNumber ? 'أو: رمز بالرسائل القصيرة' : 'رمز بالرسائل القصيرة'} description="نرسل رمزاً إلى هاتفك؛ أدخله هنا." /> : null}
    </div>
  )
}
