'use client'

import { cn } from '@/lib/utils'
import type { PlayPublicPayload } from '@/server/play/question-types'
import { ResultBadge } from './play-art'
import { RichText } from './rich-text'

const LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و']

export type ChoiceState = 'idle' | 'picked' | 'correct' | 'wrong' | 'dim'

/**
 * حالة الخيار في البطاقة. قبل الرد لا يُعرف الصحيح (المفتاح في الخادم)، فلا يظهر «صحيح» أبدًا قبل المحاولة.
 * بعد الرد: الصحيح أخضر، والمختار الخاطئ أحمر، والباقي باهت كما في 05.
 */
export function choiceState(optionText: string, picked: boolean, result: { correctText: string } | null): ChoiceState {
  if (!result) return picked ? 'picked' : 'idle'
  if (optionText === result.correctText) return 'correct'
  return picked ? 'wrong' : 'dim'
}

/** اختيارات السؤال كما في 04: صفوف دائرية بحرف الخيار، واللمس يختار ويرسل */
export function DeckMcq({ payload, picked, disabled, result, onPick }: { payload: PlayPublicPayload; picked: string | null; disabled: boolean; result: { correctText: string } | null; onPick: (key: string) => void }) {
  if (payload.type !== 'MCQ') return null
  return (
    <div className="space-y-3" role="radiogroup" aria-label="الاختيارات">
      {payload.options.map((o, i) => {
        const isPicked = picked === o.key
        const state = choiceState(o.text, isPicked, result)
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={isPicked}
            disabled={disabled}
            onClick={() => onPick(o.key)}
            data-state={state}
            className={cn(
              'flex min-h-12 w-full items-center gap-3 rounded-full border-[1.5px] px-3 py-2 text-start transition-[background-color,border-color,opacity,filter] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-default',
              state === 'idle' && 'border-[#C9D7EE] bg-white hover:border-[#8FAAFF] hover:bg-[#F3F7FF]',
              state === 'picked' && 'border-[#6E9DEB] bg-[#D5E4FC]',
              state === 'correct' && 'border-[#8FD4A0] bg-[#E6F7EA]',
              state === 'wrong' && 'border-[#EBA9A9] bg-[#FDEDED]',
              state === 'dim' && 'border-[#DCE4F2] bg-white opacity-45 blur-[1.5px]'
            )}
          >
            {state === 'correct' || state === 'wrong' ? null : (
              <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full border-[1.5px] text-sm font-bold', state === 'picked' ? 'border-[#6E9DEB] bg-white text-primary' : 'border-[#BFCDE6] text-[#3B4C6B]')}>{LETTERS[i]}</span>
            )}
            <RichText text={o.text} className="flex-1 text-[1.03rem] font-bold leading-relaxed text-[#172B50]" />
            {state === 'correct' ? <ResultBadge ok className="size-7 shrink-0" /> : state === 'wrong' ? <ResultBadge ok={false} className="size-7 shrink-0" /> : null}
          </button>
        )
      })}
    </div>
  )
}
