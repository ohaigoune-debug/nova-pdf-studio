import { asc, isNull } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { levels, streams, subjects } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { listNodes } from '@/server/services/taxonomy.service'

type Opt = { id: string; name: string }

/** خيارات نماذج البنك: المواد والصفوف والشعب كلّها، وعقد المنهاج للتصنيف الحالي إن حُدّد */
export async function bankFormOptions(db: Db, _actor: Actor, scope: { subjectId?: string | null; levelId?: string | null; streamId?: string | null } = {}): Promise<{ subjects: Opt[]; levels: Opt[]; streams: Opt[]; nodes: Opt[] }> {
  const [subjectRows, levelRows, streamRows] = await Promise.all([
    db.select({ id: subjects.id, name: subjects.nameAr }).from(subjects).orderBy(asc(subjects.sortOrder)),
    db.select({ id: levels.id, name: levels.nameAr }).from(levels).orderBy(asc(levels.sortOrder)),
    db.select({ id: streams.id, name: streams.nameAr }).from(streams).where(isNull(streams.parentId)).orderBy(asc(streams.sortOrder))
  ])
  let nodes: Opt[] = []
  if (scope.subjectId && scope.levelId) {
    const tree = await listNodes(db, { subjectId: scope.subjectId, levelId: scope.levelId, streamId: scope.streamId ?? null })
    const walk = (ns: typeof tree, prefix: string) => {
      for (const n of ns) {
        nodes.push({ id: n.id, name: `${prefix}${n.title}` })
        walk(n.children, `${prefix}${n.title} / `)
      }
    }
    walk(tree, '')
    nodes = nodes.slice(0, 400)
  }
  return { subjects: subjectRows, levels: levelRows, streams: streamRows, nodes }
}
