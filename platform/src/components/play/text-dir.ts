/** أدوات نصية خالصة (بلا React ولا CSS) — قابلة للاختبار */

export const MATH_RE = /\$\$([^$]+)\$\$|\$([^$\n]+)\$/g

/** يكشف اتجاه النص: لاتيني ⇒ LTR، وإلا RTL — دون احتساب ما بين $…$ (حروف LaTeX ليست لغة الجملة) */
export function textDir(s: string): 'rtl' | 'ltr' {
  const plain = s.replace(MATH_RE, ' ')
  const arabic = (plain.match(/[؀-ۿ]/g) ?? []).length
  const latin = (plain.match(/[A-Za-z]/g) ?? []).length
  return latin > arabic ? 'ltr' : 'rtl'
}
