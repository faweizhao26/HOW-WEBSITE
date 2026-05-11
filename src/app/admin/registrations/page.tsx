"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { Search, Filter, Download, Mail, Phone, Ticket, XCircle, RotateCcw, CheckCircle, UserCheck } from "lucide-react"

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
  const [statusFilter, setStatusFilter] = useState("all")

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const { data } = await supabase
      .from("registrations")
      .select("*, ticket_types(name, name_zh), profiles(full_name)")
      .order("created_at", { ascending: false })
    if (data) setRegistrations(data)
    setLoading(false)
  }

  async function toggleCancel(reg: any) {
    const supabase = createClient()
    const newStatus = reg.status === "cancelled" ? "confirmed" : "cancelled"
    const { error } = await supabase.from("registrations").update({ status: newStatus }).eq("id", reg.id)
    if (error) { toast.error(error.message); return }
    const msg = newStatus === "cancelled"
      ? (locale === "zh" ? `${reg.name} 已退票` : `${reg.name} cancelled`)
      : (locale === "zh" ? `${reg.name} 已恢复` : `${reg.name} restored`)
    toast.success(msg)
    loadData()
  }

  async function exportCSV() {
    const headers = ["Name", "Email", "Phone", "Company", "Position", "Ticket", "Channel", "Status", "Checked In", "Date"]
    const rows = registrations.map(r => [
      r.name, r.email, r.phone, r.company || "", r.position || "",
      r.ticket_types?.name || "", r.channel_code || "", r.status,
      r.checked_in ? "Yes" : "No", new Date(r.created_at).toLocaleString()
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
    const statusMatch = statusFilter === "all" || r.status === statusFilter
    return match && ticketMatch && channelMatch && statusMatch
  })

  const ticketTypes = [...new Map(registrations.filter(r => r.ticket_types).map(r => [r.ticket_type_id, r.ticket_types])).entries()].map(([id, t]) => ({ id, ...t }))
  const channels = [...new Set(registrations.map(r => r.channel_code).filter(Boolean))]
  const confirmed = registrations.filter(r => r.status === "confirmed").length
  const cancelled = registrations.filter(r => r.status === "cancelled").length
  const checkedIn = registrations.filter(r => r.checked_in).length

  if (loading) return <div><h1 className="text-2xl font-bold mb-8">{locale === "zh" ? "报名管理" : "Registrations"}</h1><div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 bg-zinc-800" />)}</div></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold">{locale === "zh" ? "报名管理" : "Registrations"}</h1>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-emerald-400 border-emerald-800">{locale === "zh" ? "已确认" : "Confirmed"} {confirmed}</Badge>
          {cancelled > 0 && <Badge variant="outline" className="text-red-400 border-red-800">{cancelled} cancelled</Badge>}
          {checkedIn > 0 && <Badge variant="outline" className="text-cyan-400 border-cyan-800"><UserCheck className="h-3 w-3 mr-1" />{checkedIn}</Badge>}
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
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v || "all")}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder={locale === "zh" ? "状态" : "Status"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{locale === "zh" ? "全部" : "All"}</SelectItem>
            <SelectItem value="confirmed">{locale === "zh" ? "已确认" : "Confirmed"}</SelectItem>
            <SelectItem value="cancelled">{locale === "zh" ? "已取消" : "Cancelled"}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={ticketFilter} onValueChange={(v) => setTicketFilter(v || "all")}>
          <SelectTrigger className="w-36"><Ticket className="h-4 w-4 mr-1" /><SelectValue placeholder={locale === "zh" ? "票种" : "Ticket"} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{locale === "zh" ? "全部票种" : "All"}</SelectItem>
            {ticketTypes.map((t: any) => <SelectItem key={t.id} value={t.id}>{locale === "zh" && t.name_zh ? t.name_zh : t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={channelFilter} onValueChange={(v) => setChannelFilter(v || "all")}>
          <SelectTrigger className="w-32"><Filter className="h-4 w-4 mr-1" /><SelectValue placeholder={locale === "zh" ? "渠道" : "Channel"} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{locale === "zh" ? "全部" : "All"}</SelectItem>
            <SelectItem value="none">{locale === "zh" ? "无渠道码" : "No code"}</SelectItem>
            {channels.map(c => <SelectItem key={c!} value={c!}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {filtered.map(reg => (
          <Card key={reg.id} className={`bg-zinc-900/50 border transition-colors ${reg.status === "cancelled" ? "border-red-900/30 opacity-60" : "border-zinc-800 hover:border-zinc-700"}`}>
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`font-medium ${reg.status === "cancelled" ? "text-zinc-500 line-through" : "text-white"}`}>{reg.name}</span>
                  {reg.ticket_types && (
                    <Badge variant="outline" className="text-[10px]">{locale === "zh" && reg.ticket_types.name_zh ? reg.ticket_types.name_zh : reg.ticket_types.name}</Badge>
                  )}
                  {reg.status === "cancelled" && <Badge variant="destructive" className="text-[10px]">{locale === "zh" ? "已退票" : "Cancelled"}</Badge>}
                  {reg.checked_in && <Badge className="bg-cyan-900/50 text-cyan-300 border-cyan-800 text-[10px]">{locale === "zh" ? "已签到" : "Checked in"}</Badge>}
                  {reg.channel_code && <Badge variant="secondary" className="text-[10px]">{reg.channel_code}</Badge>}
                </div>
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{reg.email}</span>
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{reg.phone}</span>
                  {reg.company && <span>{reg.company}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-zinc-600 hidden sm:inline">{new Date(reg.created_at).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US")}</span>
                <AlertDialog>
                  <AlertDialogTrigger>
                    <Button size="sm" variant="ghost" className="h-8 text-zinc-500 hover:text-red-400">
                      {reg.status === "cancelled" ? <RotateCcw className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-zinc-900 border-zinc-800">
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {reg.status === "cancelled"
                          ? (locale === "zh" ? "恢复报名？" : "Restore Registration?")
                          : (locale === "zh" ? "确认退票？" : "Cancel Registration?")}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {reg.status === "cancelled"
                          ? (locale === "zh" ? `${reg.name} 的报名将被恢复` : `Restore ${reg.name}'s registration?`)
                          : (locale === "zh" ? `${reg.name} 的报名将被取消` : `Cancel ${reg.name}'s registration?`)}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-zinc-700">{locale === "zh" ? "返回" : "Back"}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => toggleCancel(reg)} className={reg.status === "cancelled" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"}>
                        {reg.status === "cancelled" ? (locale === "zh" ? "恢复" : "Restore") : (locale === "zh" ? "退票" : "Cancel")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
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
