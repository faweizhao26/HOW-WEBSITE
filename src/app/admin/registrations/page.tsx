"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Search, Filter, Download, Mail, Phone, Ticket } from "lucide-react"

function getLocaleFromCookie(): "en" | "zh" {
  if (typeof document === "undefined") return "en"
  const match = document.cookie.match(/(?:^|;\s*)lang=([^;]*)/)
  return match?.[1] === "zh" ? "zh" : "en"
}

export default function AdminRegistrationsPage() {
  const [locale] = useState(getLocaleFromCookie())
  const [registrations, setRegistrations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [ticketFilter, setTicketFilter] = useState("all")
  const [channelFilter, setChannelFilter] = useState("all")

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("registrations")
      .select("*, ticket_types(name, name_zh), profiles(full_name)")
      .order("created_at", { ascending: false })
    if (data) setRegistrations(data)
    setLoading(false)
  }

  async function exportCSV() {
    const headers = ["Name", "Email", "Phone", "Company", "Position", "Ticket", "Channel", "Date"]
    const rows = registrations.map(r => [
      r.name, r.email, r.phone, r.company || "", r.position || "",
      r.ticket_types?.name || "", r.channel_code || "",
      new Date(r.created_at).toLocaleString()
    ])
    const csv = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(",")).join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = "registrations.csv"; a.click()
    toast.success(locale === "zh" ? "已导出 CSV" : "CSV exported")
  }

  const filtered = registrations.filter(r => {
    const q = search.toLowerCase()
    const match = !q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.phone.includes(q)
    const ticketMatch = ticketFilter === "all" || r.ticket_type_id === ticketFilter
    const channelMatch = channelFilter === "all" || r.channel_code === channelFilter || (!r.channel_code && channelFilter === "none")
    return match && ticketMatch && channelMatch
  })

  const ticketTypes = [...new Map(registrations.filter(r => r.ticket_types).map(r => [r.ticket_type_id, r.ticket_types])).entries()].map(([id, t]) => ({ id, ...t }))
  const channels = [...new Set(registrations.map(r => r.channel_code).filter(Boolean))]

  if (loading) return <div><h1 className="text-2xl font-bold mb-8">{locale === "zh" ? "报名管理" : "Registrations"}</h1><div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 bg-zinc-800" />)}</div></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold">{locale === "zh" ? "报名管理" : "Registrations"}</h1>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-zinc-400">{registrations.length} total</Badge>
          <Button size="sm" variant="outline" onClick={exportCSV} className="border-zinc-700">
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input placeholder={locale === "zh" ? "搜索姓名/邮箱/手机..." : "Search..."} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={ticketFilter} onValueChange={(v) => setTicketFilter(v || "all")}>
          <SelectTrigger className="w-40"><Ticket className="h-4 w-4 mr-1" /><SelectValue placeholder={locale === "zh" ? "票种" : "Ticket"} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{locale === "zh" ? "全部票种" : "All tickets"}</SelectItem>
            {ticketTypes.map((t: any) => <SelectItem key={t.id} value={t.id}>{locale === "zh" && t.name_zh ? t.name_zh : t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={channelFilter} onValueChange={(v) => setChannelFilter(v || "all")}>
          <SelectTrigger className="w-36"><Filter className="h-4 w-4 mr-1" /><SelectValue placeholder={locale === "zh" ? "渠道" : "Channel"} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{locale === "zh" ? "全部" : "All"}</SelectItem>
            <SelectItem value="none">{locale === "zh" ? "无渠道码" : "No code"}</SelectItem>
            {channels.map(c => <SelectItem key={c!} value={c!}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {filtered.map(reg => (
          <Card key={reg.id} className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-white">{reg.name}</span>
                    {reg.ticket_types && (
                      <Badge variant="outline" className="text-[10px]">{locale === "zh" && reg.ticket_types.name_zh ? reg.ticket_types.name_zh : reg.ticket_types.name}</Badge>
                    )}
                    {reg.channel_code && <Badge variant="secondary" className="text-[10px]">{reg.channel_code}</Badge>}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-zinc-500">
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{reg.email}</span>
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{reg.phone}</span>
                    {reg.company && <span>{reg.company}</span>}
                    {reg.position && <span className="text-zinc-600">· {reg.position}</span>}
                  </div>
                </div>
                <span className="text-xs text-zinc-600 shrink-0">{new Date(reg.created_at).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US")}</span>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-20 text-zinc-500"><p>{locale === "zh" ? "暂无报名记录" : "No registrations yet"}</p></div>
        )}
      </div>
    </div>
  )
}
