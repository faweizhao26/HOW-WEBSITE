import { cookies } from "next/headers"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRight, ExternalLink } from "lucide-react"
import { pageMetadata } from "@/lib/seo/page-metadata"
import { getLocale } from "@/lib/i18n/utils"
import { Button } from "@/components/ui/button"
import { getPublishedSettings } from "@/lib/content/public"
import { getRegistrationOptions } from "@/lib/registration/settings"
import RegistrationForm from "./registration-form"

export function generateMetadata() { return pageMetadata("/register") }

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ method?: string | string[]; code?: string | string[] }> }) {
  const [cookieStore, result, query] = await Promise.all([cookies(), getPublishedSettings(), searchParams])
  const locale = getLocale(cookieStore.get("lang")?.value)
  const zh = locale === "zh"
  const { onsite, externalUrl } = getRegistrationOptions(result.status === "ready" ? result.data : result.status === "empty" ? {} : null)

  if (externalUrl && !onsite) redirect(externalUrl)
  // A channel-code link is already an explicit choice of the on-site form.
  if (onsite && (!externalUrl || query.method === "onsite" || (typeof query.code === "string" && query.code.trim()))) {
    return <RegistrationForm locale={locale} />
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="mb-5 text-3xl font-bold">{zh ? "大会报名" : "Conference registration"}</h1>
      {externalUrl && onsite ? (
        <div className="flex flex-wrap gap-3 border-t pt-5">
          <Button size="lg" nativeButton={false} render={<Link href="/register?method=onsite" />}>
            {zh ? "站内报名" : "Register on this site"} <ArrowRight aria-hidden="true" />
          </Button>
          <Button size="lg" variant="outline" nativeButton={false} render={<a href={externalUrl} rel="noreferrer" />}>
            {zh ? "站外报名" : "Register on the external platform"} <ExternalLink aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <p className="border-t pt-5 text-muted-foreground">
          {result.status === "error" ? (zh ? "报名信息暂时无法加载，请稍后再试。" : "Registration information is temporarily unavailable. Please try again later.")
            : (zh ? "大会报名暂未开放。" : "Conference registration is not currently open.")}
        </p>
      )}
    </div>
  )
}
