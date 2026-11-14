import { ArrowLeft, Smartphone } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * أعلى الصفحة الرئيسية (قرار المالك 14 نوفمبر 2026): الاتجاه الأكاديمي الهادئ بخلفية مكتبة ناعمة.
 * الصورة أصلية: قصّ الخلفية الخضراء بقناة الشفافية وحدها (لا توليد ولا تعديل للوجه)، من حزمة المعاينة المعتمدة.
 * والخلفية مكتبة زخرفية مولَّدة برمجيًا، لا صورة مكان حقيقي.
 * النصوص معتمدة حرفيًا ودون تشكيل؛ والفواصل بين السنوات عربية.
 */

const STATS = [
  { value: '1.3 مليون', label: 'متابع على يوتيوب' },
  { value: '365 ألف', label: 'متابع على إنستغرام' },
  { value: 'أكثر من 343', label: 'درسا منشورا' },
  { value: '14 سنة', label: 'في التدريس' }
] as const

const HONORS = [
  { kind: 'trophy', title: 'أحسن صانع محتوى تعليمي — درع كليك الذهبي', years: '(2021، 2022، 2023)' },
  { kind: 'hall', title: 'مكرم من المجلس الأعلى للغة العربية', years: '(2022، 2023، 2024)' }
] as const

const FEATURES: { title: string; text: string; icon: ReactNode }[] = [
  {
    title: 'الدروس المسجلة',
    text: 'دروس مرتبة بحسب تسلسل الحصص لتتابع تعلمك بسهولة.',
    icon: (
      <>
        <rect x="7" y="8" width="34" height="27" rx="5" />
        <path d="m21 17 10 5-10 5V17ZM17 40h14M24 35v5" strokeLinecap="round" strokeLinejoin="round" />
      </>
    )
  },
  {
    title: 'الحصص المباشرة',
    text: 'لقاءات تفاعلية مع الأستاذ لشرح الدروس ومناقشتها.',
    icon: (
      <>
        <circle cx="24" cy="23" r="3" />
        <path d="M15 14a13 13 0 0 0 0 18M33 14a13 13 0 0 1 0 18M9 8a22 22 0 0 0 0 30M39 8a22 22 0 0 1 0 30" strokeLinecap="round" />
      </>
    )
  },
  {
    title: 'الملفات',
    text: 'ملخصات ووثائق وملفات مساعدة ترافق كل درس.',
    icon: (
      <>
        <path d="M5 14a5 5 0 0 1 5-5h11l5 5h12a5 5 0 0 1 5 5v18H5V14Z" strokeLinejoin="round" />
        <path d="M5 22h38" strokeLinecap="round" />
      </>
    )
  },
  {
    title: 'الفروض والاختبارات المصححة',
    text: 'فروض واختبارات مصححة ومنظمة حسب الفصول.',
    icon: (
      <>
        <rect x="9" y="7" width="30" height="35" rx="5" />
        <path d="M17 17l2 2 4-4M27 17h6M17 28l2 2 4-4M27 28h6" strokeLinecap="round" strokeLinejoin="round" />
      </>
    )
  },
  {
    title: 'القسم الافتراضي',
    text: 'اطرح أسئلتك واحصل على إجابات من الأستاذ.',
    icon: (
      <>
        <path d="M11 11h26a6 6 0 0 1 6 6v12a6 6 0 0 1-6 6H24l-10 7v-7h-3a6 6 0 0 1-6-6V17a6 6 0 0 1 6-6Z" strokeLinejoin="round" />
        <path d="M18 22c0-3 2-5 6-5 3 0 5 2 5 4 0 3-4 4-5 6M24 32v.5" strokeLinecap="round" />
      </>
    )
  }
]

