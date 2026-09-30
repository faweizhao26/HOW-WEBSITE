import { cookies } from "next/headers"
import { AlertCircle, Mic2, UserRound } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { getPublishedSpeakers } from "@/lib/content/public"
import { getLocale } from "@/lib/i18n/utils"

export default async function SpeakersPage() {
  const cookieStore = await cookies()
  const locale = getLocale(cookieStore.get("lang")?.value)
  const result = await getPublishedSpeakers()

  return (
    <div data-content-state={result.status} className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
      <div className="mb-10 max-w-2xl">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400"><Mic2 className="size-4" />HOW 2027</div>
        <h1 className="text-3xl font-bold sm:text-4xl">{locale === "zh" ? "大会讲者" : "Conference Speakers"}</h1>
        <p className="mt-3 text-muted-foreground">{locale === "zh" ? "正式发布的讲者资料会在这里持续更新。" : "Published speaker profiles will appear here as the program takes shape."}</p>
      </div>

      {result.status === "error" && (
        <div className="flex gap-3 border-y border-red-300 py-8 text-red-700 dark:border-red-900 dark:text-red-300">
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <div><h2 className="font-semibold">{locale === "zh" ? "讲者信息暂时无法加载" : "Speakers are temporarily unavailable"}</h2><p className="mt-1 text-sm opacity-80">{locale === "zh" ? "请稍后刷新页面。" : "Please refresh this page in a moment."}</p></div>
        </div>
      )}

      {result.status === "empty" && (
        <div className="border-y py-14 text-center text-muted-foreground">
          <UserRound className="mx-auto mb-3 size-9" />
          <h2 className="font-medium text-foreground">{locale === "zh" ? "讲者阵容正在确认" : "Speaker lineup in progress"}</h2>
          <p className="mt-1 text-sm">{locale === "zh" ? "确认并发布后会第一时间更新。" : "Profiles will be added as soon as they are confirmed and published."}</p>
        </div>
      )}

      {result.status === "ready" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.data.map((speaker) => {
            const name = locale === "zh" && speaker.name_zh ? speaker.name_zh : speaker.name
            const title = locale === "zh" ? speaker.title_zh || speaker.title : speaker.title
            const company = locale === "zh" ? speaker.company_zh || speaker.company : speaker.company
            const bio = locale === "zh" ? speaker.bio_zh || speaker.bio : speaker.bio
            return (
              <Card key={speaker.id} className="rounded-lg">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <Avatar className="size-16" size="lg">
                      {speaker.avatar_url && <AvatarImage src={speaker.avatar_url} alt={name} />}
                      <AvatarFallback className="text-lg">{name.slice(0, 1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 pt-1">
                      <h2 className="text-lg font-semibold">{name}</h2>
                      {(title || company) && <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">{[title, company].filter(Boolean).join(" · ")}</p>}
                    </div>
                  </div>
                  {bio && <p className="mt-5 line-clamp-5 text-sm leading-6 text-muted-foreground">{bio}</p>}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
