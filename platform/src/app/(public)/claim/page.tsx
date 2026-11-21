import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/** /claim القديم ⇒ صفحة الكود الموحّدة /code (21 نوفمبر 2026): روابط الرسائل القديمة لا تنكسر */
export default async function ClaimPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams
  redirect(`/code${code ? `?c=${encodeURIComponent(code)}` : ''}`)
}
