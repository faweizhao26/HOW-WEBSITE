"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { Pencil, Plus, Send, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { publishAgenda } from "@/app/admin/actions/publication"
import { PublicationActions } from "@/components/admin/publication-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { conference } from "@/lib/conference"
import { validateAgendaDraft, type AgendaIssue } from "@/lib/content/agenda-validation"
import type { AgendaRelease, AgendaSlot, AgendaSlotInsert } from "@/lib/db/schema"
import { admin as adminT, schedule as sched } from "@/lib/i18n/translations"
import type { Locale } from "@/lib/i18n/utils"
import { mockSlots } from "@/lib/mock-data"
import { createClient } from "@/lib/supabase/client"
import { isMockMode } from "@/lib/utils"

type SessionOption = { id: string; title: string; title_zh: string | null }
type ReleaseSummary = Pick<AgendaRelease, "id" | "version" | "published_at" | "is_current">
type AgendaData = { slots: AgendaSlot[]; sessions: SessionOption[]; releases: ReleaseSummary[] }

const slotTypes = ["opening", "keynote", "session", "break", "panel", "closing"] as const
const issueLabels: Record<AgendaIssue, { en: string; zh: string }> = {
  empty: { en: "Add at least one agenda slot.", zh: "请先添加议程时段。" },
  date: { en: "All slots must be within April 16-18, 2027.", zh: "所有时段必须在 2027 年 4 月 16 日至 18 日内。" },
  time: { en: "Every end time must be later than its start time.", zh: "每个时段的结束时间必须晚于开始时间。" },
  session: { en: "Session slots must reference an already published session.", zh: "演讲时段必须绑定已发布的演讲。" },
  label: { en: "Slots without a session must have a title.", zh: "未绑定演讲的时段必须填写标题。" },
}

function getLocaleFromCookie(): Locale {
  if (typeof document === "undefined") return "en"
  return document.cookie.match(/(?:^|;\s*)lang=([^;]*)/)?.[1] === "zh" ? "zh" : "en"
}

function emptySlot(date: string): AgendaSlotInsert {
  return { date, start_time: "09:00", end_time: "09:30", label: "", label_zh: null, type: "opening", session_id: null, room: null, sort_order: 0 }
}

function getMockAgenda(): AgendaData {
  const now = "2026-09-29T00:00:00.000Z"
  const sessions = new Map<string, SessionOption>()
  const slots: AgendaSlot[] = mockSlots.map((slot) => {
    if (slot.sessions) sessions.set(slot.sessions.id, { id: slot.sessions.id, title: slot.sessions.title, title_zh: slot.sessions.title_zh })
    return {
      ...slot,
      type: slot.type === "workshop" ? "session" : slot.type as AgendaSlot["type"],
      label_zh: slot.label_zh || null,
      created_at: now,
      updated_at: now,
    }
  })
  return { slots, sessions: [...sessions.values()], releases: [] }
}

async function fetchAgendaData(): Promise<AgendaData> {
  const supabase = createClient()
  const [slots, sessions, releases] = await Promise.all([
    supabase.from("agenda_slots").select("*").order("date").order("start_time").order("sort_order"),
    supabase.from("published_sessions").select("id, title, title_zh").order("title"),
    supabase.from("agenda_releases").select("id, version, published_at, is_current").order("version", { ascending: false }),
  ])
  for (const result of [slots, sessions, releases]) if (result.error) throw result.error
  return { slots: (slots.data ?? []) as AgendaSlot[], sessions: (sessions.data ?? []) as SessionOption[], releases: (releases.data ?? []) as ReleaseSummary[] }
}

