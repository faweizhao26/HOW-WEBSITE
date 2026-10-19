import { cookies } from "next/headers"
import { pageMetadata } from "@/lib/seo/page-metadata"

export function generateMetadata() { return pageMetadata("/venue") }
import { ContentUnavailable } from "@/components/content/content-blocks"
import { VenueView } from "@/components/content/site-views"
import { getPublishedSiteContent } from "@/lib/content/site-public"
import { getLocale } from "@/lib/i18n/utils"

export default async function VenuePage() {
  const cookieStore = await cookies()
  const locale = getLocale(cookieStore.get("lang")?.value)
  const title = locale === "zh" ? "会场信息" : "Venue"
  const result = await getPublishedSiteContent()
  if (result.status === "error") return <ContentUnavailable title={title} locale={locale} />
  return <VenueView settings={result.settings} content={result.content} locale={locale} />
}
