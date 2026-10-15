import Link from "next/link"
import Image from "next/image"
import { home, schedule as sched } from "@/lib/i18n/translations"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight, Calendar, MapPin, Users, Mic, ExternalLink } from "lucide-react"
import { Countdown } from "@/components/countdown"
import { HeroMotion } from "@/components/home/hero-motion"
import { conference, formatConferenceDateRange, getConferenceStartDate } from "@/lib/conference"
import { contentText } from "@/lib/content/site-content"
import type { SiteContent } from "@/lib/content/site-content"
import type { PublishedSession, PublishedSponsor, PublicContentResult } from "@/lib/content/types"
import { ContentBlocks, ContentPage, ContentContact, ContentLink } from "@/components/content/content-blocks"

export type SiteViewProps = { settings: Record<string, string>; content: SiteContent; locale: "en" | "zh" }

export function HomeView({ settings, content, locale, sessions, contentState = "ready" }: SiteViewProps & {
  sessions: PublicContentResult<Pick<PublishedSession, "id">[]>
  contentState?: "ready" | "empty"
}) {
  const heroTitle = settings.hero_title
  const heroTitleZh = settings.hero_title_zh
  const heroSub = settings.hero_subtitle
  const heroSubZh = settings.hero_subtitle_zh
  const date = formatConferenceDateRange(settings.conference_date, locale)
  const location = settings.conference_location
  const locationZh = settings.conference_location_zh
  const venueLine = content.venue.confirmed ? contentText(content.venue.name, locale) : conference.venue[locale]
  const pending = locale === "zh" ? "待公布" : "TBA"
  const sessionCount = sessions.status === "ready" ? String(sessions.data.length)
    : sessions.status === "empty" ? pending : locale === "zh" ? "暂不可用" : "Unavailable"

  const stats = [
    { icon: Mic, label: locale === "zh" ? "已公布演讲" : "Published Sessions", value: sessionCount },
    { icon: Users, label: locale === "zh" ? "参会规模" : "Attendance", value: pending },
    { icon: MapPin, label: locale === "zh" ? "地点" : "Location", value: locale === "zh" ? locationZh : location },
    { icon: Calendar, label: locale === "zh" ? "天数" : "Days", value: String(conference.dayCount) },
  ]

  return (
    <div data-content-state={contentState}>
      <section className="relative isolate min-h-[calc(100svh-4rem)] overflow-hidden bg-slate-50 text-zinc-950 dark:bg-zinc-950 dark:text-white">
        <HeroMotion />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgb(248_250_252_/_0.88)_0%,rgb(248_250_252_/_0.6)_42%,rgb(248_250_252_/_0.12)_100%)] dark:bg-[linear-gradient(90deg,rgb(2_6_23_/_0.74)_0%,rgb(2_6_23_/_0.38)_42%,rgb(2_6_23_/_0.06)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-300 to-transparent dark:via-emerald-800/70" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 lg:py-40">
          <div className="max-w-3xl">
            <Badge className="mb-6 bg-white/80 text-emerald-700 border-emerald-200 shadow-sm backdrop-blur hover:bg-white/90 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-950/50">
              {settings.conference_name}
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 text-zinc-950 dark:text-white">
              {locale === "zh" ? heroTitleZh : heroTitle}
              <br />
              <span className="block bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent text-3xl sm:text-4xl lg:text-6xl">
                {locale === "zh" ? heroSubZh : heroSub}
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-zinc-700 dark:text-zinc-300 mb-8 max-w-xl">
              {date}
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/register">
                <Button size="lg" className="bg-emerald-700 hover:bg-emerald-800 text-white gap-2">
                  {home.registerNow[locale]} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/schedule">
                <Button size="lg" variant="outline" className="border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-transparent dark:text-zinc-300 dark:hover:bg-zinc-800/50">
                  {sched.title[locale]}
                </Button>
              </Link>
            </div>

            <Countdown target={getConferenceStartDate(settings.conference_date)} locale={locale} />
          </div>
        </div>
      </section>

      <section className="relative -mt-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="bg-white dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
              <CardContent className="p-6 text-center">
                <stat.icon className="h-6 w-6 text-emerald-400 mx-auto mb-3" />
                <div className={`${stat.value === "Unavailable" ? "text-base" : "text-2xl"} font-bold text-zinc-950 dark:text-white`}>{stat.value}</div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8"><ContentBlocks blocks={content.home.sections.map(block => block.id === "cta" ? { ...block, body: { en: [block.body.en, venueLine].filter(Boolean).join("\n"), zh: [block.body.zh, venueLine].filter(Boolean).join("\n") } } : block)} locale={locale} /></div>
    </div>
  )
}

