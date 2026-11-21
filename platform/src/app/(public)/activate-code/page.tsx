import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/** /activate-code القديم ⇒ صفحة الكود الموحّدة /code (21 نوفمبر 2026) */
export default async function ActivateCodePage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams
  redirect(`/code${code ? `?c=${encodeURIComponent(code)}` : ''}`)
}
