/** العدّ العربي للمدد: «ساعة واحدة»، «ساعتين»، «5 ساعات»، «72 ساعة»، «يومًا واحدًا»، «يومين»، «3 أيام»… */
function countAr(n: number, one: string, two: string, few: string, many: string): string {
  if (n === 1) return one
  if (n === 2) return two
  return n <= 10 ? `${n} ${few}` : `${n} ${many}`
}

export const hoursAr = (h: number): string => countAr(h, 'ساعة واحدة', 'ساعتين', 'ساعات', 'ساعة')

export const daysAr = (d: number): string => countAr(d, 'يومًا واحدًا', 'يومين', 'أيام', 'يومًا')

/** مدة بالساعات تُكتب بالأيام إن كانت أيامًا كاملة، وإلا بالساعات */
export const spanAr = (h: number): string => (h % 24 === 0 ? daysAr(h / 24) : hoursAr(h))

/**
 * العدد مع معدوده (21 نوفمبر 2026): forms = [المفرد، المثنى، الجمع، التمييز بعد العشرة]،
 * مثل «حصة واحدة، حصتان، حصص، حصة» ← «حصة واحدة»، «حصتان»، «3 حصص»، «12 حصة».
 */
export function countArForms(n: number, forms: readonly [one: string, two: string, few: string, many: string]): string {
  return countAr(n, ...forms)
}
