import { cookies } from "next/headers"
import Image from "next/image"
import { ExternalLink } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { getPublishedSponsors } from "@/lib/content/public"
import { getLocale } from "@/lib/i18n/utils"

const tiers = ["diamond", "gold", "silver", "bronze"] as const

const tierLabels = {
  diamond: { en: "Diamond", zh: "钻石" },
  gold: { en: "Gold", zh: "金牌" },
  silver: { en: "Silver", zh: "银牌" },
  bronze: { en: "Bronze", zh: "铜牌" },
}

const tierAccents = {
  diamond: "bg-cyan-500",
  gold: "bg-amber-500",
  silver: "bg-zinc-400",
  bronze: "bg-orange-700",
}

export default async function SponsorsPage() {
  const cookieStore = await cookies()
  const locale = getLocale(cookieStore.get("lang")?.value)
  const result = await getPublishedSponsors()
  const sponsors = result.status === "ready" ? result.data : []

  return (
    <div data-content-state={result.status} className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="mb-4 text-4xl font-bold text-zinc-950 dark:text-white">
        {locale === "zh" ? "赞助商" : "Sponsors"}
      </h1>
      <p className="mb-10 max-w-xl text-zinc-600 dark:text-zinc-400">
        {locale === "zh"
          ? "感谢所有赞助商对 HOW 2027 的支持！"
          : "Thank you to all sponsors for supporting HOW 2027!"}
      </p>

      <div className="mb-12 border-y border-emerald-200 bg-emerald-50/70 px-1 py-5 dark:border-emerald-900/60 dark:bg-emerald-950/20 sm:px-5">
        <h2 className="mb-2 text-lg font-semibold text-zinc-950 dark:text-white">
          {locale === "zh" ? "赞助商招募中" : "Sponsor recruitment is open"}
        </h2>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          {locale === "zh"
            ? "如果你的团队希望支持 HOW 2027 或了解赞助方案，请联系 "
            : "If your team would like to support HOW 2027 or learn about sponsorship options, contact "}
          <a href="mailto:faweizhao26@gmail.com" className="font-medium text-emerald-700 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300">
            faweizhao26@gmail.com
          </a>
          {locale === "zh" ? "。" : "."}
        </p>
      </div>

      {result.status === "error" && (
        <div className="border-y border-zinc-200 py-12 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          {locale === "zh" ? "赞助商信息暂时无法加载，请稍后再试。" : "Sponsor information is temporarily unavailable. Please try again later."}
        </div>
      )}

      {result.status === "empty" && (
        <div className="border-y border-zinc-200 py-12 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          {locale === "zh" ? "首批赞助商将在确认后公布。" : "The first sponsors will be announced once confirmed."}
        </div>
      )}

      {result.status === "ready" && tiers.map((tier) => {
        const tierSponsors = sponsors.filter((sponsor) => sponsor.tier === tier)
        if (tierSponsors.length === 0) return null
        const columns = tier === "diamond" ? "md:grid-cols-2" : tier === "gold" ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-3 lg:grid-cols-4"

        return (
          <section key={tier} className="mb-14">
            <div className="mb-6 flex items-center gap-3">
              <span className={`size-2.5 ${tierAccents[tier]}`} aria-hidden="true" />
              <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">{tierLabels[tier][locale]}</h2>
              <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            </div>
            <div className={`grid grid-cols-2 gap-4 ${columns}`}>
              {tierSponsors.map((sponsor) => (
                <Card key={sponsor.id} className="group border-zinc-200 bg-white/80 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-zinc-600">
                  <CardContent className="flex flex-col items-center p-4 text-center sm:p-6">
                    <div className="sponsor-logo-surface relative mb-4 flex h-24 w-full items-center justify-center overflow-hidden rounded-lg">
                      {sponsor.logo_url ? (
                        <Image src={sponsor.logo_url} alt={sponsor.name} fill unoptimized className="sponsor-logo-image object-contain p-3" />
                      ) : (
                        <span className="text-sm font-bold text-zinc-800 sm:text-lg">{sponsor.name}</span>
                      )}
                    </div>
                    <h3 className="mb-1 text-sm font-medium text-zinc-950 dark:text-white">{sponsor.name}</h3>
                    {sponsor.website_url && (
                      <a href={sponsor.website_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-emerald-700 transition-colors hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300">
                        {locale === "zh" ? "访问网站" : "Website"} <ExternalLink className="size-3" />
                      </a>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
