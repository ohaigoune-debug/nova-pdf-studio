import { PublicContentPage } from '@/components/domain/public-content-page'
import { getT } from '@/i18n/server'

export const dynamic = 'force-dynamic'
export async function generateMetadata() {
  const { t: tt } = await getT()
  return { title: tt('public.lessonsTitle') }
}

export default async function LessonsPage({ searchParams }: { searchParams: Promise<{ q?: string; topic?: string }> }) {
  const { t, locale } = await getT()
  return <PublicContentPage locale={locale} title={t('public.lessonsTitle')} description={t('public.f1d')} types={['LESSON', 'ARTICLE', 'VIDEO', 'PDF']} basePath="/lessons" searchParams={searchParams} />
}