export default function AdminAgendaPage() {
  const [locale] = useState<Locale>(getLocaleFromCookie)
  const mockMode = isMockMode()
  const [data, setData] = useState<AgendaData>(() => mockMode ? getMockAgenda() : { slots: [], sessions: [], releases: [] })
  const [loading, setLoading] = useState(!mockMode)
  const [loadError, setLoadError] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<AgendaSlot | null>(null)
  const [form, setForm] = useState<AgendaSlotInsert>(() => emptySlot(conference.startDate))
  const [saving, setSaving] = useState(false)
  const [publishing, startPublishing] = useTransition()
  const [publishError, setPublishError] = useState("")

  const loadData = useCallback(async () => {
    if (mockMode) return
    try {
      setData(await fetchAgendaData())
      setLoadError(false)
    } catch {
      setLoadError(true)
      toast.error(locale === "zh" ? "议程草稿加载失败" : "Unable to load agenda drafts")
    } finally {
      setLoading(false)
    }
  }, [locale, mockMode])

  useEffect(() => {
    if (mockMode) return
    let cancelled = false
    fetchAgendaData()
      .then((rows) => { if (!cancelled) setData(rows) })
      .catch(() => { if (!cancelled) setLoadError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [mockMode])

  function openEditor(date: string, slot?: AgendaSlot) {
    setEditing(slot ?? null)
    setForm(slot ? {
      date: slot.date, start_time: slot.start_time.slice(0, 5), end_time: slot.end_time.slice(0, 5),
      label: slot.label, label_zh: slot.label_zh, type: slot.type, session_id: slot.session_id,
      room: slot.room, sort_order: slot.sort_order,
    } : emptySlot(date))
    setOpen(true)
  }

  function setField<K extends keyof AgendaSlotInsert>(key: K, value: AgendaSlotInsert[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function saveSlot(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (form.start_time >= form.end_time) {
      toast.error(issueLabels.time[locale])
      return
    }
    setSaving(true)
    const payload = { ...form, label: form.label.trim(), label_zh: form.label_zh?.trim() || null, room: form.room?.trim() || null }
    try {
      if (mockMode) {
        const now = new Date().toISOString()
        const saved: AgendaSlot = { ...payload, id: editing?.id ?? crypto.randomUUID(), created_at: editing?.created_at ?? now, updated_at: now }
        setData((current) => ({ ...current, slots: editing ? current.slots.map((slot) => slot.id === saved.id ? saved : slot) : [...current.slots, saved] }))
      } else {
        const supabase = createClient()
        const query = editing ? supabase.from("agenda_slots").update(payload).eq("id", editing.id) : supabase.from("agenda_slots").insert(payload)
        const { error } = await query
        if (error) throw error
        await loadData()
      }
      setOpen(false)
      setPublishError("")
      toast.success(locale === "zh" ? "议程草稿已保存" : "Agenda draft saved")
    } catch {
      toast.error(locale === "zh" ? "保存失败" : "Unable to save agenda draft")
    } finally {
      setSaving(false)
    }
  }

  async function restoreSlot(slot: AgendaSlot) {
    try {
      if (!mockMode) {
        const { error } = await createClient().from("agenda_slots").insert({
          id: slot.id, date: slot.date, start_time: slot.start_time, end_time: slot.end_time,
          label: slot.label, label_zh: slot.label_zh, type: slot.type,
          session_id: slot.session_id, room: slot.room, sort_order: slot.sort_order,
        })
        if (error) throw error
      }
      setData((current) => ({ ...current, slots: [...current.slots.filter((item) => item.id !== slot.id), slot] }))
      toast.success(locale === "zh" ? "时段已恢复" : "Slot restored")
    } catch { toast.error(locale === "zh" ? "恢复失败" : "Unable to restore slot") }
  }

  async function deleteSlot(slot: AgendaSlot) {
    try {
      if (!mockMode) {
        const { error } = await createClient().from("agenda_slots").delete().eq("id", slot.id)
        if (error) throw error
      }
      setData((current) => ({ ...current, slots: current.slots.filter((item) => item.id !== slot.id) }))
      toast(adminT.slotDeleted[locale], { action: { label: locale === "zh" ? "撤回" : "Undo", onClick: () => restoreSlot(slot) }, duration: 5000 })
    } catch { toast.error(locale === "zh" ? "删除失败" : "Unable to delete slot") }
  }

  function publish() {
    const issues = validateAgendaDraft(data.slots, conference.days, data.sessions.map((session) => session.id))
    if (issues.length) {
      setPublishError(issues.map((issue) => issueLabels[issue][locale]).join(" "))
      return
    }
    setPublishError("")
    startPublishing(async () => {
      const result = await publishAgenda()
      if (!result.ok) { setPublishError(result.message); return }
      toast.success(locale === "zh" ? "整版议程已发布" : "Complete agenda published")
      await loadData()
    })
  }

  const currentRelease = data.releases.find((release) => release.is_current)
  const days = [...new Set([...conference.days, ...data.slots.map((slot) => slot.date)])].sort()
  const sessionTitle = (id: string) => {
    const session = data.sessions.find((item) => item.id === id)
    return session ? (locale === "zh" ? session.title_zh || session.title : session.title) : (locale === "zh" ? "演讲尚未发布" : "Session not published")
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-52" /><Skeleton className="h-36" /><Skeleton className="h-36" /></div>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{adminT.agendaManagement[locale]}</h1>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => openEditor(conference.startDate)} disabled={loadError}><Plus />{adminT.addSlot[locale]}</Button>
          {!mockMode && <Button onClick={publish} disabled={publishing || saving || loadError}><Send />{publishing ? (locale === "zh" ? "发布中" : "Publishing") : (locale === "zh" ? "发布整版议程" : "Publish complete agenda")}</Button>}
        </div>
      </div>
      <div className="border-y py-4 text-sm text-muted-foreground">
        {currentRelease ? <p>{locale === "zh" ? "当前公开版本" : "Current public release"}: v{currentRelease.version} · {new Date(currentRelease.published_at).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}</p> : <p>{locale === "zh" ? "尚未发布正式议程" : "No official agenda release yet"}</p>}
        {publishError && <p role="alert" className="mt-2 text-red-700 dark:text-red-400">{publishError}</p>}
      </div>
      {loadError ? <div className="flex flex-wrap items-center gap-3 text-muted-foreground"><p>{locale === "zh" ? "议程草稿加载失败" : "Unable to load agenda drafts"}</p><Button variant="outline" onClick={loadData}>{locale === "zh" ? "重试" : "Retry"}</Button></div> : <Tabs defaultValue={conference.startDate}>
        <div className="overflow-x-auto pb-2"><TabsList className="h-auto min-w-max">{days.map((day) => <TabsTrigger key={day} value={day}>{day}</TabsTrigger>)}</TabsList></div>
        {days.map((day) => <TabsContent key={day} value={day} className="space-y-3">
          <div className="flex items-center justify-between gap-3"><span className="text-sm text-muted-foreground">{data.slots.filter((slot) => slot.date === day).length} {locale === "zh" ? "个时段" : "slots"}</span><Button variant="outline" size="sm" onClick={() => openEditor(day)}><Plus />{adminT.addSlot[locale]}</Button></div>
          {data.slots.filter((slot) => slot.date === day).sort((a, b) => a.start_time.localeCompare(b.start_time) || a.sort_order - b.sort_order).map((slot) => <Card key={slot.id}>
            <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
              <div className="w-28 shrink-0 font-mono text-sm text-muted-foreground">{slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}</div>
              <div className="min-w-0 flex-1"><div className="mb-1 flex flex-wrap items-center gap-2"><Badge variant="outline">{sched[slot.type as keyof typeof sched]?.[locale] || slot.type}</Badge>{slot.room && <span className="text-xs text-muted-foreground">{slot.room}</span>}</div><p className="text-sm font-medium">{slot.session_id ? sessionTitle(slot.session_id) : (locale === "zh" ? slot.label_zh || slot.label : slot.label) || (locale === "zh" ? "标题待补充" : "Title not set")}</p></div>
              <div className="flex shrink-0 items-center gap-2"><Button variant="outline" size="sm" onClick={() => openEditor(day, slot)}><Pencil />{locale === "zh" ? "编辑" : "Edit"}</Button><Button variant="ghost" size="icon-sm" onClick={() => deleteSlot(slot)} aria-label={locale === "zh" ? "删除时段" : "Delete slot"}><Trash2 /></Button></div>
            </CardContent>
          </Card>)}
        </TabsContent>)}
      </Tabs>}

      {data.releases.length > 0 && <section className="border-t pt-6"><h2 className="mb-3 text-lg font-semibold">{locale === "zh" ? "发布历史" : "Release history"}</h2><div className="divide-y">{data.releases.map((release) => <div key={release.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="text-sm">v{release.version} · {new Date(release.published_at).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}{release.is_current && <Badge className="ml-2" variant="outline">{locale === "zh" ? "当前" : "Current"}</Badge>}</span>{!release.is_current && <PublicationActions id={release.id} kind="agenda-release" locale={locale} onCompleted={loadData} />}</div>)}</div></section>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>{editing ? (locale === "zh" ? "编辑议程时段" : "Edit agenda slot") : adminT.newAgendaSlot[locale]}</DialogTitle></DialogHeader>
          <form onSubmit={saveSlot} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="slot-date">{locale === "zh" ? "日期" : "Date"}</Label><Input id="slot-date" type="date" min={conference.startDate} max={conference.endDate} value={form.date} onChange={(event) => setField("date", event.target.value)} required /></div>
            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label htmlFor="slot-start">{locale === "zh" ? "开始时间" : "Start time"}</Label><Input id="slot-start" type="time" value={form.start_time} onChange={(event) => setField("start_time", event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="slot-end">{locale === "zh" ? "结束时间" : "End time"}</Label><Input id="slot-end" type="time" value={form.end_time} onChange={(event) => setField("end_time", event.target.value)} required /></div></div>
            <div className="space-y-2"><Label>{locale === "zh" ? "类型" : "Type"}</Label><Select value={form.type} onValueChange={(value) => setField("type", value as AgendaSlot["type"])}><SelectTrigger className="w-full"><SelectValue>{sched[form.type as keyof typeof sched]?.[locale] || form.type}</SelectValue></SelectTrigger><SelectContent>{slotTypes.map((type) => <SelectItem key={type} value={type}>{sched[type as keyof typeof sched]?.[locale] || type}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>{locale === "zh" ? "已发布演讲" : "Published session"}</Label><Select value={form.session_id ?? "none"} onValueChange={(value) => setField("session_id", !value || value === "none" ? null : value)}><SelectTrigger className="w-full"><SelectValue>{form.session_id ? sessionTitle(form.session_id) : adminT.noSession[locale]}</SelectValue></SelectTrigger><SelectContent><SelectItem value="none">{adminT.noSession[locale]}</SelectItem>{data.sessions.map((session) => <SelectItem key={session.id} value={session.id}>{locale === "zh" ? session.title_zh || session.title : session.title}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="slot-label">{locale === "zh" ? "标题（英文）" : "Title (EN)"}</Label><Input id="slot-label" value={form.label} onChange={(event) => setField("label", event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="slot-label-zh">{locale === "zh" ? "标题（中文）" : "Title (中文)"}</Label><Input id="slot-label-zh" value={form.label_zh ?? ""} onChange={(event) => setField("label_zh", event.target.value)} /></div>
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]"><div className="space-y-2"><Label htmlFor="slot-room">{locale === "zh" ? "会场" : "Room"}</Label><Input id="slot-room" value={form.room ?? ""} onChange={(event) => setField("room", event.target.value)} /></div><div className="space-y-2"><Label htmlFor="slot-order">{locale === "zh" ? "排序" : "Order"}</Label><Input id="slot-order" type="number" value={form.sort_order} onChange={(event) => setField("sort_order", Number(event.target.value) || 0)} /></div></div>
            <Button type="submit" className="w-full" disabled={saving}>{saving ? adminT.saving[locale] : (locale === "zh" ? "保存草稿" : "Save draft")}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
