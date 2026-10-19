import { cookies } from "next/headers"
import { pageMetadata } from "@/lib/seo/page-metadata"

export function generateMetadata() { return pageMetadata("/sponsors") }
import { getPublishedSponsors } from "@/lib/content/public"
import { getLocale } from "@/lib/i18n/utils"
import { getPublishedSiteContent } from "@/lib/content/site-public"
import { defaultSiteSettings } from "@/lib/content/settings"
import { parseSiteContent } from "@/lib/content/site-content"
import { SponsorsView } from "@/components/content/site-views"

export default async function SponsorsPage() {
  const cookieStore = await cookies()
  const locale = getLocale(cookieStore.get("lang")?.value)
  const [result, site] = await Promise.all([getPublishedSponsors(), getPublishedSiteContent()])
  return <SponsorsView sponsors={result} settings={site.status === "ready" ? site.settings : defaultSiteSettings} content={site.status === "ready" ? site.content : parseSiteContent(defaultSiteSettings)} siteError={site.status === "error"} locale={locale} />
}
