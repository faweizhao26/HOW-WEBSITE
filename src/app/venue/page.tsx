import { cookies } from "next/headers"
import { getLocale } from "@/lib/i18n/utils"
import { Card, CardContent } from "@/components/ui/card"
import { MapPin } from "lucide-react"
import { conference } from "@/lib/conference"

export default async function VenuePage() {
  const cookieStore = await cookies()
  const locale = getLocale(cookieStore.get("lang")?.value)

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-4xl font-bold mb-8">
        {locale === "zh" ? "会场信息" : "Venue"}
      </h1>
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="p-8">
          <div className="flex items-start gap-4">
            <MapPin className="h-6 w-6 text-emerald-400 mt-1 shrink-0" />
            <div>
              <h2 className="text-xl font-semibold text-white">
                {conference.venue[locale]}
              </h2>
              <p className="text-zinc-400 mt-2">
                {conference.address[locale]}
              </p>
              <p className="text-zinc-500 mt-2 text-sm">
                {locale === "zh"
                  ? "舜耕国际会议中心区，近舜耕路"
                  : "Shungeng International Convention Center area, near Shungeng Road"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-10 aspect-video rounded-xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-center">
        <div className="text-center text-zinc-500">
          <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{locale === "zh" ? "地图将在会议临近时公布" : "Map will be available closer to the event"}</p>
        </div>
      </div>
    </div>
  )
}
