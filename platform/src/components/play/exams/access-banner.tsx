import { Clock, Gift, Lock, Sparkles } from 'lucide-react'
import Link from 'next/link'
import type { PlayAccess } from '@/server/services/play-access.service'
import { remainingLabel } from '@/server/services/play-access.service'

/**
 * حالة الوصول إلى PLAY (11_ACCESS_AND_TRIAL_POLICY) — الخادم مصدر الحقيقة، وهذا عرض فقط.
 * داخل تطبيق iPhone (دراسة فقط) لا يظهر أي رابط شراء أو متجر.
 */
export function PlayAccessBanner({ access, subjectName, iosStudyOnly }: { access: PlayAccess; subjectName: string | null; iosStudyOnly: boolean }) {
  const st = access.state
  if (st.kind === 'subscriber') {
    const course = st.courses[0]
    return (
      <div data-testid="play-access" data-state="subscriber" className="play-deck mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-[#BFE5C8] bg-[#ECF9EF] px-4 py-3 text-[#14532D]">
        <Gift className="size-5 shrink-0" aria-hidden />
        <p className="text-sm font-bold leading-relaxed">
          مدرسة PLAY متاحة لك مجانًا ضمن دورتك{course ? <> «{course.title}»</> : null}.
        </p>
      </div>
    )
  }
  if (st.kind === 'trial_available') {
    return (
      <div data-testid="play-access" data-state="trial_available" className="play-deck mx-auto max-w-xl rounded-2xl border border-[#BFD2F5] bg-white px-4 py-4 shadow-[0_10px_24px_-18px_rgba(20,87,197,0.6)]">
        <p className="flex items-center gap-2 text-[1.15rem] font-extrabold text-[#1B4DB1]">
          <span aria-hidden>🎮</span> جرّب الآن — العب مجانًا 3 أيام
        </p>
        <p className="mt-1 text-sm font-medium leading-relaxed text-[#3B4C6B]">تبدأ تجربتك عند أول جولة تلعبها فعلًا، وتدوم 72 ساعة كاملة: مراجعة الدروس، والفروض والاختبارات، والبكالوريا.</p>
      </div>
    )
  }
  if (st.kind === 'trial_active') {
    return (
      <div data-testid="play-access" data-state="trial_active" className="play-deck mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-[#BFD2F5] bg-[#EEF4FF] px-4 py-3 text-[#1B3F8F]">
        <Clock className="size-5 shrink-0" aria-hidden />
        <p className="text-sm font-bold">
          تجربتك المجانية مفعّلة — متبقٍّ لك <span data-testid="play-trial-remaining">{remainingLabel(st.remainingMs)}</span>
        </p>
      </div>
    )
  }
  return (
    <div data-testid="play-access" data-state="trial_expired" className="play-deck mx-auto max-w-xl rounded-2xl border border-[#F2C9A8] bg-[#FFF6EE] px-4 py-4 text-[#7C2D12]">
      <p className="flex items-center gap-2 text-[1.05rem] font-extrabold">
        <Lock className="size-5" aria-hidden /> انتهت تجربتك المجانية
      </p>
      {iosStudyOnly ? (
        <p className="mt-1 text-sm font-medium leading-relaxed">يمكنك متابعة دروسك المتاحة في التطبيق.</p>
      ) : (
        <>
          <p className="mt-1 text-sm font-medium leading-relaxed">
            اشترك في دورة {subjectName ? `«${subjectName}» ` : ''}لمستواك لتصبح مدرسة PLAY مجانية لك طوال مدة اشتراكك.
          </p>
          <Link href="/student/courses/catalog" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-gradient-to-b from-[#3B83F0] to-[#1457C5] px-5 text-sm font-extrabold text-white">
            <Sparkles className="size-4" aria-hidden /> اكتشف الدورات
          </Link>
        </>
      )}
    </div>
  )
}
