import Link from "next/link"
import { Locale } from "@/lib/i18n/utils"
import { navigation } from "@/lib/i18n/translations"

async function getSettings() {
  try {
    const { createServerSupabase } = await import("@/lib/supabase/server")
    const supabase = await createServerSupabase()
    const { data } = await supabase.from("site_settings").select("*")
    const map: Record<string, string> = {}
    data?.forEach((s: any) => (map[s.key] = s.value))
    return map
  } catch { return {} }
}

export async function Footer({ locale }: { locale: Locale }) {
  const s = await getSettings()
  const email = s.contact_email || "conference@how2027.org"
  const location = s.conference_location || "Jinan, China"
  const locationZh = s.conference_location_zh || "中国·济南"
  return (
    <footer className="bg-zinc-950 border-t border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-white font-semibold mb-4 bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent inline-block">
              HOW 2027
            </h3>
            <p className="text-zinc-400 text-sm">
              {locale === "zh"
                ? "PostgreSQL 生态大会"
                : "PostgreSQL Eco Conference"}
            </p>
          </div>
          <div>
            <h4 className="text-zinc-300 text-sm font-medium mb-3">{locale === "zh" ? "导航" : "Navigate"}</h4>
            <div className="space-y-2">
              <Link href="/about" className="block text-sm text-zinc-500 hover:text-zinc-300">{navigation.about[locale]}</Link>
              <Link href="/schedule" className="block text-sm text-zinc-500 hover:text-zinc-300">{navigation.schedule[locale]}</Link>
              <Link href="/sponsors" className="block text-sm text-zinc-500 hover:text-zinc-300">{navigation.sponsors[locale]}</Link>
              <Link href="/venue" className="block text-sm text-zinc-500 hover:text-zinc-300">{navigation.venue[locale]}</Link>
            </div>
          </div>
          <div>
            <h4 className="text-zinc-300 text-sm font-medium mb-3">{locale === "zh" ? "参与" : "Participate"}</h4>
            <div className="space-y-2">
              <Link href="/register" className="block text-sm text-zinc-500 hover:text-zinc-300">{navigation.register[locale]}</Link>
              <Link href="/cfp" className="block text-sm text-zinc-500 hover:text-zinc-300">{navigation.cfp[locale]}</Link>
              <Link href="/code-of-conduct" className="block text-sm text-zinc-500 hover:text-zinc-300">{navigation.codeOfConduct[locale]}</Link>
            </div>
          </div>
          <div>
            <h4 className="text-zinc-300 text-sm font-medium mb-3">{locale === "zh" ? "联系" : "Contact"}</h4>
            <div className="space-y-2">
              <p className="text-sm text-zinc-500">{email}</p>
              <p className="text-sm text-zinc-500">{locale === "zh" ? locationZh : location}</p>
            </div>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-zinc-800 text-center text-sm text-zinc-600">
          &copy; {new Date().getFullYear()} HOW 2027. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
