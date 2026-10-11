/**
 * العدد مع المعدود بالعربية: 1 ← المفرد، 2 ← المثنّى، 3–10 ← الجمع، 11 فما فوق ← المفرد المنصوب.
 * مثال: arCount(2, ['شرح', 'شرحان', 'شروح', 'شرحاً']) = «شرحان»، arCount(5, …) = «5 شروح».
 */
export function arCount(n: number, [one, two, few, many]: [string, string, string, string]): string {
  if (n === 1) return `${one} واحد`.replace(/ة واحد$/, 'ة واحدة')
  if (n === 2) return two
  const mod = n % 100
  return `${n} ${mod >= 3 && mod <= 10 ? few : many}`
}

export const EXPLAINERS: [string, string, string, string] = ['شرح', 'شرحان', 'شروح', 'شرحاً']
export const CHANNELS: [string, string, string, string] = ['قناة', 'قناتان', 'قنوات', 'قناة']
export const REPLIES: [string, string, string, string] = ['ردّ', 'ردّان', 'ردود', 'ردّاً']
