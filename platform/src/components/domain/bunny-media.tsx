import { ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { errorMessage, t } from '@/i18n'
import { getDb } from '@/server/db/client'
import type { Actor } from '@/server/lib/actor'
import { isAppError } from '@/server/lib/errors'
import { bunnyEmbedForViewer } from '@/server/services/media.service'
import { SecureBunnyPlayer } from './secure-video-player'

/**
 * فيديو Bunny داخل الدرس: الخادم يتحقق من الأحقية ويوقّع رابط التضمين (ساعتان) لهذا المشاهد،
 * ثم يرسم المشغّل مع العلامة المائية الشخصية. الزائر لا يرى إلا المحتوى العام.
 */
export async function BunnyMedia({ contentId, actor }: { contentId: string; actor: Actor | null }) {
  if (!actor) return <p className="text-sm text-muted-foreground">{t('activate.needLogin')}</p>
  try {
    const embed = await bunnyEmbedForViewer(await getDb(), actor, contentId)
    return (
      <div>
        <Badge variant="success" className="mb-2 inline-flex items-center gap-1">
          <ShieldCheck className="size-3" /> {t('media.protectedBadge')}
        </Badge>
        <SecureBunnyPlayer src={embed.url} expires={embed.expires} contentId={embed.contentId} watermark={embed.watermark} title={embed.title} />
      </div>
    )
  } catch (e) {
    if (isAppError(e)) return <p className="text-sm text-muted-foreground">{errorMessage(e.code)}</p>
    throw e
  }
}