export function SitePageView({ page, settings, content, locale }: SiteViewProps & { page: keyof SiteContent["pages"] }) {
  const entry = content.pages[page]
  const contactBlock = page === "attend" ? "volunteers" : page === "conduct" ? "report" : page === "privacy" ? "contact" : null
  const email = page === "attend" ? content.contacts.sponsor || settings.contact_email
    : page === "conduct" ? content.contacts.report || settings.contact_email : settings.contact_email
  const showContact = contactBlock && entry.sections.some(block => block.id === contactBlock && block.enabled)
  return (
    <ContentPage page={entry} locale={locale}>
      {showContact && <ContentContact email={email} locale={locale} sponsor={page === "attend"} />}
    </ContentPage>
  )
}

export function VenueView({ content, locale }: SiteViewProps) {
  const title = locale === "zh" ? "会场信息" : "Venue"
  const venue = content.venue
  const name = venue.confirmed
    ? contentText(venue.name, locale) || (locale === "zh" ? "会场待公布" : "Venue to be announced")
    : locale === "zh" ? "会场待公布" : "Venue to be announced"
  const address = venue.confirmed
    ? contentText(venue.address, locale)
    : locale === "zh" ? "具体地址将在会场确认后公布。" : "The address will be published once the venue is confirmed."
  const directions = venue.confirmed ? contentText(venue.directions, locale) : ""

  return (
    <div data-content-state="ready" className="mx-auto max-w-4xl px-4 py-16 [overflow-wrap:anywhere] sm:px-6 lg:px-8">
      <h1 className="mb-8 text-4xl font-bold text-zinc-950 dark:text-white">{title}</h1>
      <section className="space-y-6 border-y border-zinc-200 py-8 dark:border-zinc-800">
        <div className="flex items-start gap-4">
          <MapPin className="mt-1 size-6 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
          <div className="min-w-0 space-y-3">
            <h2 className="whitespace-pre-line text-xl font-semibold text-zinc-950 dark:text-white">{name}</h2>
            {address && <p className="whitespace-pre-line leading-relaxed text-zinc-600 dark:text-zinc-400">{address}</p>}
            {directions && <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{directions}</p>}
          </div>
        </div>
        {venue.confirmed && venue.imageUrl && (
          <div className="relative aspect-video w-full">
            <Image src={venue.imageUrl} alt={contentText(venue.imageAlt, locale) || name} fill unoptimized sizes="(max-width: 768px) 100vw, 896px" className="object-contain" />
          </div>
        )}
        {venue.confirmed && venue.mapUrl && (
          <ContentLink href={venue.mapUrl}>{locale === "zh" ? "查看地图" : "View map"}</ContentLink>
        )}
        {!venue.confirmed && <p className="text-sm text-zinc-600 dark:text-zinc-400">{locale === "zh" ? "地图将在会场确认后公布" : "The map will be published once the venue is confirmed"}</p>}
      </section>
    </div>
  )
}

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

export function SponsorsView({ sponsors: result, content, settings, locale, siteError = false }: SiteViewProps & {
  sponsors: PublicContentResult<PublishedSponsor[]>
  siteError?: boolean
}) {
  const site = { status: siteError ? "error" : "ready", content, settings }
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

      {site.status === "error" ? (
        <div data-content-state="error" className="mb-12 border-y border-zinc-200 py-5 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          {locale === "zh" ? "赞助招募信息暂时无法加载，请稍后再试。" : "Sponsor recruitment information is temporarily unavailable. Please try again later."}
        </div>
      ) : site.content.sponsorRecruitment.enabled && (
        <section data-content-state="ready" className="mb-12 space-y-4 border-y border-emerald-200 bg-emerald-50/70 px-1 py-5 dark:border-emerald-900/60 dark:bg-emerald-950/20 sm:px-5">
          <ContentBlocks blocks={[site.content.sponsorRecruitment]} locale={locale} />
          <ContentContact email={site.content.contacts.sponsor || site.settings.contact_email} locale={locale} sponsor />
        </section>
      )}

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
