import { cookies } from "next/headers"
import { notFound } from "next/navigation"
import { getLocale } from "@/lib/i18n/utils"
import { getPublishedSiteContent } from "@/lib/content/site-public"
import { outreachPageVisible } from "@/lib/content/site-content"
import { OutreachPageView } from "@/components/content/outreach-views"
import { ContentUnavailable } from "@/components/content/content-blocks"

export const metadata = { title: "讲者指南 | HOW 2027", robots: { index: false, follow: true } }
export default async function Page() {
  const locale = getLocale((await cookies()).get("lang")?.value)
  const result = await getPublishedSiteContent()
  if (result.status === "error") return <ContentUnavailable title="讲者指南" locale={locale} />
  if (!outreachPageVisible(result.content.outreach.speakerGuide)) notFound()
  return <OutreachPageView content={result.content} locale={locale} page="speakerGuide" />
}
