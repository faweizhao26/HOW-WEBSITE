"use client"
import { isMockMode } from "@/lib/utils"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { admin as adminT, schedule as sched, common } from "@/lib/i18n/translations"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { Plus, Trash2, GripVertical, MapPin } from "lucide-react"
import { mockSlots } from "@/lib/mock-data"

type AgendaSlotFull = {
  id: string; date: string; start_time: string; end_time: string; label: string; label_zh: string | null
  type: string; session_id: string | null; room: string | null; sort_order: number
  sessions?: { id: string; title: string; title_zh: string | null; type: string; duration: number; profiles?: { full_name: string; company: string | null } } | null
}

const slotTypes = [
  { value: "opening", en: "Opening", zh: "开场" },
  { value: "keynote", en: "Keynote", zh: "主题演讲" },
  { value: "session", en: "Session", zh: "演讲" },
  { value: "break", en: "Break", zh: "休息" },
  { value: "panel", en: "Panel", zh: "圆桌讨论" },
  { value: "closing", en: "Closing", zh: "闭幕" },
]

function getLocaleFromCookie(): "en" | "zh" {
  if (typeof document === "undefined") return "en"
  const match = document.cookie.match(/(?:^|;\s*)lang=([^;]*)/)
  return match?.[1] === "zh" ? "zh" : "en"
}


