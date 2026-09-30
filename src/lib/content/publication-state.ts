import type { NewsPost, PublishedNewsPost } from "@/lib/db/schema"

export function hasNewsChanges(draft: NewsPost, published: PublishedNewsPost | undefined) {
  if (draft.publication_status !== "published") return false
  if (!published) return true
  const fields = ["title", "title_zh", "content", "content_zh", "cover_url"] as const
  return fields.some((field) => draft[field] !== published[field])
}
