import { redirect } from 'next/navigation'

/** «الموارد» دُمجت في «الدروس والموارد» (/lessons) */
export default async function ResourcesRedirect({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams
  const p = new URLSearchParams(Object.entries(q).filter((e): e is [string, string] => Boolean(e[1])))
  const s = p.toString()
  redirect(`/lessons${s ? `?${s}` : ''}`)
}
