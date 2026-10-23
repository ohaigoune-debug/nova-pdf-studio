'use client'

import katex from 'katex'
import 'katex/dist/katex.min.css'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'

/** يكشف اتجاه النص: لاتيني ⇒ LTR، وإلا RTL */
export function textDir(s: string): 'rtl' | 'ltr' {
  const arabic = (s.match(/[؀-ۿ]/g) ?? []).length
  const latin = (s.match(/[A-Za-z]/g) ?? []).length
  return latin > arabic ? 'ltr' : 'rtl'
}

const MATH_RE = /\$\$([^$]+)\$\$|\$([^$\n]+)\$/g

/**
 * نص سؤال/خيار: يدعم معادلات بين $...$ (KaTeX) ويضبط الاتجاه تلقائياً للفرنسية/الإنجليزية والصيغ.
 * الناتج آمن: KaTeX يُهرِّب المدخلات، وبقية النص يُعرض كنص عادي.
 */
export function RichText({ text, className, as: Tag = 'span' }: { text: string; className?: string; as?: 'span' | 'p' | 'div' }) {
  const parts = useMemo(() => {
    const out: { kind: 'text' | 'math'; value: string; display?: boolean }[] = []
    let last = 0
    for (const m of text.matchAll(MATH_RE)) {
      const start = m.index ?? 0
      if (start > last) out.push({ kind: 'text', value: text.slice(last, start) })
      out.push({ kind: 'math', value: (m[1] ?? m[2] ?? '').trim(), display: !!m[1] })
      last = start + m[0].length
    }
    if (last < text.length) out.push({ kind: 'text', value: text.slice(last) })
    return out
  }, [text])
  const dir = textDir(text)
  return (
    <Tag dir={dir} className={cn(dir === 'ltr' ? 'text-left' : 'text-right', className)}>
      {parts.map((p, i) =>
        p.kind === 'text' ? (
          <span key={i}>{p.value}</span>
        ) : (
          <span
            key={i}
            dir="ltr"
            className={cn('inline-block px-1 align-middle', p.display && 'block my-2 text-center')}
            dangerouslySetInnerHTML={{ __html: safeKatex(p.value, !!p.display) }}
          />
        )
      )}
    </Tag>
  )
}

function safeKatex(src: string, display: boolean): string {
  try {
    return katex.renderToString(src, { displayMode: display, throwOnError: false, strict: 'ignore', trust: false })
  } catch {
    return src.replace(/</g, '&lt;')
  }
}
