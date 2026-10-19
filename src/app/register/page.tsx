import { cookies } from "next/headers"
import { pageMetadata } from "@/lib/seo/page-metadata"

export function generateMetadata() { return pageMetadata("/register") }
import { getLocale } from "@/lib/i18n/utils"
import RegistrationForm from "./registration-form"

export default async function RegisterPage() {
  const cookieStore = await cookies()
  const locale = getLocale(cookieStore.get("lang")?.value)
  return <RegistrationForm locale={locale} />
}
