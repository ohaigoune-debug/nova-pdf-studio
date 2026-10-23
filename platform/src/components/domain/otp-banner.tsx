'use client'

import { Smartphone } from 'lucide-react'
import { useState } from 'react'
import { OtpVerifyCard } from '@/components/domain/otp-verify-card'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/misc'

/** شريط صغير في لوحة التلميذ حين لم يؤكَّد الهاتف بعد: يفتح بطاقة التحقق عند الطلب (أو مباشرة بعد التسجيل) */
export function PhoneVerifyBanner({ phone, open: initiallyOpen = false }: { phone: string | null; open?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen)
  if (open) return <OtpVerifyCard purpose="REGISTER" phone={phone} refreshOnVerified description="يُستعمل هاتفك المؤكَّد لتأكيد طلباتك من المتجر دون رمز في كل مرة، ولتواصل الأستاذ معك." />
  return (
    <Alert tone="warning">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <Smartphone className="me-1 inline size-4" /> أكّد رقم هاتفك لتسهيل طلباتك والتواصل معك.
        </span>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          تأكيد الآن
        </Button>
      </div>
    </Alert>
  )
}
