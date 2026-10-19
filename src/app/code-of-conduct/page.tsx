import { cookies } from "next/headers"
import { pageMetadata } from "@/lib/seo/page-metadata"

export function generateMetadata() { return pageMetadata("/code-of-conduct") }
import { ContentUnavailable } from "@/components/content/content-blocks"
import { SitePageView } from "@/components/content/site-views"
import { getPublishedSiteContent } from "@/lib/content/site-public"
import { getLocale } from "@/lib/i18n/utils"

export default async function CodeOfConductPage() {
  const cookieStore = await cookies()
  const locale = getLocale(cookieStore.get("lang")?.value)
  const result = await getPublishedSiteContent()
  if (result.status === "error") {
    return <ContentUnavailable title={locale === "zh" ? "行为准则" : "Code of Conduct"} locale={locale} />
  }
  return <SitePageView page="conduct" settings={result.settings} content={result.content} locale={locale} />
}
