import { cookies } from "next/headers"
import { pageMetadata } from "@/lib/seo/page-metadata"

export function generateMetadata() { return pageMetadata("/") }
import { getLocale } from "@/lib/i18n/utils"
import { getPublishedSessions, getPublishedSettings } from "@/lib/content/public"
import { defaultSiteSettings } from "@/lib/content/settings"
import { parseSiteContent } from "@/lib/content/site-content"
import { HomeView } from "@/components/content/site-views"

export default async function HomePage() {
  const cookieStore = await cookies()
  const locale = getLocale(cookieStore.get("lang")?.value)
  const [result, sessions] = await Promise.all([getPublishedSettings(), getPublishedSessions()])
  if (result.status === "error") return <div data-content-state="error" className="mx-auto min-h-[50vh] max-w-7xl px-4 py-16 sm:px-6 lg:px-8"><h1 className="mb-6 text-4xl font-bold">HOW 2027</h1><p className="text-muted-foreground">{locale === "zh" ? "大会信息暂时无法加载，请稍后再试。" : "Conference information is temporarily unavailable. Please try again later."}</p></div>
  const settings = result.status === "empty" ? defaultSiteSettings : result.data
  let content
  try { content = parseSiteContent(settings) } catch { return <div data-content-state="error" role="alert" className="mx-auto max-w-7xl px-4 py-16">{locale === "zh" ? "页面内容暂时无法加载。" : "Page content is temporarily unavailable."}</div> }

  return <HomeView settings={settings} content={content} locale={locale} sessions={sessions} contentState={result.status} />
}
