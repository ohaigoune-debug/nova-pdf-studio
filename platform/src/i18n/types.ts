/** جزئي عميق مع توسيع الأنواع الحرفية (العربية مصدر المفاتيح، والترجمات نصوص حرة) */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends string ? string : T[K] extends readonly string[] ? readonly string[] : T[K] extends object ? DeepPartial<T[K]> : T[K]
}
