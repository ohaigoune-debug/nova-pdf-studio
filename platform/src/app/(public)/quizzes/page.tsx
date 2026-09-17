import { PublicContentPage } from '@/components/domain/public-content-page'
import { t } from '@/i18n'

export const dynamic = 'force-dynamic'
export const metadata = { title: t('public.quizzesTitle') }

export default function QuizzesPage({ searchParams }: { searchParams: Promise<{ q?: string; topic?: string }> }) {
  return <PublicContentPage title={t('public.quizzesTitle')} types={['QUIZ', 'EXERCISE']} basePath="/quizzes" searchParams={searchParams} />
}
