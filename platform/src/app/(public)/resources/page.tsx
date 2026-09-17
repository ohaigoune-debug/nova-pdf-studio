import { PublicContentPage } from '@/components/domain/public-content-page'
import { t } from '@/i18n'

export const dynamic = 'force-dynamic'
export const metadata = { title: t('public.resourcesTitle') }

export default function ResourcesPage({ searchParams }: { searchParams: Promise<{ q?: string; topic?: string }> }) {
  return <PublicContentPage title={t('public.resourcesTitle')} types={['PDF', 'VIDEO', 'AUDIO', 'IMAGE', 'LINK']} basePath="/resources" searchParams={searchParams} />
}
