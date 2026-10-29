import { BarChart3, BookOpen, ClipboardList, GraduationCap } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export type PlaySection = 'lessons' | 'tests' | 'bac' | 'results'

const SECTIONS: { key: PlaySection; label: string; hint: string; href: (s: string | null) => string; Icon: typeof BookOpen }[] = [
  { key: 'lessons', label: 'مراجعة الدروس', hint: 'بطاقات أسئلة لكل درس', href: (s) => (s ? `/student/play?subject=${s}` : '/student/play'), Icon: BookOpen },
  { key: 'tests', label: 'الفروض والاختبارات', hint: 'حسب الفصل', href: (s) => `/student/play/exams${s ? `?subject=${s}` : ''}`, Icon: ClipboardList },
  { key: 'bac', label: 'البكالوريا', hint: 'السنة ← الموضوع', href: (s) => `/student/play/bac${s ? `?subject=${s}` : ''}`, Icon: GraduationCap },
  { key: 'results', label: 'نتائجي وتقدمي', hint: 'علاماتك ومهاراتك', href: () => '/student/play/results', Icon: BarChart3 }
]

/** الأقسام الأربعة للعبة (03_PRODUCT_BLUEPRINT): محرك واحد، أربعة مداخل */
export function PlaySectionsNav({ active, subjectCode }: { active: PlaySection; subjectCode: string | null }) {
  return (
    <nav aria-label="أقسام مدرسة PLAY" className="play-deck mx-auto grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
      {SECTIONS.map(({ key, label, hint, href, Icon }) => {
        const on = key === active
        return (
          <Link
            key={key}
            href={href(subjectCode)}
            aria-current={on ? 'page' : undefined}
            data-testid={`play-section-${key}`}
            className={cn(
              'flex min-h-[5.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1457C5]/40',
              on ? 'border-[#6E9DEB] bg-[#D5E4FC] text-[#1B3F8F]' : 'border-[#D3E0F5] bg-white text-[#172B50] hover:border-[#8FAAFF] hover:bg-[#F3F7FF]'
            )}
          >
            <span className={cn('flex size-10 items-center justify-center rounded-full', on ? 'bg-white text-[#1457C5]' : 'bg-[#EEF4FF] text-[#1457C5]')}>
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="text-[0.95rem] font-extrabold leading-tight">{label}</span>
            <span className="text-[0.72rem] font-medium text-[#5B6B88]">{hint}</span>
          </Link>
        )
      })}
    </nav>
  )
}
