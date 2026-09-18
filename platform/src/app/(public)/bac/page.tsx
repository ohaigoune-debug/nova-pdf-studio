import { PublicContentPage } from '@/components/domain/public-content-page'
import { getT } from '@/i18n/server'

export const dynamic = 'force-dynamic'
export async function generateMetadata() {
  const { t: tt } = await getT()
  return { title: tt('public.bacTitle') }
}

export default async function BacPage({ searchParams }: { searchParams: Promise<{ q?: string; topic?: string }> }) {
  const { t, locale } = await getT()
  return <PublicContentPage locale={locale} title={t('public.bacTitle')} description={t('public.f2d')} basePath="/bac" searchParams={Promise.resolve(searchParams).then((s) => ({ ...s, topic: s.topic ?? 'البكالوريا' }))} />
}
