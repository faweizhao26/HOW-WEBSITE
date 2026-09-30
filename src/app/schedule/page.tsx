import { cookies } from "next/headers"
import Image from "next/image"
import { ChevronDown, Clock, Coffee, MapPin, User } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { conference } from "@/lib/conference"
import { getPublishedAgenda } from "@/lib/content/public"
import type { AgendaReleaseSlot } from "@/lib/db/schema"
import { schedule as sched } from "@/lib/i18n/translations"
import { getLocale, type Locale } from "@/lib/i18n/utils"

const roomAccents: Record<string, string> = {
  "Room A": "border-l-emerald-500",
  "Room B": "border-l-cyan-500",
  "Room C": "border-l-violet-500",
  "Room D": "border-l-amber-500",
  "Main Hall": "border-l-rose-500",
}

function ScheduleSlot({ slot, locale }: { slot: AgendaReleaseSlot; locale: Locale }) {
  const session = slot.session
  const speaker = session?.speaker
  const title = locale === "zh" ? session?.title_zh || session?.title || slot.label_zh || slot.label : session?.title || slot.label
  const name = speaker && (locale === "zh" ? speaker.name_zh || speaker.name : speaker.name)
  const company = speaker && (locale === "zh" ? speaker.company_zh || speaker.company : speaker.company)
  const accent = Object.entries(roomAccents).find(([room]) => slot.room?.includes(room))?.[1] || "border-l-zinc-400"

  if (slot.type === "break") {
    return (
      <div className="flex flex-wrap items-center justify-center gap-2 border-y py-3 text-sm text-muted-foreground">
        <Coffee className="size-4" />
        <span>{title}</span>
        <span className="font-mono text-xs">{slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}</span>
      </div>
    )
  }

  const heading = (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-xs">{sched[slot.type as keyof typeof sched]?.[locale] || slot.type}</Badge>
        <span className="font-mono text-xs text-muted-foreground">{slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}</span>
      </div>
      <h3 className="text-sm font-semibold leading-relaxed">{title}</h3>
      {speaker && <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground"><User className="mt-0.5 size-3 shrink-0" /><span>{name}{company && ` · ${company}`}</span></p>}
      {slot.room && <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="size-3 shrink-0" />{slot.room}</p>}
    </>
  )

  if (!session || !speaker) return <div className={`rounded-lg border border-l-2 bg-card p-4 ${accent}`}>{heading}</div>

  return (
    <details className={`group rounded-lg border border-l-2 bg-card ${accent}`}>
      <summary className="flex cursor-pointer list-none items-start gap-3 p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">{heading}</div>
        <ChevronDown className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-4 border-t px-4 py-4">
        <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{locale === "zh" ? session.abstract_zh || session.abstract : session.abstract}</p>
        <div className="flex gap-3">
          {speaker.avatar_url && <div className="relative size-12 shrink-0 overflow-hidden rounded-full"><Image src={speaker.avatar_url} alt={name || speaker.name} fill unoptimized className="object-cover" /></div>}
          <div className="min-w-0">
            <p className="text-sm font-medium">{name}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{locale === "zh" ? speaker.bio_zh || speaker.bio : speaker.bio}</p>
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="size-3" />{session.duration} min</p>
        {(session.slides_url || session.video_url) && <div className="flex flex-wrap gap-4 text-sm text-emerald-700 dark:text-emerald-400">
          {session.slides_url && <a href={session.slides_url} target="_blank" rel="noopener noreferrer">{locale === "zh" ? "演讲资料" : "Slides"}</a>}
          {session.video_url && <a href={session.video_url} target="_blank" rel="noopener noreferrer">{locale === "zh" ? "演讲视频" : "Recording"}</a>}
        </div>}
      </div>
    </details>
  )
}

function ProgramPeriod({ slots, locale, title }: { slots: AgendaReleaseSlot[]; locale: Locale; title: string }) {
  if (slots.length === 0) return null
  const rooms = [...new Set(slots.filter((slot) => slot.type !== "break" && slot.room).map((slot) => slot.room as string))].sort()
  if (rooms.length < 2) {
    return <section className="mx-auto max-w-3xl space-y-3"><h2 className="mb-5 text-center text-lg font-semibold">{title}</h2>{slots.map((slot) => <ScheduleSlot key={slot.id} slot={slot} locale={locale} />)}</section>
  }

  const times = [...new Set(slots.map((slot) => slot.start_time))].sort()
  return (
    <section>
      <h2 className="mb-5 text-center text-lg font-semibold">{title}</h2>
      <div className="max-w-full overflow-x-auto overscroll-x-contain pb-2">
        <div className="min-w-[720px] space-y-4 md:min-w-0">
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${rooms.length}, minmax(0, 1fr))` }}>
            {rooms.map((room) => <h3 key={room} className="border-b pb-3 text-center text-sm font-semibold">{room}</h3>)}
          </div>
          {times.map((time) => {
            const timeSlots = slots.filter((slot) => slot.start_time === time)
            const shared = timeSlots.filter((slot) => slot.type === "break" || !slot.room)
            return <div key={time} className="space-y-3">
              <p className="font-mono text-xs text-muted-foreground">{time.slice(0, 5)}</p>
              {timeSlots.some((slot) => slot.type !== "break" && slot.room) && <div className="grid items-start gap-3" style={{ gridTemplateColumns: `repeat(${rooms.length}, minmax(0, 1fr))` }}>
                {rooms.map((room) => <div key={room} className="space-y-3">{timeSlots.filter((slot) => slot.room === room && slot.type !== "break").map((slot) => <ScheduleSlot key={slot.id} slot={slot} locale={locale} />)}</div>)}
              </div>}
              {shared.filter((slot, index, all) => all.findIndex((other) => other.label === slot.label && other.end_time === slot.end_time) === index).map((slot) => <ScheduleSlot key={slot.id} slot={slot} locale={locale} />)}
            </div>
          })}
        </div>
      </div>
    </section>
  )
}

export default async function SchedulePage() {
  const cookieStore = await cookies()
  const locale = getLocale(cookieStore.get("lang")?.value)
  const result = await getPublishedAgenda()
  const days = [...conference.days]

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-4xl font-bold">{sched.title[locale]}</h1>
      {result.status === "error" && <div className="border-y py-12 text-muted-foreground">{locale === "zh" ? "议程暂时无法加载，请稍后再试。" : "The program is temporarily unavailable. Please try again later."}</div>}
      {result.status === "empty" && <div className="border-y py-12 text-muted-foreground">{locale === "zh" ? "正式议程将在确认后公布。会议时间为 2027 年 4 月 16 日至 18 日。" : "The program will be announced once confirmed. The conference runs April 16-18, 2027."}</div>}
      {result.status === "ready" && <Tabs defaultValue={days[0]} className="w-full">
        <TabsList className="mb-8 grid w-full grid-cols-1 gap-1 p-1 group-data-horizontal/tabs:h-auto sm:grid-cols-3">
          {days.map((day, index) => <TabsTrigger key={day} value={day} className="h-auto w-full px-2 py-2 sm:px-5">{locale === "zh" ? `第 ${index + 1} 天` : `Day ${index + 1}`}<span className="ml-2 text-xs font-normal">{day}</span></TabsTrigger>)}
        </TabsList>
        {days.map((day) => {
          const slots = result.data.filter((slot) => slot.date === day).sort((a, b) => a.start_time.localeCompare(b.start_time) || a.sort_order - b.sort_order)
          return <TabsContent key={day} value={day} className="space-y-10">
            {slots.length === 0 && <p className="border-y py-12 text-muted-foreground">{locale === "zh" ? "当天议程待公布。" : "This day's program will be announced."}</p>}
            <ProgramPeriod slots={slots.filter((slot) => slot.start_time < "12:30")} locale={locale} title={locale === "zh" ? "上午" : "Morning"} />
            <ProgramPeriod slots={slots.filter((slot) => slot.start_time >= "12:30")} locale={locale} title={locale === "zh" ? "下午" : "Afternoon"} />
          </TabsContent>
        })}
      </Tabs>}
    </div>
  )
}
