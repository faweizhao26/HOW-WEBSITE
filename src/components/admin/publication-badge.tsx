import { Badge } from "@/components/ui/badge"
import type { Locale } from "@/lib/i18n/utils"

type PublicationBadgeProps = {
  status: "draft" | "published"
  publishedAt: string | null
  updatedAt: string
  locale: Locale
}

export function PublicationBadge({ status, publishedAt, updatedAt, locale }: PublicationBadgeProps) {
  const hasPendingChanges = status === "published" && publishedAt !== null && updatedAt > publishedAt

  if (hasPendingChanges) {
    return (
      <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
        {locale === "zh" ? "已发布，有待发布更改" : "Published, changes pending"}
      </Badge>
    )
  }

  if (status === "published") {
    return (
      <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
        {locale === "zh" ? "已发布" : "Published"}
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="border-zinc-400/40 bg-zinc-500/10 text-zinc-600 dark:text-zinc-300">
      {locale === "zh" ? "草稿" : "Draft"}
    </Badge>
  )
}
