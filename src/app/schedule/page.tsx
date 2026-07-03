import { cookies } from "next/headers"
import { getLocale } from "@/lib/i18n/utils"
import { schedule as sched } from "@/lib/i18n/translations"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Clock, MapPin, User, Coffee, X } from "lucide-react"
import { mockSlots, mockProducers } from "@/lib/mock-data"

type Profile = { full_name: string; company: string | null; bio: string; bio_zh: string; photo_url: string }
type SessionDetail = { id: string; title: string; title_zh: string | null; abstract: string; abstract_zh: string; duration: number; type: string; profiles: Profile }
type Slot = {
  id: string; date: string; start_time: string; end_time: string; label: string; label_zh: string | null
  type: string; room: string | null; sort_order: number; session_id: string | null
  sessions: SessionDetail | null
}

function getTypeColor(type: string): "default" | "secondary" | "destructive" | "outline" {
  switch (type) {
    case "keynote": return "default"
    case "session": return "secondary"
    case "break": return "outline"
    case "workshop": return "destructive"
    default: return "outline"
  }
}

const roomColors: Record<string, string> = {
  "Room A": "border-l-emerald-400 bg-emerald-400",
  "Room B": "border-l-cyan-400 bg-cyan-400", 
  "Room C": "border-l-purple-400 bg-purple-400",
  "Room D": "border-l-amber-400 bg-amber-400",
  "Main Hall": "border-l-rose-400 bg-rose-400",
}

function getRoomColorKey(room: string): string {
  for (const [key] of Object.entries(roomColors)) {
    if (room.includes(key)) return key
  }
  return room
}

function HoverSessionPopover({ session, locale }: { session: SessionDetail; locale: "en" | "zh" }) {
  return (
    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 hidden group-hover:block pb-2">
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
        <div className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <img
              src={session.profiles.photo_url}
              alt={session.profiles.full_name}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-500/50 shrink-0"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">{session.profiles.full_name}</p>
              {session.profiles.company && (
                <p className="text-xs text-emerald-400">{session.profiles.company}</p>
              )}
            </div>
          </div>
          <h4 className="text-sm font-semibold text-white mb-2 leading-snug">
            {locale === "zh" && session.title_zh ? session.title_zh : session.title}
          </h4>
          <p className="text-xs text-zinc-400 leading-relaxed mb-3 line-clamp-4">
            {locale === "zh" && session.abstract_zh ? session.abstract_zh : session.abstract}
          </p>
          <div className="border-t border-zinc-700 pt-3">
            <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-3">
              {locale === "zh" && session.profiles.bio_zh ? session.profiles.bio_zh : session.profiles.bio}
            </p>
          </div>
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-4 h-4 rotate-45 bg-zinc-800 border-r border-b border-zinc-700" />
      </div>
    </div>
  )
}

function ProducerPopover({ producer, locale }: { producer: typeof mockProducers[string]; locale: "en" | "zh" }) {
  return (
    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1 w-72 hidden group-hover:block pb-2">
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
        <div className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <img
              src={producer.photo_url}
              alt={producer.name}
              className="w-12 h-12 rounded-full object-cover ring-2 ring-amber-500/50 shrink-0"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">{locale === "zh" ? producer.name_zh : producer.name}</p>
              <p className="text-xs text-amber-400">{locale === "zh" ? producer.title_zh : producer.title}</p>
            </div>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed line-clamp-4">
            {locale === "zh" ? producer.bio_zh : producer.bio}
          </p>
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-4 h-4 rotate-45 bg-zinc-800 border-r border-b border-zinc-700" />
      </div>
    </div>
  )
}

