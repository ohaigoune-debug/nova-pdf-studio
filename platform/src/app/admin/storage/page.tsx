import { HardDrive } from 'lucide-react'
import { PageHeader, PhaseNote, StatCard } from '@/components/ui/misc'
import { t } from '@/i18n'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { storageStats } from '@/server/queries/admin-extras.queries'

export default async function AdminStoragePage() {
  const actor = await requirePageActor('SUPER_ADMIN')
  const s = await storageStats(await getDb(), actor)
  return (
    <>
      <PageHeader title={t('admin.storageTitle')} />
      <PhaseNote phase={4} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="الملفات" value={s.files} icon={HardDrive} />
        <StatCard label="الحجم" value={`${(s.bytes / 1024 / 1024).toFixed(1)} MB`} />
        <StatCard label="عناصر المحتوى" value={s.content} />
        {s.byBucket.map((b) => (
          <StatCard key={b.bucket} label={`Bucket: ${b.bucket}`} value={b.n} hint={`${(b.bytes / 1024 / 1024).toFixed(1)} MB`} />
        ))}
      </div>
    </>
  )
}
