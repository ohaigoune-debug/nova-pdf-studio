import { redirect } from 'next/navigation'

export default async function ArchiveDocumentRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/bac/${encodeURIComponent(id)}`)
}