function SessionCell({ slot, locale }: { slot: Slot; locale: "en" | "zh" }) {
  if (slot.type === "break") {
    return (
      <div className="col-span-full p-3 rounded-lg border border-zinc-700/30 bg-zinc-900/30 text-center">
        <div className="flex items-center justify-center gap-2 text-sm text-zinc-400">
          <Coffee className="h-4 w-4 text-zinc-500" />
          <span>{locale === "zh" && slot.label_zh ? slot.label_zh : slot.label}</span>
          <span className="text-xs text-zinc-600">({slot.start_time} - {slot.end_time})</span>
        </div>
      </div>
    )
  }

  const hasContent = !!slot.sessions
  const roomKey = slot.room ? getRoomColorKey(slot.room) : ""
  const color = roomColors[roomKey]

  return (
    <div className={`group relative ${hasContent ? "cursor-pointer" : ""}`}>
      <div
        className={`p-3 rounded-lg border min-h-[90px] transition-colors ${
          hasContent
            ? "border-emerald-800/50 bg-emerald-950/20 hover:bg-emerald-950/40 hover:border-emerald-700/50"
            : "border-zinc-700/30 bg-zinc-900/10 border-dashed"
        } ${color ? `border-l-2 ${color.replace("bg-", "border-l-")}` : ""}`}
      >
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          <Badge variant={getTypeColor(slot.type)} className="shrink-0 text-[10px] px-1.5 py-0 h-4 capitalize">
            {sched[slot.type as keyof typeof sched]?.[locale] || slot.type}
          </Badge>
          {slot.type !== "opening" && slot.type !== "closing" && (
            <span className="text-[10px] text-zinc-500">{slot.start_time}-{slot.end_time}</span>
          )}
        </div>
        {hasContent ? (
          <>
            <h4 className="text-sm font-medium text-white leading-snug mb-1.5 line-clamp-2">
              {locale === "zh" && slot.sessions!.title_zh ? slot.sessions!.title_zh : slot.sessions!.title}
            </h4>
            <div className="flex items-center gap-1 text-xs text-zinc-500">
              <User className="h-3 w-3 shrink-0" />
              <span className="truncate">{slot.sessions!.profiles.full_name}</span>
            </div>
          </>
        ) : slot.label ? (
          <p className="text-sm text-zinc-300">{locale === "zh" && slot.label_zh ? slot.label_zh : slot.label}</p>
        ) : (
          <p className="text-xs text-zinc-600 italic mt-2">{locale === "zh" ? "待定" : "TBD"}</p>
        )}
      </div>
      {hasContent && <HoverSessionPopover session={slot.sessions!} locale={locale} />}
    </div>
  )
}

function TimelineCard({ slot, locale }: { slot: Slot; locale: "en" | "zh" }) {
  if (slot.type === "break") {
    return (
      <div className="flex items-center justify-center gap-3 py-3 text-sm text-zinc-500">
        <Coffee className="h-4 w-4" />
        <span>{locale === "zh" && slot.label_zh ? slot.label_zh : slot.label}</span>
        <span className="text-xs text-zinc-600">({slot.start_time} - {slot.end_time})</span>
      </div>
    )
  }

  const hasContent = !!slot.sessions

  return (
    <div className="group relative">
      <Card className={`bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors ${!hasContent && slot.type === "session" ? "border-dashed opacity-60" : ""}`}>
        <CardContent className="p-4 flex items-start gap-4">
          <div className="text-sm text-zinc-400 font-mono w-24 shrink-0 text-right pt-0.5">
            {slot.start_time}-{slot.end_time}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={getTypeColor(slot.type)} className="shrink-0 capitalize">
                {sched[slot.type as keyof typeof sched]?.[locale] || slot.type}
              </Badge>
            </div>
            <h3 className="font-medium text-white text-sm">
              {locale === "zh" && (slot.sessions?.title_zh || slot.label_zh)
                ? (slot.sessions?.title_zh || slot.label_zh)
                : (slot.sessions?.title || slot.label)}
            </h3>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-500">
              {slot.sessions?.profiles && (
                <span className="flex items-center gap-1"><User className="h-3 w-3" />{slot.sessions.profiles.full_name}{slot.sessions.profiles.company && ` · ${slot.sessions.profiles.company}`}</span>
              )}
              {slot.room && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{slot.room}</span>}
              {slot.sessions?.duration && <span><Clock className="h-3 w-3 inline mr-1" />{slot.sessions.duration}min</span>}
            </div>
          </div>
        </CardContent>
      </Card>
      {hasContent && <HoverSessionPopover session={slot.sessions!} locale={locale} />}
    </div>
  )
}

