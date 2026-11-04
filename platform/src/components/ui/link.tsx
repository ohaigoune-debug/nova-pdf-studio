import NextLink from 'next/link'
import type { ComponentProps } from 'react'

/**
 * رابط داخلي بلا جلب مسبق.
 *
 * كل صفحات المنصة ديناميكية (nonce لسياسة CSP في كل طلب)، ولا يوجد loading.tsx في أغلبها،
 * فالجلب المسبق الذي يطلقه Next.js لكل رابط ظاهر يعود فارغًا ولا يسرّع شيئًا، لكنه يمرّ بالخادم.
 * قياس 4 نوفمبر 2026: زيارة واحدة لصفحة PLAY على الهاتف = صفحة + 10 طلبات جلب مسبق (نحو 2 م.ث لكل واحد).
 * التنقّل نفسه لا يتغيّر: يُطلب محتوى الصفحة عند النقر كما كان.
 */
export default function Link({ prefetch = false, ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={prefetch} {...props} />
}
