import type { Metadata } from "next"
import type { Locale } from "../i18n/utils.ts"

const pages = {
  "/": {
    zh: ["HOW 2027 | PostgreSQL 生态大会", "了解 HOW 2027 PostgreSQL 生态大会，查看讲者、议程、征稿、报名和参会信息。"],
    en: ["HOW 2027 | PostgreSQL Ecosystem Conference", "Explore HOW 2027, a PostgreSQL ecosystem conference. Find speakers, the schedule, proposals, registration and attendee information."],
  },
  "/about": {
    zh: ["关于大会 | HOW 2027", "了解 HOW 2027 的大会介绍、开源社区和 PostgreSQL 生态交流。"],
    en: ["About | HOW 2027", "Learn about HOW 2027, its open-source community and PostgreSQL ecosystem connections."],
  },
  "/speakers": {
    zh: ["大会讲者 | HOW 2027", "查看 HOW 2027 已公布的讲者及其介绍，关注后续讲者更新。"],
    en: ["Speakers | HOW 2027", "Meet the announced HOW 2027 speakers and read their profiles. Follow upcoming speaker updates."],
  },
  "/schedule": {
    zh: ["大会议程 | HOW 2027", "查看 HOW 2027 已公布的演讲、时段和议程安排，关注后续议程更新。"],
    en: ["Schedule | HOW 2027", "Browse the published HOW 2027 talks, time slots and conference schedule, with further updates as they are announced."],
  },
  "/attend": {
    zh: ["参会指南 | HOW 2027", "查看 HOW 2027 参会指南、报名说明和已确认的参会安排。"],
    en: ["Attendee Guide | HOW 2027", "Read the HOW 2027 attendee guide, registration information and confirmed conference arrangements."],
  },
  "/sponsors": {
    zh: ["赞助商与合作 | HOW 2027", "了解 HOW 2027 赞助商和合作信息，联系大会洽谈赞助。"],
    en: ["Sponsors | HOW 2027", "Discover HOW 2027 sponsors and partnership information, and contact the conference about sponsorship."],
  },
  "/venue": {
    zh: ["会场信息 | HOW 2027", "查看 HOW 2027 会场信息及后续交通指引，以大会公布的信息为准。"],
    en: ["Venue | HOW 2027", "Find HOW 2027 venue information and upcoming travel guidance as details are announced by the conference."],
  },
  "/updates": {
    zh: ["大会动态 | HOW 2027", "关注 HOW 2027 最新公告、讲者更新、议程发布和参会通知。"],
    en: ["Updates | HOW 2027", "Follow HOW 2027 announcements, speaker news, schedule releases and attendee updates."],
  },
  "/code-of-conduct": {
    zh: ["行为准则 | HOW 2027", "阅读 HOW 2027 行为准则，了解大会对尊重、包容和社区参与的要求。"],
    en: ["Code of Conduct | HOW 2027", "Read the HOW 2027 code of conduct and the conference's expectations for respectful, inclusive community participation."],
  },
  "/privacy": {
    zh: ["隐私条款 | HOW 2027", "了解 HOW 2027 的个人信息使用、账号和报名相关隐私说明。"],
    en: ["Privacy | HOW 2027", "Read HOW 2027 privacy information about personal data, accounts and conference registration."],
  },
  "/register": {
    zh: ["大会报名 | HOW 2027", "查看 HOW 2027 当前票种与渠道码要求，登录后填写并确认报名信息。"],
    en: ["Registration | HOW 2027", "Review HOW 2027 ticket options and channel-code requirements. Sign in to complete and confirm your registration."],
  },
} as const

export type PublicPagePath = keyof typeof pages
export const publicPagePaths = Object.keys(pages) as PublicPagePath[]

export function siteOrigin(value = process.env.SITE_URL || "https://how-website.vercel.app"): string {
  const url = new URL(value)
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("SITE_URL must be an HTTPS origin without credentials, path, query or fragment")
  }
  return url.origin
}

export function indexingEnabled() {
  return process.env.VERCEL_ENV !== "preview" && process.env.NEXT_PUBLIC_CONTENT_MODE !== "mock"
}

export function buildPageMetadata(path: PublicPagePath, locale: Locale, options: { indexable?: boolean } = {}): Metadata {
  const origin = siteOrigin()
  const [title, description] = pages[path][locale]
  const canonical = `${origin}${path}`
  const image = `${origin}/opengraph-image`
  return {
    title,
    description,
    metadataBase: new URL(origin),
    alternates: { canonical },
    robots: { index: options.indexable ?? true, follow: true },
    openGraph: {
      type: "website", siteName: "HOW 2027", title, description, url: canonical,
      locale: locale === "zh" ? "zh_CN" : "en_US",
      images: [{ url: image, width: 1200, height: 630, alt: "HOW 2027 - PostgreSQL Ecosystem Conference" }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  }
}
