import Link from "next/link"
import { Locale } from "@/lib/i18n/utils"
import { navigation } from "@/lib/i18n/translations"
import { getPublishedSettings } from "@/lib/content/public"
import { defaultSiteSettings } from "@/lib/content/settings"

export async function Footer({ locale }: { locale: Locale }) {
  const result = await getPublishedSettings()
  const settings = result.status === "error" ? null : result.status === "empty" ? defaultSiteSettings : result.data
  return (
    <footer className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <h3 className="mb-4 inline-block bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text font-semibold text-transparent dark:from-emerald-400 dark:to-cyan-400">
              {settings?.conference_name ?? "HOW 2027"}
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {locale === "zh"
                ? "PostgreSQL 生态大会"
                : "PostgreSQL Eco Conference"}
            </p>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-300">{locale === "zh" ? "导航" : "Navigate"}</h4>
            <div className="space-y-2">
              <Link href="/about" className="block text-sm text-zinc-500 hover:text-zinc-300">{navigation.about[locale]}</Link>
              <Link href="/speakers" className="block text-sm text-zinc-500 hover:text-zinc-300">{navigation.speakers[locale]}</Link>
              <Link href="/schedule" className="block text-sm text-zinc-500 hover:text-zinc-300">{navigation.schedule[locale]}</Link>
              <Link href="/attend" className="block text-sm text-zinc-500 hover:text-zinc-300">{navigation.attend[locale]}</Link>
              <Link href="/sponsors" className="block text-sm text-zinc-500 hover:text-zinc-300">{navigation.sponsors[locale]}</Link>
              <Link href="/venue" className="block text-sm text-zinc-500 hover:text-zinc-300">{navigation.venue[locale]}</Link>
            </div>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-300">{locale === "zh" ? "参与" : "Participate"}</h4>
            <div className="space-y-2">
              <Link href="/register" className="block text-sm text-zinc-500 hover:text-zinc-300">{navigation.register[locale]}</Link>
              <Link href="/cfp" className="block text-sm text-zinc-500 hover:text-zinc-300">{navigation.cfp[locale]}</Link>
              <Link href="/code-of-conduct" className="block text-sm text-zinc-500 hover:text-zinc-300">{navigation.codeOfConduct[locale]}</Link>
            </div>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-300">{locale === "zh" ? "联系" : "Contact"}</h4>
            <div className="space-y-2">
              {settings ? <><a href={`mailto:${settings.contact_email}`} className="block break-all text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300">{settings.contact_email}</a><p className="break-words text-sm text-zinc-500">{locale === "zh" ? settings.conference_location_zh : settings.conference_location}</p></> : <p className="text-sm text-muted-foreground">{locale === "zh" ? "联系信息暂时无法加载" : "Contact information is temporarily unavailable"}</p>}
            </div>
          </div>
        </div>
        <div className="mt-10 border-t border-zinc-200 pt-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-600">
          <div className="flex items-center justify-center gap-4">
            <span>&copy; {new Date().getFullYear()} HOW 2027. All rights reserved.</span>
            <Link href="/privacy" className="hover:text-zinc-400 transition-colors">
              {locale === "zh" ? "隐私条款" : "Privacy Policy"}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
