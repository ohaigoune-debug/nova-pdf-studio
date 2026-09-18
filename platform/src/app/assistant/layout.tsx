import { UserX } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/misc'
import { t } from '@/i18n'
import { requirePageActor } from '@/server/auth/current-user'
import { logoutAction } from '@/server/actions/auth.actions'

export const dynamic = 'force-dynamic'

/** لوحة مساعد الأستاذ: نفس الهيكل، صلاحيات الحضور فقط. بلا مساحة (عضوية ملغاة) ⇒ شاشة توضيحية. */
export default async function AssistantLayout({ children }: { children: ReactNode }) {
  const actor = await requirePageActor('ASSISTANT')
  return (
    <AppShell actor={actor}>
      {actor.workspaceId ? (
        children
      ) : (
        <EmptyState
          icon={UserX}
          title={t('assistant.revokedTitle')}
          description={t('assistant.revokedBody')}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href="/assistant-join">{t('assistant.joinTitle')}</Link>
              </Button>
              <form action={logoutAction}>
                <Button type="submit" variant="outline">
                  {t('common.logout')}
                </Button>
              </form>
            </div>
          }
        />
      )}
    </AppShell>
  )
}
