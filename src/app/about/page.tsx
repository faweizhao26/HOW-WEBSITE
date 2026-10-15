import { cookies } from "next/headers"
import { ContentUnavailable } from "@/components/content/content-blocks"
import { SitePageView } from "@/components/content/site-views"
import { getPublishedSiteContent } from "@/lib/content/site-public"
import { getLocale } from "@/lib/i18n/utils"

export default async function AboutPage() {
  const cookieStore = await cookies()
  const locale = getLocale(cookieStore.get("lang")?.value)
  const result = await getPublishedSiteContent()
  if (result.status === "error") {
    return <ContentUnavailable title={locale === "zh" ? "关于 HOW 2027" : "About HOW 2027"} locale={locale} />
  }
  return <SitePageView page="about" settings={result.settings} content={result.content} locale={locale} />
}
