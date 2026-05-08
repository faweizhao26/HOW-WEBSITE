import Link from "next/link"
import { cookies } from "next/headers"
import { getLocale } from "@/lib/i18n/utils"
import { home, schedule as sched } from "@/lib/i18n/translations"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle, ArrowRight, Calendar, MapPin, Users, Mic } from "lucide-react"

export default async function HomePage() {
  const cookieStore = await cookies()
  const locale = getLocale(cookieStore.get("lang")?.value)

  const stats = [
    { icon: Mic, label: locale === "zh" ? "演讲" : "Sessions", value: "18" },
    { icon: Users, label: locale === "zh" ? "参会者" : "Attendees", value: "500+" },
    { icon: MapPin, label: locale === "zh" ? "地点" : "Location", value: locale === "zh" ? "济南" : "Jinan" },
    { icon: Calendar, label: locale === "zh" ? "天数" : "Days", value: "2" },
  ]

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/50 via-zinc-950 to-zinc-950" />
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-500 rounded-full blur-[128px]" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-cyan-500 rounded-full blur-[128px]" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 lg:py-40">
          <div className="max-w-3xl">
            <Badge className="mb-6 bg-emerald-950/50 text-emerald-300 border-emerald-800 hover:bg-emerald-950/50">
              HOW 2027
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              {home.heroTitle[locale]}
              <br />
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                {home.heroSubtitle[locale]}
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-zinc-400 mb-8 max-w-xl">
              {home.heroDate[locale]}
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/register">
                <Button size="lg" className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2">
                  {home.registerNow[locale]} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/schedule">
                <Button size="lg" variant="outline" className="border-zinc-700 text-zinc-300">
                  {sched.title[locale]}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="relative -mt-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="bg-zinc-900/80 border-zinc-800 backdrop-blur-sm">
              <CardContent className="p-6 text-center">
                <stat.icon className="h-6 w-6 text-emerald-400 mx-auto mb-3" />
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-zinc-400">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* About */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-6">
              {home.aboutTitle[locale]}
            </h2>
            <p className="text-zinc-400 text-lg leading-relaxed mb-6">
              {home.aboutDesc[locale]}
            </p>
            <p className="text-zinc-500 leading-relaxed">
              {locale === "zh"
                ? "HOW 2027 将再次回到充满活力的济南，汇聚来自全球的 PostgreSQL 专家、开发者及社区成员。敬请关注大会日期、讲者及议程等更多详情，我们将继续打造难忘的会议体验。"
                : "This premier open-source database event will return to the vibrant city of Jinan in 2027, bringing together PostgreSQL experts, developers, and community members from around the world. Stay tuned for more details on the dates, speakers, and program highlights as we continue to build another unforgettable conference experience."}
            </p>
            <Link href="/about" className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 mt-4">
              {locale === "zh" ? "了解更多" : "Learn more"} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="relative">
            <div className="aspect-square rounded-2xl bg-gradient-to-br from-emerald-900/40 to-cyan-900/40 border border-zinc-800 flex items-center justify-center">
              <div className="text-center p-8">
                <div className="text-8xl font-black bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent mb-4">
                  HOW
                </div>
                <div className="text-4xl font-bold text-white">2027</div>
                <div className="text-zinc-400 mt-2">{locale === "zh" ? "济南" : "Jinan"}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 border-t border-zinc-800">
        <h2 className="text-3xl font-bold text-center mb-12">{home.highlightsTitle[locale]}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {home.highlights[locale].map((h, i) => (
            <Card key={i} className="bg-zinc-900/50 border-zinc-800 hover:border-emerald-800/50 transition-colors">
              <CardContent className="p-6">
                <CheckCircle className="h-5 w-5 text-emerald-400 mb-4" />
                <p className="text-sm text-zinc-300">{h}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-emerald-900/30 to-cyan-900/30 border border-zinc-800 p-12 text-center">
          <div className="absolute top-10 left-10 w-40 h-40 bg-emerald-500 rounded-full blur-[80px] opacity-20" />
          <div className="absolute bottom-10 right-10 w-40 h-40 bg-cyan-500 rounded-full blur-[80px] opacity-20" />
          <h2 className="relative text-3xl font-bold mb-4">{home.ctaTitle[locale]}</h2>
          <p className="relative text-zinc-400 mb-8 max-w-md mx-auto">
            {locale === "zh"
              ? "山东济南 · 舜耕国际会议中心区"
              : "Jinan, Shandong — Shungeng International Convention Center"}
          </p>
          <Link href="/register">
            <Button size="lg" className="relative bg-emerald-600 hover:bg-emerald-500">
              {home.registerNow[locale]}
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
