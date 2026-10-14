import { cookies } from "next/headers"
import { ContentPage, ContentUnavailable, ContentContact } from "@/components/content/content-blocks"
import { getPublishedSiteContent } from "@/lib/content/site-public"
import { getLocale } from "@/lib/i18n/utils"

export default async function CodeOfConductPage() {
  const cookieStore = await cookies()
  const locale = getLocale(cookieStore.get("lang")?.value)
  const result = await getPublishedSiteContent()
  if (result.status === "error") {
    return <ContentUnavailable title={locale === "zh" ? "行为准则" : "Code of Conduct"} locale={locale} />
  }
  const page = result.content.pages.conduct
  const email = result.content.contacts.report || result.settings.contact_email
  const showContact = page.sections.some(block => block.id === "report" && block.enabled)

  return (
    <ContentPage page={page} locale={locale}>
      {showContact && <ContentContact email={email} locale={locale} />}
    </ContentPage>
  )
}
