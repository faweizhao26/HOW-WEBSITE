import { cookies } from "next/headers"
import { ContentPage, ContentUnavailable, ContentContact } from "@/components/content/content-blocks"
import { getPublishedSiteContent } from "@/lib/content/site-public"
import { getLocale } from "@/lib/i18n/utils"

export default async function AttendPage() {
  const cookieStore = await cookies()
  const locale = getLocale(cookieStore.get("lang")?.value)
  const result = await getPublishedSiteContent()
  if (result.status === "error") {
    return <ContentUnavailable title={locale === "zh" ? "参会指南" : "Attend HOW 2027"} locale={locale} />
  }
  const page = result.content.pages.attend
  const email = result.content.contacts.sponsor || result.settings.contact_email
  const showContact = page.sections.some(block => block.id === "volunteers" && block.enabled)

  return (
    <ContentPage page={page} locale={locale}>
      {showContact && <ContentContact email={email} locale={locale} sponsor />}
    </ContentPage>
  )
}