function HonorIcon({ kind }: { kind: (typeof HONORS)[number]['kind'] }) {
  return (
    <svg viewBox="0 0 52 52" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-8 sm:size-9" aria-hidden>
      {kind === 'trophy' ? (
        <path d="M16 6h20v13c0 9-4 15-10 15s-10-6-10-15V6ZM16 11H8c0 11 3 17 11 17M36 11h8c0 11-3 17-11 17M26 34v8M16 46h20" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M26 5 43 13v3H9v-3L26 5ZM12 41h28M8 46h36M15 19v18M24 19v18M32 19v18M39 19v18" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  )
}

export interface HomeHeroProps {
  /** التلميذ الداخل يذهب إلى لوحته؛ الزائر إلى التسجيل */
  ctaHref: string
  ctaLabel: string
  /** «لديك حساب؟ تسجيل الدخول» للزائر وحده */
  loginLine?: { prompt: string; label: string } | null
  /** تطبيق أندرويد إن كان منشورًا على الخادم */
  android?: { title: string; detail: string } | null
}

export function HomeHero({ ctaHref, ctaLabel, loginLine, android }: HomeHeroProps) {
  return (
    <>
      <section className="relative overflow-hidden border-b bg-background" aria-labelledby="hero-title">
        <div className="container flex flex-col lg:grid lg:min-h-[600px] lg:grid-cols-[54%_46%]">
          {/* الصورة: فوق النص على الهاتف، وعلى يسار النص على الحاسوب */}
          <div className="relative -mx-4 h-[340px] overflow-hidden min-[361px]:h-[365px] sm:mx-0 lg:order-2 lg:-ms-14 lg:h-auto lg:min-h-[600px]">
            <div aria-hidden className="absolute inset-[-10%_-4%_-4%] bg-[url('/brand/home/library-atmosphere.webp')] bg-cover bg-center opacity-75 saturate-[.66] lg:inset-[0_-12%_-25%_-3%] lg:opacity-90" />
            <Image
              src="/brand/home/haigoune-pointing.webp"
              alt="الدكتور حيقون أسامة يشير بيده إلى المشاهد"
              width={1024}
              height={1536}
              priority
              sizes="(min-width: 1024px) 560px, 420px"
              className="absolute bottom-[-65%] left-1/2 z-[2] h-[165%] w-auto max-w-none -translate-x-1/2 drop-shadow-[0_8px_8px_rgba(17,27,53,0.08)] lg:bottom-[-34%] lg:left-0 lg:h-[135%] lg:translate-x-0 lg:drop-shadow-[0_12px_15px_rgba(20,16,12,0.1)]"
            />
            {/* تذوب الصورة في الخلفية: من الأسفل على الهاتف، ومن جهة النص على الحاسوب */}
            <div aria-hidden className="pointer-events-none absolute inset-0 z-[3] bg-gradient-to-t from-background from-0% via-transparent via-[18%] to-transparent lg:bg-gradient-to-r lg:from-transparent lg:from-[68%] lg:via-transparent lg:to-background/85" />
          </div>

          <div className="relative z-[5] flex flex-col items-center px-0 pb-12 text-center lg:order-1 lg:items-start lg:justify-center lg:py-[70px] lg:pe-8 lg:text-start">
            <span className="mb-1 hidden text-sm font-semibold text-primary lg:block">معك خطوة بخطوة حتى البكالوريا</span>
            <p className="font-heading text-2xl font-bold leading-snug lg:text-[31px]">الدكتور حيقون أسامة</p>
            <p className="mt-1 text-[13px] text-muted-foreground lg:text-base">أستاذ اللغة العربية وآدابها للبكالوريا</p>
            <h1 id="hero-title" className="mb-2 mt-4 font-heading text-[clamp(29px,8vw,39px)] font-bold leading-[1.28] tracking-tight sm:text-5xl lg:mt-6 lg:text-[clamp(44px,4.2vw,62px)] lg:leading-[1.26]">
              <span className="block whitespace-nowrap">نجاحك في البكالوريا</span>
              <span className="block whitespace-nowrap text-primary">يبدأ من هنا</span>
            </h1>
            <p className="mb-5 font-heading text-[19px] font-medium lg:mb-6 lg:text-[25px]">نفهم. نتقدم. نتفوق.</p>
            <Link
              href={ctaHref}
              className="inline-flex min-h-[54px] w-full max-w-[310px] items-center justify-center gap-4 rounded-[13px] bg-primary px-7 text-base font-bold text-primary-foreground shadow-soft transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:min-h-[59px] lg:w-auto lg:max-w-none lg:text-[19px]"
            >
              {ctaLabel}
              <ArrowLeft className="size-5 ltr:rotate-180" aria-hidden />
            </Link>
            {loginLine ? (
              <p className="mt-4 text-sm text-muted-foreground">
                {loginLine.prompt}{' '}
                <Link href="/login" className="font-semibold text-primary underline underline-offset-4">
                  {loginLine.label}
                </Link>
              </p>
            ) : null}
            <p className="mt-4 text-[11px] text-muted-foreground lg:mt-5 lg:text-[13px]">دكتوراه في الأدب العربي القديم ونقده</p>
            {android ? (
              <a href="/download/android" className="mt-5 inline-flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-start transition-colors hover:border-primary/50">
                <Smartphone className="size-6 text-primary" aria-hidden />
                <span className="leading-tight">
                  <span className="block font-bold">{android.title}</span>
                  <span className="block text-xs text-muted-foreground">{android.detail}</span>
                </span>
              </a>
            ) : null}
          </div>
        </div>
      </section>

      {/* الأرقام والتكريمات: حقيقية كما اعتمدها المالك، لا يُضاف إليها شيء */}
      <section className="container relative z-[6] -mt-6 lg:-mt-11" aria-label="بالأرقام">
        <div className="grid grid-cols-2 rounded-[17px] border border-foreground/10 bg-card px-2 py-3 shadow-soft lg:grid-cols-4 lg:rounded-[21px] lg:px-5 lg:py-6">
          {STATS.map((s, i) => (
            <div
              key={s.label}
              className={`flex flex-col items-center justify-center gap-0.5 px-1 py-4 text-center lg:py-0 ${i % 2 === 1 ? 'border-e-0 border-s border-border lg:border-s-0' : ''} ${i < 2 ? 'border-b border-border lg:border-b-0' : ''} ${i < STATS.length - 1 ? 'lg:border-e lg:border-border' : ''}`}
            >
              <strong className="text-[21px] font-bold leading-snug text-primary lg:text-[25px]">{s.value}</strong>
              <span className="text-[11px] text-foreground lg:text-[13px]">{s.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-2.5 lg:mt-5 lg:grid-cols-2 lg:gap-4">
          {HONORS.map((h) => (
            <article key={h.title} className="flex min-h-[85px] items-center gap-3 rounded-[14px] border border-foreground/10 bg-card/50 px-3.5 py-4 lg:min-h-[94px] lg:gap-4 lg:rounded-2xl lg:px-6 lg:py-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-[11px] bg-accent/30 text-[#5f7d00] dark:text-accent lg:size-[53px] lg:rounded-[14px]">
                <HonorIcon kind={h.kind} />
              </span>
              <div>
                <strong className="block text-[12.5px] font-bold leading-relaxed lg:text-sm">{h.title}</strong>
                <span className="mt-0.5 block text-[11.5px] text-muted-foreground lg:text-[13px]">{h.years}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ما يجده التلميذ في دورته: الأبواب الخمسة نفسها في صفحة الدورة */}
      <section className="container py-12 lg:py-[72px]" aria-labelledby="features-title">
        <div className="mb-5 flex items-center justify-center gap-3 text-center lg:mb-8 lg:gap-5">
          <span aria-hidden className="h-[3px] w-5 rounded-lg bg-accent lg:w-8" />
          <div>
            <p className="text-[11px] font-medium text-muted-foreground lg:text-[13px]">كل ما يحتاجه تلميذ البكالوريا</p>
            <h2 id="features-title" className="font-heading text-[23px] font-bold leading-normal lg:text-[29px]">
              تعلم بوضوح. تقدم بثقة.
            </h2>
          </div>
          <span aria-hidden className="h-[3px] w-5 rounded-lg bg-accent lg:w-8" />
        </div>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-5 lg:gap-4">
          {FEATURES.map((f) => (
            <article
              key={f.title}
              className="flex min-h-[205px] flex-col items-center rounded-[15px] border border-border bg-card px-3 py-6 text-center shadow-soft last:col-span-2 last:min-h-[175px] md:last:col-span-1 md:last:min-h-[205px] lg:min-h-[248px] lg:rounded-[18px] lg:px-4 lg:py-7 lg:last:min-h-[248px]"
            >
              <span className="mb-3 grid size-[52px] place-items-center rounded-[15px] bg-secondary text-primary lg:mb-4 lg:size-14">
                <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-8 lg:size-9" aria-hidden>
                  {f.icon}
                </svg>
              </span>
              <h3 className="mb-2 font-heading text-base font-bold leading-snug lg:mb-3 lg:text-lg">{f.title}</h3>
              <p className="max-w-[180px] text-[11px] leading-[1.8] text-muted-foreground lg:text-[12.5px] lg:leading-[1.95]">{f.text}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}
