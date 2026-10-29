import { HubTabs } from '@/components/student/hub-tabs'
import { subjectName } from '@/server/play/constants'
import type { PlayAccess } from '@/server/services/play-access.service'
import { PlayAccessBanner } from './access-banner'
import { PlaySectionsNav, type PlaySection } from './sections-nav'

/** إطار صفحات الأقسام: تبويبات «تدرّب»، حالة الوصول، والأقسام الأربعة */
export function PlaySectionShell({ section, subjectCode, access, iosStudyOnly, children }: { section: PlaySection; subjectCode: string | null; access: PlayAccess | null; iosStudyOnly: boolean; children: React.ReactNode }) {
  return (
    <>
      <HubTabs hub="train" />
      <div className="space-y-5">
        {access ? <PlayAccessBanner access={access} subjectName={subjectCode ? subjectName(subjectCode) : null} iosStudyOnly={iosStudyOnly} /> : null}
        <PlaySectionsNav active={section} subjectCode={subjectCode} />
        <div className="play-deck mx-auto max-w-xl">{children}</div>
      </div>
    </>
  )
}
