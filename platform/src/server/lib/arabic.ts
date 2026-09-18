/** تطبيع نص عربي للمقارنة المتسامحة: إزالة التشكيل والتطويل وتوحيد الهمزات والتاء المربوطة والألف المقصورة */
export function normalizeArabic(input: string): string {
  return input
    .normalize('NFKC')
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function arabicEquals(a: string, b: string): boolean {
  return normalizeArabic(a) === normalizeArabic(b)
}
