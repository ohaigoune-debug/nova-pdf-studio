import { PublicContentPage } from '@/components/domain/public-content-page'
import { t } from '@/i18n'

export const dynamic = 'force-dynamic'
export const metadata = { title: t('public.lessonsTitle') }

export default function LessonsPage({ searchParams }: { searchParams: Promise<{ q?: string; topic?: string }> }) {
  return <PublicContentPage title={t('public.lessonsTitle')} description={t('public.f1d')} types={['LESSON', 'ARTICLE']} basePath="/lessons" searchParams={searchParams} />
}
