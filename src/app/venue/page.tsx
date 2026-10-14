import { cookies } from "next/headers"
import Image from "next/image"
import { MapPin } from "lucide-react"
import { ContentLink, ContentUnavailable } from "@/components/content/content-blocks"
import { getPublishedSiteContent } from "@/lib/content/site-public"
import { contentText } from "@/lib/content/site-content"
import { getLocale } from "@/lib/i18n/utils"

export default async function VenuePage() {
  const cookieStore = await cookies()
  const locale = getLocale(cookieStore.get("lang")?.value)
  const title = locale === "zh" ? "会场信息" : "Venue"
  const result = await getPublishedSiteContent()
  if (result.status === "error") return <ContentUnavailable title={title} locale={locale} />

  const venue = result.content.venue
  const name = venue.confirmed
    ? contentText(venue.name, locale) || (locale === "zh" ? "会场待公布" : "Venue to be announced")
    : locale === "zh" ? "会场待公布" : "Venue to be announced"
  const address = venue.confirmed
    ? contentText(venue.address, locale)
    : locale === "zh" ? "具体地址将在会场确认后公布。" : "The address will be published once the venue is confirmed."
  const directions = venue.confirmed ? contentText(venue.directions, locale) : ""

  return (
    <div data-content-state="ready" className="mx-auto max-w-4xl px-4 py-16 [overflow-wrap:anywhere] sm:px-6 lg:px-8">
      <h1 className="mb-8 text-4xl font-bold text-zinc-950 dark:text-white">{title}</h1>
      <section className="space-y-6 border-y border-zinc-200 py-8 dark:border-zinc-800">
        <div className="flex items-start gap-4">
          <MapPin className="mt-1 size-6 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
          <div className="min-w-0 space-y-3">
            <h2 className="whitespace-pre-line text-xl font-semibold text-zinc-950 dark:text-white">{name}</h2>
            {address && <p className="whitespace-pre-line leading-relaxed text-zinc-600 dark:text-zinc-400">{address}</p>}
            {directions && <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{directions}</p>}
          </div>
        </div>
        {venue.confirmed && venue.imageUrl && (
          <div className="relative aspect-video w-full">
            <Image src={venue.imageUrl} alt={contentText(venue.imageAlt, locale) || name} fill unoptimized sizes="(max-width: 768px) 100vw, 896px" className="object-contain" />
          </div>
        )}
        {venue.confirmed && venue.mapUrl && (
          <ContentLink href={venue.mapUrl}>{locale === "zh" ? "查看地图" : "View map"}</ContentLink>
        )}
        {!venue.confirmed && <p className="text-sm text-zinc-600 dark:text-zinc-400">{locale === "zh" ? "地图将在会场确认后公布" : "The map will be published once the venue is confirmed"}</p>}
      </section>
    </div>
  )
}
