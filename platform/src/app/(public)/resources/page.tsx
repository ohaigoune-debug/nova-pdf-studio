import { PublicContentPage } from '@/components/domain/public-content-page'
import { getT } from '@/i18n/server'

export const dynamic = 'force-dynamic'
export async function generateMetadata() {
  const { t: tt } = await getT()
  return { title: tt('public.resourcesTitle') }
}

export default async function ResourcesPage({ searchParams }: { searchParams: Promise<{ q?: string; topic?: string }> }) {
  const { t, locale } = await getT()
  return <PublicContentPage locale={locale} title={t('public.resourcesTitle')} types={['PDF', 'VIDEO', 'AUDIO', 'IMAGE', 'LINK']} basePath="/resources" searchParams={searchParams} />
}
