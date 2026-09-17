import { PublicContentPage } from '@/components/domain/public-content-page'
import { t } from '@/i18n'

export const dynamic = 'force-dynamic'
export const metadata = { title: t('public.bacTitle') }

export default function BacPage({ searchParams }: { searchParams: Promise<{ q?: string; topic?: string }> }) {
  return <PublicContentPage title={t('public.bacTitle')} description={t('public.f2d')} basePath="/bac" searchParams={Promise.resolve(searchParams).then((s) => ({ ...s, topic: s.topic ?? 'البكالوريا' }))} />
}
