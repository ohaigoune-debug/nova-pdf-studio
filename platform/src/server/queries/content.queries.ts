import { and, desc, eq, ilike, inArray, isNotNull, isNull, or } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { content, files, levels, profiles, users } from '@/server/db/schema'
import type { ContentType } from '@/server/db/schema/enums'

export interface ContentCard {
  id: string
  slug: string
  type: string
  title: string
  summary: string | null
  topic: string | null
  levelName: string | null
  authorName: string | null
  publishedAt: Date | null
  externalUrl: string | null
}

export async function listPublicContent(db: Db, opts: { types?: ContentType[]; search?: string; topic?: string; limit?: number } = {}): Promise<ContentCard[]> {
  return db
    .select({
      id: content.id,
      slug: content.slug,
      type: content.type,
      title: content.title,
      summary: content.summary,
      topic: content.topic,
      levelName: levels.nameAr,
      authorName: profiles.fullName,
      publishedAt: content.publishedAt,
      externalUrl: content.externalUrl
    })
    .from(content)
    .leftJoin(levels, eq(levels.id, content.levelId))
    .leftJoin(users, eq(users.id, content.authorUserId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(
      and(
        eq(content.visibility, 'PUBLIC'),
        isNotNull(content.publishedAt),
        isNull(content.deletedAt),
        opts.types && opts.types.length > 0 ? inArray(content.type, opts.types) : undefined,
        opts.topic ? eq(content.topic, opts.topic) : undefined,
        opts.search ? or(ilike(content.title, `%${opts.search}%`), ilike(content.summary, `%${opts.search}%`), ilike(content.topic, `%${opts.search}%`)) : undefined
      )
    )
    .orderBy(desc(content.publishedAt))
    .limit(opts.limit ?? 60)
}

export async function getPublicContentBySlug(db: Db, slug: string) {
  const rows = await db
    .select({
      id: content.id,
      slug: content.slug,
      type: content.type,
      title: content.title,
      summary: content.summary,
      body: content.body,
      topic: content.topic,
      levelName: levels.nameAr,
      authorName: profiles.fullName,
      publishedAt: content.publishedAt,
      externalUrl: content.externalUrl,
      fileId: content.fileId,
      fileMime: files.mimeType,
      fileStatus: files.status,
      videoProvider: content.videoProvider,
      youtubeId: content.youtubeId,
      allowDownload: content.allowDownload
    })
    .from(content)
    .leftJoin(files, eq(files.id, content.fileId))
    .leftJoin(levels, eq(levels.id, content.levelId))
    .leftJoin(users, eq(users.id, content.authorUserId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(content.slug, slug), eq(content.visibility, 'PUBLIC'), isNotNull(content.publishedAt), isNull(content.deletedAt)))
    .limit(1)
  return rows[0] ?? null
}

export async function listTopics(db: Db): Promise<string[]> {
  const rows = await db
    .selectDistinct({ topic: content.topic })
    .from(content)
    .where(and(eq(content.visibility, 'PUBLIC'), isNotNull(content.topic), isNull(content.deletedAt)))
  return rows.map((r) => r.topic).filter((x): x is string => !!x)
}
