import Link from "next/link"
import { cookies } from "next/headers"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getLocale } from "@/lib/i18n/utils"
import { CalendarDays, Coffee, HandHeart, Hotel, MapPinned, Users } from "lucide-react"

const sections = [
  {
    icon: MapPinned,
    title: { en: "On-site Guide", zh: "现场参会指南" },
    body: {
      en: "Venue map, check-in desk, room layout, Wi-Fi, badge pickup, help desk, and accessibility notes will be published here as they are confirmed.",
      zh: "会场地图、签到处、房间分布、Wi-Fi、胸卡领取、服务台和无障碍信息将在确认后陆续更新。",
    },
    items: {
      en: ["Check-in and badge pickup", "Room and floor plans", "Wi-Fi and help desk"],
      zh: ["签到与胸卡领取", "会场楼层与房间图", "Wi-Fi 与服务台"],
    },
  },
  {
    icon: Hotel,
    title: { en: "Travel and Stay", zh: "交通与住宿" },
    body: {
      en: "We will collect airport, rail, hotel, local transit, taxi, and payment tips for attendees traveling to Jinan.",
      zh: "我们会整理到达济南的机场、高铁、酒店、本地交通、打车和支付提示，方便外地参会者提前规划。",
    },
    items: {
      en: ["Airport and railway routes", "Recommended hotels", "Local transit tips"],
      zh: ["机场与高铁路线", "推荐酒店", "本地交通提示"],
    },
  },
  {
    icon: Coffee,
    title: { en: "Community Socials", zh: "社区活动" },
    body: {
      en: "Expect lightweight community moments such as newcomer breakfast, hallway track meetups, city walks, and small-group dinners.",
      zh: "我们计划放上一些轻量社区活动，例如新人早餐、走廊交流、城市漫步和小组晚餐。",
    },
    items: {
      en: ["Newcomer welcome", "Meet & Eat groups", "City walk or morning run"],
      zh: ["新人欢迎活动", "Meet & Eat 小组", "城市漫步或晨跑"],
    },
  },
  {
    icon: HandHeart,
    title: { en: "Volunteer and Sponsor Notes", zh: "志愿者与赞助说明" },
    body: {
      en: "Volunteer roles, sponsor logistics, booth setup, job board, and community office-hour details will live here before the conference.",
      zh: "志愿者岗位、赞助商物料、展位搭建、招聘信息和社区 Office Hour 说明会在会前集中放在这里。",
    },
    items: {
      en: ["Volunteer roles", "Sponsor logistics", "Community office hours"],
      zh: ["志愿者岗位", "赞助商会务信息", "社区 Office Hour"],
    },
  },
]

const timeline = [
  {
    icon: CalendarDays,
    label: { en: "Before the event", zh: "会前" },
    text: {
      en: "Travel, hotel, social activity, and check-in details will be updated as soon as each item is confirmed.",
      zh: "交通、酒店、社交活动和签到信息会在确认后第一时间更新。",
    },
  },
  {
    icon: Users,
    label: { en: "During the event", zh: "会中" },
    text: {
      en: "This page will become the quick reference for rooms, help desk, announcements, and community gatherings.",
      zh: "大会期间，这里会成为房间、服务台、通知和社区聚会的快速参考页。",
    },
  },
]

export default async function AttendPage() {
  const cookieStore = await cookies()
  const locale = getLocale(cookieStore.get("lang")?.value)

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="max-w-3xl mb-12">
        <Badge className="mb-5 bg-emerald-950/50 text-emerald-300 border-emerald-800">
          {locale === "zh" ? "持续更新" : "Living Guide"}
        </Badge>
        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-5">
          {locale === "zh" ? "参会指南" : "Attend HOW 2027"}
        </h1>
        <p className="text-lg text-zinc-400 leading-relaxed">
          {locale === "zh"
            ? "这里先放上参会者最关心的信息框架。具体时间、地点、路线和活动细节会随着大会筹备推进逐步补齐。"
            : "This page is the attendee information hub. Times, locations, routes, and activity details will be filled in as conference planning progresses."}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-5 mb-12">
        {sections.map((section) => (
          <Card key={section.title.en} className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-6">
              <section.icon className="h-6 w-6 text-emerald-400 mb-4" />
              <h2 className="text-xl font-semibold text-white mb-3">{section.title[locale]}</h2>
              <p className="text-sm text-zinc-400 leading-relaxed mb-5">{section.body[locale]}</p>
              <ul className="space-y-2">
                {section.items[locale].map((item) => (
                  <li key={item} className="text-sm text-zinc-300 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-5 mb-12">
        {timeline.map((item) => (
          <div key={item.label.en} className="border border-zinc-800 rounded-lg p-5 bg-zinc-950/40">
            <item.icon className="h-5 w-5 text-cyan-400 mb-3" />
            <h3 className="text-white font-medium mb-2">{item.label[locale]}</h3>
            <p className="text-sm text-zinc-500 leading-relaxed">{item.text[locale]}</p>
          </div>
        ))}
      </div>

      <div className="border border-emerald-900/50 bg-emerald-950/20 rounded-lg p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">
            {locale === "zh" ? "已经决定参会？" : "Ready to join us?"}
          </h2>
          <p className="text-sm text-zinc-400">
            {locale === "zh" ? "先完成报名，后续参会信息会继续在这里更新。" : "Register first, then check back here as attendee details are confirmed."}
          </p>
        </div>
        <Link href="/register">
          <Button className="bg-emerald-600 hover:bg-emerald-500">
            {locale === "zh" ? "立即报名" : "Register"}
          </Button>
        </Link>
      </div>
    </div>
  )
}
