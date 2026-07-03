import Link from "next/link"
import { cookies } from "next/headers"
import { getLocale } from "@/lib/i18n/utils"
import { home, schedule as sched } from "@/lib/i18n/translations"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle, ArrowRight, Calendar, MapPin, Users, Mic } from "lucide-react"
import { Countdown } from "@/components/countdown"

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

export default async function HomePage() {
  const cookieStore = await cookies()
  const locale = getLocale(cookieStore.get("lang")?.value)
  const settings = await getSettings()

  const heroTitle = settings.hero_title || home.heroTitle[locale]
  const heroTitleZh = settings.hero_title_zh || home.heroTitle["zh"]
  const heroSub = settings.hero_subtitle || home.heroSubtitle[locale]
  const heroSubZh = settings.hero_subtitle_zh || home.heroSubtitle["zh"]
  const date = settings.conference_date || "2027 — Jinan, China"
  const dateZh = settings.conference_date || "2027 年 — 中国·济南"
  const location = settings.conference_location || "Jinan"
  const locationZh = settings.conference_location_zh || "济南"
  const venueLine = settings.conference_location_zh || (locale === "zh" ? "山东济南 · 舜耕国际会议中心区" : "Jinan, Shandong — Shungeng International Convention Center")

  const stats = [
    { icon: Mic, label: locale === "zh" ? "演讲" : "Sessions", value: "18" },
    { icon: Users, label: locale === "zh" ? "参会者" : "Attendees", value: "500+" },
    { icon: MapPin, label: locale === "zh" ? "地点" : "Location", value: locale === "zh" ? locationZh : location },
    { icon: Calendar, label: locale === "zh" ? "天数" : "Days", value: "4" },
  ]

  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white via-emerald-50 to-cyan-50 dark:from-emerald-950/50 dark:via-zinc-950 dark:to-zinc-950" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-200 to-transparent dark:via-emerald-900/50" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 lg:py-40">
          <div className="max-w-3xl">
            <Badge className="mb-6 bg-white text-emerald-700 border-emerald-200 shadow-sm hover:bg-white dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-950/50">
              HOW 2027
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              {locale === "zh" ? heroTitleZh : heroTitle}
              <br />
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent whitespace-nowrap text-2xl sm:text-4xl lg:text-6xl">
                {locale === "zh" ? heroSubZh : heroSub}
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-zinc-700 dark:text-zinc-400 mb-8 max-w-xl">
              {locale === "zh" ? dateZh : date}
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/register">
                <Button size="lg" className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2">
                  {home.registerNow[locale]} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/schedule">
                <Button size="lg" variant="outline" className="border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-transparent dark:text-zinc-300 dark:hover:bg-zinc-800/50">
                  {sched.title[locale]}
                </Button>
              </Link>
            </div>

            <Countdown target={settings.conference_date || "2027-04-14"} locale={locale} />
          </div>
        </div>
      </section>

      <section className="relative -mt-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="bg-white dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
              <CardContent className="p-6 text-center">
                <stat.icon className="h-6 w-6 text-emerald-400 mx-auto mb-3" />
                <div className="text-2xl font-bold text-zinc-950 dark:text-white">{stat.value}</div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-6">{home.aboutTitle[locale]}</h2>
            <p className="text-zinc-700 dark:text-zinc-400 text-lg leading-relaxed mb-6">{home.aboutDesc[locale]}</p>
            <p className="text-zinc-600 dark:text-zinc-500 leading-relaxed">
              {locale === "zh"
                ? "HOW 2027 将再次回到充满活力的济南，汇聚来自全球的 PostgreSQL 专家、开发者及社区成员。敬请关注大会日期、讲者及议程等更多详情，我们将继续打造难忘的会议体验。"
                : "This premier open-source database event will return to the vibrant city of Jinan in 2027, bringing together PostgreSQL experts, developers, and community members from around the world."}
            </p>
            <Link href="/about" className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 mt-4">
              {locale === "zh" ? "了解更多" : "Learn more"} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="relative">
            <div className="aspect-square rounded-2xl bg-gradient-to-br from-emerald-50 to-cyan-50 dark:from-emerald-900/40 dark:to-cyan-900/40 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center shadow-sm dark:shadow-none">
              <div className="text-center p-8">
                <div className="text-8xl font-black bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-4">HOW</div>
                <div className="text-4xl font-bold text-zinc-950 dark:text-white">2027</div>
                <div className="text-zinc-600 dark:text-zinc-400 mt-2">{locale === "zh" ? locationZh : location}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 border-t border-zinc-200 dark:border-zinc-800">
        <h2 className="text-3xl font-bold text-center mb-12">{home.highlightsTitle[locale]}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {home.highlights[locale].map((h, i) => (
            <Card key={i} className="bg-white dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 hover:border-emerald-300 dark:hover:border-emerald-800/50 transition-colors shadow-sm dark:shadow-none">
              <CardContent className="p-6"><CheckCircle className="h-5 w-5 text-emerald-500 dark:text-emerald-400 mb-4" /><p className="text-sm text-zinc-700 dark:text-zinc-300">{h}</p></CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-zinc-200 dark:border-zinc-800">
        <div className="grid md:grid-cols-[1.2fr_0.8fr] gap-8 items-center">
          <div>
            <Badge variant="outline" className="mb-4 text-cyan-700 border-cyan-200 bg-cyan-50 dark:text-cyan-300 dark:border-cyan-900 dark:bg-transparent">
              {locale === "zh" ? "参会信息" : "Attendee Guide"}
            </Badge>
            <h2 className="text-3xl font-bold mb-4">
              {locale === "zh" ? "提前规划你的 HOW 2027 之行" : "Plan your HOW 2027 trip"}
            </h2>
            <p className="text-zinc-700 dark:text-zinc-400 leading-relaxed max-w-2xl">
              {locale === "zh"
                ? "交通住宿、现场指南、社区活动和志愿者信息会随着筹备推进陆续更新。"
                : "Travel, stay, on-site logistics, community socials, and volunteer notes will be updated as conference planning progresses."}
            </p>
          </div>
          <div className="md:text-right">
            <Link href="/attend">
              <Button size="lg" variant="outline" className="border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-transparent dark:text-zinc-300 dark:hover:bg-zinc-800/50">
                {locale === "zh" ? "查看参会指南" : "View Attend Guide"} <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-900/30 dark:to-cyan-900/30 border border-zinc-200 dark:border-zinc-800 p-12 text-center shadow-sm dark:shadow-none">
          <h2 className="relative text-3xl font-bold mb-4">{home.ctaTitle[locale]}</h2>
          <p className="relative text-zinc-700 dark:text-zinc-400 mb-8 max-w-md mx-auto">{venueLine}</p>
          <Link href="/register">
            <Button size="lg" className="relative bg-emerald-600 hover:bg-emerald-500">{home.registerNow[locale]}</Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