function EmptySlotForm({ date, onCreated, locale }: { date: string; onCreated: () => void; locale: "en" | "zh" }) {
  const [label, setLabel] = useState("")
  const [labelZh, setLabelZh] = useState("")
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("09:30")
  const [type, setType] = useState("session")
  const [room, setRoom] = useState("")
  const [open, setOpen] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isMockMode()) { toast.success(adminT.slotCreated[locale]); setOpen(false); onCreated(); return }
    try {
      const supabase = createClient()
      await supabase.from("agenda_slots").insert({ date, start_time: startTime, end_time: endTime, label: label || type, label_zh: labelZh || null, type, room: room || null, sort_order: 99 })
      toast.success(adminT.slotCreated[locale])
      setOpen(false)
      onCreated()
    } catch {}
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-400 hover:text-white"><Plus className="h-4 w-4 mr-1" /> {adminT.addSlot[locale]}</Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-800">
        <DialogHeader><DialogTitle>{adminT.newAgendaSlot[locale]}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>{common.startTime[locale]}</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required /></div>
            <div className="space-y-2"><Label>{common.endTime[locale]}</Label><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required /></div>
          </div>
          <div className="space-y-2"><Label>{common.type[locale]}</Label>
            <Select value={type} onValueChange={(v) => setType(v || "")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{slotTypes.map(t => <SelectItem key={t.value} value={t.value}>{locale === "zh" ? t.zh : t.en}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>{common.title[locale]}</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} /></div>
          <div className="space-y-2"><Label>{common.title[locale]} (中文)</Label><Input value={labelZh} onChange={(e) => setLabelZh(e.target.value)} /></div>
          <div className="space-y-2"><Label>Room</Label><Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Main Hall / Room A" /></div>
          <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500">{common.create[locale]}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminAgendaPage() {
  const [locale] = useState<"en" | "zh">(getLocaleFromCookie())
  const [slots, setSlots] = useState<AgendaSlotFull[]>([])
  const [approvedSessions, setApprovedSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [lastDeleted, setLastDeleted] = useState<AgendaSlotFull | null>(null)

  useEffect(() => {
    if (isMockMode()) {
      setSlots(mockSlots as any)
      const approved = (mockSlots as any).filter((s: any) => s.sessions && s.sessions.id).map((s: any) => s.sessions)
      setApprovedSessions(approved)
      setLoading(false)
      return
    }
    loadData()
  }, [])

  async function loadData() {
    try {
      const supabase = createClient()
      const [slotsRes, sessionsRes] = await Promise.all([
        supabase.from("agenda_slots").select("*, sessions(id, title, title_zh, type, duration, profiles(full_name, company))").order("sort_order"),
        supabase.from("sessions").select("id, title, title_zh, type, profiles(full_name, company)").eq("status", "approved"),
      ])
      setSlots((slotsRes.data as AgendaSlotFull[]) || [])
      setApprovedSessions(sessionsRes.data || [])
    } catch {}
    setLoading(false)
  }

  async function deleteSlot(id: string) {
    const deleted = slots.find(s => s.id === id)
    if (!deleted) return
    setSlots(prev => prev.filter(s => s.id !== id))
    setLastDeleted(deleted)
    const undoLabel = locale === "zh" ? "撤回" : "Undo"
    toast(adminT.slotDeleted[locale], {
      action: { label: undoLabel, onClick: () => undoDelete() },
      duration: 5000,
    })
    if (isMockMode()) return
    try { const supabase = createClient(); await supabase.from("agenda_slots").delete().eq("id", id) } catch {}
  }

  function undoDelete() {
    if (!lastDeleted) return
    setSlots(prev => {
      const restored = [...prev, lastDeleted].sort((a, b) => a.sort_order - b.sort_order)
      return restored
    })
    setLastDeleted(null)
    toast.success(locale === "zh" ? "已撤回" : "Undone")
    if (isMockMode()) return
  }

  async function assignSession(slotId: string, sessionId: string | null) {
    if (isMockMode()) {
      setSlots(prev => prev.map(s => s.id === slotId ? { ...s, session_id: sessionId, sessions: sessionId ? approvedSessions.find(a => a.id === sessionId) || null : null } : s))
      toast.success(sessionId ? adminT.sessionAssigned[locale] : adminT.sessionUnassigned[locale])
      return
    }
    try { const supabase = createClient(); await supabase.from("agenda_slots").update({ session_id: sessionId }).eq("id", slotId); toast.success(sessionId ? adminT.sessionAssigned[locale] : adminT.sessionUnassigned[locale]); loadData() } catch {}
  }

  const days = [...new Set(slots.map((s) => s.date))].sort()

  if (loading) {
    return <div><h1 className="text-2xl font-bold mb-8">{adminT.agendaManagement[locale]}</h1><div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full bg-zinc-800" />)}</div></div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">{adminT.agendaManagement[locale]}</h1>
        {days.length > 0 && <EmptySlotForm date={days[0]} onCreated={() => {}} locale={locale} />}
      </div>

      {days.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">
          <p className="mb-4">{adminT.noAgendaSlots[locale]}</p>
          <div className="flex items-center justify-center gap-4">
            <Input type="date" id="new-day-date" className="w-48" defaultValue={new Date().toISOString().split("T")[0]} />
            <Button onClick={async () => {
              const d = (document.getElementById("new-day-date") as HTMLInputElement)?.value || new Date().toISOString().split("T")[0]
              if (isMockMode()) {
                setSlots([{ id: "new-1", date: d, start_time: "09:00", end_time: "10:00", label: "Opening", label_zh: "开幕", type: "opening", session_id: null, room: "Main Hall", sort_order: 0 }])
                toast.success(adminT.firstSlotCreated[locale])
                return
              }
              try {
                const supabase = createClient()
                await supabase.from("agenda_slots").insert({ date: d, start_time: "09:00", end_time: "10:00", label: "Opening", type: "opening", room: "Main Hall", sort_order: 0 })
                toast.success(adminT.firstSlotCreated[locale])
                loadData()
              } catch (e: any) { toast.error(e.message) }
            }}>{adminT.startBuilding[locale]}</Button>
          </div>
        </div>
      ) : (
        <Tabs defaultValue={days[0]}>
          <TabsList className="bg-zinc-900 border border-zinc-800 mb-6">{days.map((day, i) => (
            <TabsTrigger key={day} value={day}>Day {i + 1} <span className="ml-2 text-xs text-zinc-500">{day}</span></TabsTrigger>
          ))}</TabsList>
          {days.map((day) => (
            <TabsContent key={day} value={day} className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-zinc-500">{slots.filter(s => s.date === day).length} {locale === "zh" ? "个时段" : "slots"}</p>
                <EmptySlotForm date={day} onCreated={() => {}} locale={locale} />
              </div>
              {slots.filter(s => s.date === day).sort((a, b) => a.sort_order - b.sort_order).map(slot => (
                <Card key={slot.id} className={`bg-zinc-900/50 border-zinc-800 ${!slot.session_id && slot.type !== "break" ? "border-dashed border-amber-800/50" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <GripVertical className="h-5 w-5 text-zinc-600" />
                      <div className="text-sm font-mono text-zinc-400 w-28 shrink-0">{slot.start_time} - {slot.end_time}</div>
                      <Badge variant="outline" className="shrink-0 capitalize">{slot.type}</Badge>
                      <div className="flex-1 min-w-0">
                        {slot.sessions ? (
                          <div><p className="font-medium text-white truncate">{slot.sessions.title}</p><p className="text-xs text-zinc-500">{slot.sessions.profiles?.full_name} · {slot.sessions.duration}min</p></div>
                        ) : (
                          <div><p className="text-zinc-400">{locale === "zh" && slot.label_zh ? slot.label_zh : slot.label}</p></div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {slot.room && <span className="text-xs text-zinc-500 flex items-center gap-1"><MapPin className="h-3 w-3" />{slot.room}</span>}
                        {slot.type !== "break" && (
                          <Select value={slot.session_id || "none"} onValueChange={(v) => assignSession(slot.id, v === "none" ? null : v)}>
                            <SelectTrigger className="w-48 h-8 text-xs">
                              {slot.session_id && slot.sessions ? (
                                <span className="truncate text-left">{locale === "zh" && slot.sessions.title_zh ? slot.sessions.title_zh : slot.sessions.title}</span>
                              ) : (
                                <span className="text-zinc-500">{adminT.assignSession[locale]}</span>
                              )}
                            </SelectTrigger>
                            <SelectContent className="max-h-64">
                              <SelectItem value="none">{adminT.noSession[locale]}</SelectItem>
                              {approvedSessions.map((s: any) => <SelectItem key={s.id} value={s.id}><span className="truncate">{s.title}</span><span className="text-zinc-500 ml-2">— {s.profiles?.full_name}</span></SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-600 hover:text-red-400" onClick={() => deleteSlot(slot.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}
