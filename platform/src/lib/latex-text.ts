/**
 * LaTeX ← نصّ خطّي مقروء بيونيكود (لتصدير Word والنسخ النصّية): f(x)=e^{x}-x ← f(x) = eˣ − x.
 * ليس تصييراً كاملاً؛ الشكل الكامل في PDF (KaTeX). ما لا يُعرف يبقى كما هو بلا الشرطة المائلة.
 */
const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '(': '⁽', ')': '⁾', n: 'ⁿ', x: 'ˣ', i: 'ⁱ', k: 'ᵏ', t: 'ᵗ', '=': '⁼' }
const SUB: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋', n: 'ₙ', k: 'ₖ', i: 'ᵢ', x: 'ₓ', m: 'ₘ', p: 'ₚ', '(': '₍', ')': '₎' }
const SYMBOLS: [RegExp, string][] = [
  [/\\mathbb\{R\}/g, 'ℝ'],
  [/\\mathbb\{N\}/g, 'ℕ'],
  [/\\mathbb\{Z\}/g, 'ℤ'],
  [/\\mathbb\{Q\}/g, 'ℚ'],
  [/\\mathbb\{C\}/g, 'ℂ'],
  [/\\infty/g, '∞'],
  [/\\pi/g, 'π'],
  [/\\alpha/g, 'α'],
  [/\\beta/g, 'β'],
  [/\\gamma/g, 'γ'],
  [/\\delta/g, 'δ'],
  [/\\theta/g, 'θ'],
  [/\\lambda/g, 'λ'],
  [/\\mu/g, 'μ'],
  [/\\sigma/g, 'σ'],
  [/\\omega/g, 'ω'],
  [/\\Delta/g, 'Δ'],
  [/\\Omega/g, 'Ω'],
  [/\\varepsilon|\\epsilon/g, 'ε'],
  [/\\le(?:q|qslant)?\b/g, '≤'],
  [/\\ge(?:q|qslant)?\b/g, '≥'],
  [/\\neq?\b/g, '≠'],
  [/\\approx/g, '≈'],
  [/\\equiv/g, '≡'],
  [/\\in\b/g, '∈'],
  [/\\notin/g, '∉'],
  [/\\subset/g, '⊂'],
  [/\\cup/g, '∪'],
  [/\\cap/g, '∩'],
  [/\\emptyset|\\varnothing/g, '∅'],
  [/\\forall/g, '∀'],
  [/\\exists/g, '∃'],
  [/\\to|\\rightarrow|\\longrightarrow/g, '→'],
  [/\\Rightarrow|\\implies/g, '⇒'],
  [/\\Leftrightarrow|\\iff/g, '⇔'],
  [/\\leftarrow/g, '←'],
  [/\\cdot/g, '·'],
  [/\\times/g, '×'],
  [/\\div/g, '÷'],
  [/\\pm/g, '±'],
  [/\\mp/g, '∓'],
  [/\\sum/g, '∑'],
  [/\\prod/g, '∏'],
  [/\\int/g, '∫'],
  [/\\partial/g, '∂'],
  [/\\nabla/g, '∇'],
  [/\\angle/g, '∠'],
  [/\\perp/g, '⊥'],
  [/\\parallel/g, '∥'],
  [/\\circ/g, '∘'],
  [/\\degree|\^\\circ/g, '°'],
  [/\\ldots|\\cdots|\\dots/g, '…'],
  [/\\quad|\\qquad/g, '  '],
  [/\\,|\;|\\:|\\!|\\ /g, ' '],
  [/\\left|\\right/g, ''],
  [/\\displaystyle/g, ''],
  [/\\(ln|log|exp|sin|cos|tan|lim|min|max|arcsin|arccos|arctan|sinh|cosh|tanh|det|mod|dim|gcd)\b/g, '$1']
]

const toScript = (s: string, map: Record<string, string>): string | null => {
  const chars = [...s]
  if (!chars.every((c) => map[c])) return null
  return chars.map((c) => map[c]!).join('')
}

function stripBraces(s: string): string {
  return s.replace(/[{}]/g, '')
}

