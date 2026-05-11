"use client"

import { useEffect, useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import { Search, CheckCircle, X, UserCheck, Users, QrCode } from "lucide-react"

function getLocaleFromCookie(): "en" | "zh" {
  if (typeof document === "undefined") return "en"
  const match = document.cookie.match(/(?:^|;\s*)lang=([^;]*)/)
  return match?.[1] === "zh" ? "zh" : "en"
}

export default function AdminCheckinPage() {
  const [locale] = useState(getLocaleFromCookie())
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [stats, setStats] = useState({ total: 0, checkedIn: 0 })
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadStats(); inputRef.current?.focus() }, [])

  async function loadStats() {
    const supabase = createClient()
    const { count: total } = await supabase.from("registrations").select("*", { count: "exact", head: true })
    const { count: checkedIn } = await supabase.from("registrations").select("*", { count: "exact", head: true }).eq("checked_in", true)
    setStats({ total: total || 0, checkedIn: checkedIn || 0 })
  }

  async function doSearch(query: string) {
    setSearch(query)
    if (query.length < 2) { setResults([]); return }
    setSearching(true)
    const supabase = createClient()
    const { data } = await supabase
      .from("registrations")
      .select("*, ticket_types(name, name_zh)")
      .or(`name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
      .order("checked_in", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(20)
    setResults(data || [])
    setSearching(false)
  }

  async function toggleCheckin(reg: any) {
    const supabase = createClient()
    const newStatus = !reg.checked_in
    const { error } = await supabase
      .from("registrations")
      .update({ checked_in: newStatus, checked_in_at: newStatus ? new Date().toISOString() : null })
      .eq("id", reg.id)
    if (error) { toast.error(error.message); return }
    const msg = newStatus
      ? (locale === "zh" ? `${reg.name} — 已签到 ✓` : `${reg.name} — Checked in ✓`)
      : (locale === "zh" ? `已撤销 ${reg.name} 签到` : `Undone check-in for ${reg.name}`)
    toast.success(msg)
    doSearch(search)
    loadStats()
  }

  const label = locale === "zh" ? "签到管理" : "Check-In"

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold">{label}</h1>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-emerald-400 border-emerald-800">
            <UserCheck className="h-3 w-3 mr-1" />
            {stats.checkedIn}/{stats.total}
          </Badge>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="h-5 w-5 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
        <Input
          ref={inputRef}
          value={search}
          onChange={e => doSearch(e.target.value)}
          placeholder={locale === "zh" ? "输入姓名 / 邮箱 / 手机号搜索..." : "Search by name / email / phone..."}
          className="pl-12 h-14 text-lg bg-zinc-900/80 border-zinc-700 focus:border-emerald-500"
        />
        {search.length > 0 && (
          <button onClick={() => { setSearch(""); setResults([]); inputRef.current?.focus() }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {searching && <p className="text-center text-zinc-500 py-8">{locale === "zh" ? "搜索中..." : "Searching..."}</p>}

      <div className="space-y-2">
        {results.map(reg => (
          <Card key={reg.id} className={`bg-zinc-900/50 border transition-colors ${reg.checked_in ? "border-emerald-800/50 bg-emerald-950/10" : "border-zinc-800 hover:border-zinc-700"}`}>
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-white text-lg">{reg.name}</span>
                  {reg.checked_in && <Badge className="bg-emerald-900/50 text-emerald-300 border-emerald-800 shrink-0">{locale === "zh" ? "已签到" : "Checked in"}</Badge>}
                  {reg.ticket_types && <Badge variant="outline" className="text-[10px]">{reg.ticket_types.name}</Badge>}
                </div>
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <span>{reg.email}</span>
                  <span>{reg.phone}</span>
                  {reg.company && <span>{reg.company}</span>}
                  {reg.checked_in_at && <span className="text-zinc-600">{locale === "zh" ? "签到时间: " : "At: "}{new Date(reg.checked_in_at).toLocaleTimeString(locale === "zh" ? "zh-CN" : "en-US")}</span>}
                </div>
              </div>
              <Button
                size="sm"
                variant={reg.checked_in ? "outline" : "default"}
                className={reg.checked_in ? "border-zinc-700 text-zinc-400" : "bg-emerald-600 hover:bg-emerald-500"}
                onClick={() => toggleCheckin(reg)}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                {reg.checked_in ? (locale === "zh" ? "撤销" : "Undo") : (locale === "zh" ? "签到" : "Check In")}
              </Button>
            </CardContent>
          </Card>
        ))}

        {search.length >= 2 && !searching && results.length === 0 && (
          <div className="text-center py-20 text-zinc-500">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">{locale === "zh" ? "未找到匹配的报名信息" : "No matching registrations found"}</p>
          </div>
        )}

        {search.length < 2 && (
          <div className="text-center py-20 text-zinc-500">
            <QrCode className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">{locale === "zh" ? "输入姓名、邮箱或手机号开始搜索签到" : "Search by name, email or phone to check in"}</p>
          </div>
        )}
      </div>
    </div>
  )
}
