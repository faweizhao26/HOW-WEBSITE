import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ExternalLink } from "lucide-react"
import { pastConferencesId, visiblePastConferenceEntries } from "@/lib/content/past-conferences"
import { contentText, pastConferenceHref, type ContentBlock } from "@/lib/content/site-content"

export function PastConferenceCards({ rows, locale }: { rows: ContentBlock[]; locale: "en" | "zh" }) {
  if (!rows.some(row => row.id === pastConferencesId && row.enabled)) return null
  const editions = visiblePastConferenceEntries(rows)
  if (!editions.length) return null
  const zh = locale === "zh"

  return <section id="past-conferences" aria-labelledby="past-conference-title" className="scroll-mt-20 space-y-5">
    <h2 id="past-conference-title" className="text-2xl font-bold sm:text-3xl">{zh ? "往期回顾" : "Past Conferences"}</h2>
    <ul className="grid gap-4 sm:grid-cols-2 sm:gap-6">
      {editions.map(edition => {
        const href = pastConferenceHref(edition, locale)
        const external = href.startsWith("http")
        const Icon = external ? ExternalLink : ArrowRight
        const title = contentText(edition.title, locale).trim()
        const summary = contentText(edition.body, locale)
        return <li key={edition.id} className="min-w-0">
          <Link href={href} prefetch={false} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}
            aria-label={zh ? `查看 ${title} 回顾` : `View ${title} recap`}
            className="group flex h-full min-w-0 flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:border-emerald-600/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600 dark:hover:border-emerald-400/60">
            {edition.imageUrl && <div className="relative aspect-[3/2] overflow-hidden border-b bg-muted">
              <Image src={edition.imageUrl} alt={contentText(edition.imageAlt, locale)} fill unoptimized
                sizes="(min-width: 1280px) 600px, (min-width: 640px) 50vw, 100vw" className="object-cover" />
            </div>}
            <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5 [overflow-wrap:anywhere]">
              <h3 className="text-xl font-bold">{title}</h3>
              {summary && <p className="text-sm leading-relaxed text-muted-foreground">{summary}</p>}
              <span className="mt-auto flex items-center gap-2 pt-2 text-sm font-semibold text-emerald-700 group-hover:underline dark:text-emerald-400">
                {zh ? "查看回顾" : "View recap"}<Icon className="size-4 shrink-0" aria-hidden="true" />
              </span>
            </div>
          </Link>
        </li>
      })}
    </ul>
  </section>
}
