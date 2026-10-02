import { redirect } from 'next/navigation'

/** الأرشيف القديم → بنك البكالوريا (الروابط القديمة تبقى صالحة) */
export default async function ArchiveRedirect({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams
  const p = new URLSearchParams(Object.entries(q).filter((e): e is [string, string] => Boolean(e[1])))
  const s = p.toString()
  redirect(`/bac${s ? `?${s}` : ''}`)
}