/** المحتوى بين أقواس متوازنة بعد موضع `open` ({ أو [) */
function balanced(s: string, open: number, o = '{', c = '}'): { inner: string; end: number } | null {
  if (s[open] !== o) return null
  let depth = 0
  for (let i = open; i < s.length; i++) {
    if (s[i] === o) depth++
    else if (s[i] === c) {
      depth--
      if (depth === 0) return { inner: s.slice(open + 1, i), end: i + 1 }
    }
  }
  return null
}

export function latexToText(src: string): string {
  let s = src
  // الكسور والجذور (تداخل بتكرار من الداخل)
  const rec = (input: string): string => {
    let out = ''
    let i = 0
    while (i < input.length) {
      if (input.startsWith('\\frac', i) || input.startsWith('\\dfrac', i) || input.startsWith('\\tfrac', i)) {
        const start = input.indexOf('{', i)
        const a = start >= 0 ? balanced(input, start) : null
        const b = a ? balanced(input, a.end) : null
        if (a && b) {
          const num = rec(a.inner)
          const den = rec(b.inner)
          const wrap = (t: string) => (/[+\-\s]/.test(t.trim()) && t.trim().length > 1 ? `(${t})` : t)
          out += `${wrap(num)}/${wrap(den)}`
          i = b.end
          continue
        }
      }
      if (input.startsWith('\\sqrt', i)) {
        let j = i + 5
        let n = ''
        if (input[j] === '[') {
          const b = balanced(input, j, '[', ']')
          if (b) {
            n = b.inner
            j = b.end
          }
        }
        const a = balanced(input, j)
        if (a) {
          out += `${n === '3' ? '∛' : n === '4' ? '∜' : '√'}(${rec(a.inner)})`
          i = a.end
          continue
        }
      }
      if (input.startsWith('\\overline', i) || input.startsWith('\\bar', i) || input.startsWith('\\vec', i) || input.startsWith('\\overrightarrow', i)) {
        const cmdEnd = input.indexOf('{', i)
        const a = cmdEnd >= 0 ? balanced(input, cmdEnd) : null
        if (a) {
          const inner = rec(a.inner)
          const cmd = input.slice(i, cmdEnd)
          out += cmd.includes('vec') || cmd.includes('overrightarrow') ? [...inner].map((ch) => ch + '⃗').join('') : [...inner].map((ch) => ch + '̅').join('')
          i = a.end
          continue
        }
      }
      if (input.startsWith('\\text', i) || input.startsWith('\\mathrm', i) || input.startsWith('\\mathbf', i)) {
        const cmdEnd = input.indexOf('{', i)
        const a = cmdEnd >= 0 ? balanced(input, cmdEnd) : null
        if (a) {
          out += a.inner
          i = a.end
          continue
        }
      }
      out += input[i]
      i++
    }
    return out
  }
  s = rec(s)
  for (const [re, rep] of SYMBOLS) s = s.replace(re, rep)
  // الأسس والمؤشّرات
  s = s.replace(/\^\{([^{}]*)\}|\^(\S)/g, (_m, a: string | undefined, b: string | undefined) => {
    const inner = stripBraces(a ?? b ?? '')
    const sc = toScript(inner, SUP)
    return sc ?? `^(${inner})`
  })
  s = s.replace(/_\{([^{}]*)\}|_(\S)/g, (_m, a: string | undefined, b: string | undefined) => {
    const inner = stripBraces(a ?? b ?? '')
    const sc = toScript(inner, SUB)
    return sc ?? `_(${inner})`
  })
  s = s.replace(/\\[a-zA-Z]+/g, (m) => m.slice(1))
  // الطرح بين حدّين: مسافات حول «−»؛ الإشارة في أول الحدّ تبقى ملتصقة
  s = stripBraces(s)
    .replace(/\s+/g, ' ')
    .replace(/(?<=[\p{L}\p{N})\]ˣⁿ²³⁴⁵⁶⁷⁸⁹⁰∞])\s*-\s*(?=\S)/gu, ' − ')
    .replace(/\s*=\s*/g, ' = ')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return s
}

/** نصّ عادي مع $…$ ← نصّ خطّي (للاستعمال في Word أو في الملخّصات) */
export function bodyToText(text: string): string {
  return text.replace(/\$\$([^$]+?)\$\$|\$([^$\n]+?)\$/g, (_m, a: string | undefined, b: string | undefined) => latexToText(a ?? b ?? '')).replace(/\*\*(.+?)\*\*/g, '$1')
}
