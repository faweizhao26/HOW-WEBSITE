"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { ExternalLink } from "lucide-react"
import { getSponsors } from "@/lib/mock-data"

type Sponsor = { id: string; name: string; logo_url: string; tier: string; website_url: string | null; sort_order: number }

function getLocaleFromCookie(): "en" | "zh" {
  if (typeof document === "undefined") return "en"
  const match = document.cookie.match(/(?:^|;\s*)lang=([^;]*)/)
  return match?.[1] === "zh" ? "zh" : "en"
}

export default function SponsorsPage() {
  const [locale] = useState<"en" | "zh">(getLocaleFromCookie())
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient()
        const { data } = await supabase.from("sponsors").select("*").order("sort_order")
        if (data && data.length > 0) { setSponsors(data); setMounted(true); return }
      } catch {}
      // Fallback to localStorage mock data
      setSponsors(getSponsors())
      setMounted(true)
    }
    load()
  }, [])

  const tiers = ["diamond", "gold", "silver", "bronze"] as const
  const tierLabels: Record<string, { en: string; zh: string }> = {
    diamond: { en: "Diamond", zh: "钻石" },
    gold: { en: "Gold", zh: "金牌" },
    silver: { en: "Silver", zh: "银牌" },
    bronze: { en: "Bronze", zh: "铜牌" },
  }
  const tierColors: Record<string, string> = {
    diamond: "via-cyan-500 to-cyan-600",
    gold: "via-amber-400 to-amber-600",
    silver: "via-zinc-300 to-zinc-500",
    bronze: "via-orange-600 to-orange-800",
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-4xl font-bold mb-4">
        {locale === "zh" ? "赞助商" : "Sponsors"}
      </h1>
      <p className="text-zinc-400 mb-12 max-w-xl">
        {locale === "zh"
          ? "感谢所有赞助商对 HOW 2027 的支持！"
          : "Thank you to all sponsors for supporting HOW 2027!"}
      </p>
      <div className="mb-12 rounded-lg border border-emerald-900/50 bg-emerald-950/20 p-5">
        <h2 className="text-lg font-semibold text-white mb-2">
          {locale === "zh" ? "赞助商招募中" : "Sponsor recruitment is open"}
        </h2>
        <p className="text-sm text-zinc-400 leading-relaxed">
          {locale === "zh"
            ? "如果你的团队希望支持 HOW 2027 或了解赞助方案，请联系 "
            : "If your team would like to support HOW 2027 or learn about sponsorship options, contact "}
          <a
            href="mailto:faweizhao26@gmail.com"
            className="font-medium text-emerald-400 hover:text-emerald-300"
          >
            faweizhao26@gmail.com
          </a>
          {locale === "zh" ? "。" : "."}
        </p>
      </div>

      {!mounted ? (
        <div className="text-center py-20 text-zinc-500">{locale === "zh" ? "加载中..." : "Loading..."}</div>
      ) : (
        tiers.map((tier) => {
          const tierSponsors = sponsors.filter((s) => s.tier === tier)
          if (tierSponsors.length === 0) return null
          const cols = tier === "diamond" ? "md:grid-cols-2" : tier === "gold" ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-3 lg:grid-cols-4"

          return (
            <div key={tier} className="mb-14">
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-xl font-semibold text-zinc-300">
                  {tierLabels[tier][locale]}
                </h2>
                <div className={`h-[1px] flex-1 bg-gradient-to-r ${tierColors[tier]} opacity-50`} />
              </div>
              <div className={`grid grid-cols-2 ${cols} gap-4`}>
                {tierSponsors.map((sponsor) => (
                  <Card key={sponsor.id} className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-600 transition-all hover:scale-[1.02] group">
                    <CardContent className="p-6 flex flex-col items-center text-center">
                      <div className="sponsor-logo-surface w-full h-24 rounded-lg mb-4 flex items-center justify-center overflow-hidden transition-colors">
                        {sponsor.logo_url ? (
                          <img
                            src={sponsor.logo_url}
                            alt={sponsor.name}
                            className="sponsor-logo-image max-w-full max-h-full object-contain p-3"
                          />
                        ) : (
                          <span className="text-zinc-800 font-bold text-lg tracking-tight">
                            {sponsor.name}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-medium text-white mb-1">{sponsor.name}</h3>
                      {sponsor.website_url && (
                        <a
                          href={sponsor.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 transition-colors"
                        >
                          Website <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