export default async function SchedulePage() {
  const cookieStore = await cookies()
  const locale = getLocale(cookieStore.get("lang")?.value)

  const slots = mockSlots as Slot[]
  const days = [...new Set(slots.map((s) => s.date))]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-4xl font-bold mb-4">{sched.title[locale]}</h1>
      <div className="mb-8 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
        <p className="font-medium">
          {locale === "zh" ? "议程内容为占位示例" : "Program details are provisional"}
        </p>
        <p className="mt-1 text-amber-800 dark:text-amber-100/80">
          {locale === "zh"
            ? "讲者、时间段和分论坛安排仍在确认中，后续会替换为正式信息。"
            : "Speakers, time slots, and track details are still being confirmed and will be replaced with official information later."}
        </p>
      </div>

      <Tabs defaultValue={days[0]} className="w-full">
        <TabsList className="bg-zinc-900 border border-zinc-800 flex-wrap h-auto gap-1 p-1 mb-8">
          {days.map((day, i) => (
            <TabsTrigger key={day} value={day} className="data-[state=active]:bg-emerald-950/50 data-[state=active]:text-emerald-400 px-5">
              {`${locale === "zh" ? "第" : "Day "}${i + 1}${locale === "zh" ? "天" : ""}`}
              <span className="ml-2 text-xs text-zinc-500 font-normal">{day}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {days.map((day) => {
          const daySlots = slots.filter((s) => s.date === day).sort((a, b) => {
            if (a.start_time !== b.start_time) return a.start_time.localeCompare(b.start_time)
            return a.sort_order - b.sort_order
          })

          const morning = daySlots.filter(s => s.start_time < "12:30")
          const afternoon = daySlots.filter(s => s.start_time >= "12:30")

          const morningRooms = [...new Set(morning.filter(s => s.room && s.type !== "break").map(s => s.room))] as string[]
          const afternoonRooms = [...new Set(afternoon.filter(s => s.room && s.type !== "break").map(s => s.room))] as string[]

          return (
            <TabsContent key={day} value={day} className="mt-6 space-y-12">

              {/* MORNING */}
              {morning.length > 0 && (
                <div>
                  {morningRooms.length <= 1 ? (
                    <div>
                      <h3 className="text-center text-base font-semibold text-emerald-400 mb-6">
                        {locale === "zh" ? "上午 · 主论坛" : "Morning · Main Forum"}
                        <span className="text-sm font-normal text-zinc-500 ml-2">— Main Hall</span>
                      </h3>
                      <div className="space-y-3 max-w-3xl mx-auto">
                        {morning.map(slot => <TimelineCard key={slot.id} slot={slot} locale={locale} />)}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-center text-base font-semibold text-cyan-400 mb-2">
                        {locale === "zh" ? "上午 · 分论坛" : "Morning · Sub-Forums"}
                      </h3>
                      <RoomLegend rooms={morningRooms} locale={locale} />
                      <div className="mt-5">
                        <SessionGrid rooms={morningRooms} daySlots={morning} locale={locale} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* AFTERNOON */}
              {afternoon.length > 0 && (
                <div>
                  {afternoonRooms.length <= 1 ? (
                    <div>
                      <h3 className="text-center text-base font-semibold text-emerald-400 mb-6">
                        {locale === "zh" ? "下午" : "Afternoon"}
                      </h3>
                      <div className="space-y-3 max-w-3xl mx-auto">
                        {afternoon.map(slot => <TimelineCard key={slot.id} slot={slot} locale={locale} />)}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-center text-base font-semibold text-cyan-400 mb-2">
                        {locale === "zh" ? "下午 · 分论坛" : "Afternoon · Sub-Forums"}
                      </h3>
                      <RoomLegend rooms={afternoonRooms} locale={locale} />
                      <div className="mt-5">
                        <SessionGrid rooms={afternoonRooms} daySlots={afternoon} locale={locale} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}

function RoomLegend({ rooms, locale }: { rooms: string[]; locale: "en" | "zh" }) {
  return (
    <div className="flex flex-wrap justify-center gap-4 mb-2 text-xs">
      {rooms.map(r => {
        const key = getRoomColorKey(r)
        const color = roomColors[key]
        const name = r
        return (
          <div key={r} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${color?.replace("border-l-", "bg-") || "bg-zinc-500"}`} />
            <span className="text-zinc-400">{name}</span>
          </div>
        )
      })}
    </div>
  )
}

function SessionGrid({ rooms, daySlots, locale }: { rooms: string[]; daySlots: Slot[]; locale: "en" | "zh" }) {
  const sessionsOnly = daySlots.filter(s => s.room && rooms.includes(s.room) && s.type !== "break")
  const breaks = daySlots.filter(s => s.type === "break")
  const timeSlotSet = [...new Set(sessionsOnly.map(s => s.start_time))].sort()

  const roomColorsDisplay: Record<string, { bg: string; border: string }> = {
    "Room A": { bg: "bg-emerald-950/40", border: "border-emerald-800/50" },
    "Room B": { bg: "bg-cyan-950/40", border: "border-cyan-800/50" },
    "Room C": { bg: "bg-purple-950/40", border: "border-purple-800/50" },
    "Room D": { bg: "bg-amber-950/40", border: "border-amber-800/50" },
    "Main Hall": { bg: "bg-rose-950/40", border: "border-rose-800/50" },
  }

  return (
    <div>
      {/* Room column headers */}
      <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: `repeat(${rooms.length}, 1fr)` }}>
        {rooms.map(r => {
          const key = getRoomColorKey(r)
          const display = roomColorsDisplay[key]
          const producer = mockProducers[key]
          return (
            <div key={r} className={`text-center rounded-lg py-2.5 px-2 border ${display?.bg || "bg-zinc-900/50"} ${display?.border || "border-zinc-800"}`}>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className={`w-2 h-2 rounded-full shrink-0 ${roomColors[key]?.replace("border-l-", "bg-") || "bg-zinc-500"}`} />
                <span className="text-xs font-semibold text-white leading-tight">{r}</span>
              </div>
              {producer && (
                <div className="group relative inline-block cursor-default">
                  <span className="text-[10px] text-zinc-400 border-b border-dotted border-zinc-600 group-hover:text-amber-400 group-hover:border-amber-500 transition-colors">
                    {locale === "zh" ? "出品人：" : "Producer: "}
                    <span className="text-zinc-300 group-hover:text-amber-300">{locale === "zh" ? producer.name_zh : producer.name}</span>
                  </span>
                  <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1 w-72 hidden group-hover:block pb-2">
                    <div className="bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
                      <div className="p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <img src={producer.photo_url} alt={producer.name} className="w-12 h-12 rounded-full object-cover ring-2 ring-amber-500/50 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white">{locale === "zh" ? producer.name_zh : producer.name}</p>
                            <p className="text-xs text-amber-400">{locale === "zh" ? producer.title_zh : producer.title}</p>
                          </div>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed line-clamp-4">
                          {locale === "zh" ? producer.bio_zh : producer.bio}
                        </p>
                      </div>
                      <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-4 h-4 rotate-45 bg-zinc-800 border-r border-b border-zinc-700" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Time grid */}
      {timeSlotSet.map((time) => {
        const refSlot = sessionsOnly.find(s => s.start_time === time)
        const endTime = refSlot?.end_time || ""
        return (
          <div key={time} className="mb-3">
            <div className="text-[11px] text-zinc-500 font-mono mb-1 pl-1">{time} — {endTime}</div>
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${rooms.length}, 1fr)` }}>
              {rooms.map(r => {
                const cellSlot = sessionsOnly.find(s => s.room === r && s.start_time === time)
                return (
                  <div key={r}>
                    {cellSlot ? (
                      <SessionCell slot={cellSlot} locale={locale} />
                    ) : (
                      <div className="p-3 rounded-lg border border-transparent min-h-[90px]" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Breaks */}
      {(() => {
        const seen = new Set<string>()
        const uniqueBreaks = breaks.filter(b => {
          const key = `${b.start_time}-${b.end_time}-${b.label}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        return uniqueBreaks.map(slot => (
          <SessionCell key={slot.id} slot={slot} locale={locale} />
        ))
      })()}
    </div>
  )
}
