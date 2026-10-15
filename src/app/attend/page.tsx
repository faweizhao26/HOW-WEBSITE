import { cookies } from "next/headers"
import { ContentUnavailable } from "@/components/content/content-blocks"
import { SitePageView } from "@/components/content/site-views"
import { getPublishedSiteContent } from "@/lib/content/site-public"
import { getLocale } from "@/lib/i18n/utils"

export default async function AttendPage() {
  const cookieStore = await cookies()
  const locale = getLocale(cookieStore.get("lang")?.value)
  const result = await getPublishedSiteContent()
  if (result.status === "error") {
    return <ContentUnavailable title={locale === "zh" ? "参会指南" : "Attend HOW 2027"} locale={locale} />
  }
  return <SitePageView page="attend" settings={result.settings} content={result.content} locale={locale} />
}
