"use client"

import { useCallback, useEffect, useState, useRef } from "react"
import { useLocale } from "@/lib/i18n/provider"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { AdminLoadError } from "@/components/admin/load-error"
import { loadCheckinStats, searchCheckinRecords, updateCheckin, type CheckinStats } from "@/lib/admin/checkin"
import { buildBadgeHTML } from "@/lib/admin/badge"
import type { RegistrationRecord } from "@/lib/admin/data"
import { toast } from "sonner"
import { Search, CheckCircle, X, UserCheck, Users, QrCode, Printer, LoaderCircle, RefreshCw } from "lucide-react"

export default function AdminCheckinPage() {
  const locale = useLocale()
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<RegistrationRecord[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(false)
  const [searchVersion, setSearchVersion] = useState(0)
  const [stats, setStats] = useState<CheckinStats | null>(null)
  const [statsError, setStatsError] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchRequest = useRef(0)
  const statsRequest = useRef(0)
  const mutationInFlight = useRef(false)

  const reloadStats = useCallback(async () => {
    const request = ++statsRequest.current
    try {
      const saved = await loadCheckinStats(createClient())
      if (request !== statsRequest.current) return
      setStats(saved)
      setStatsError(false)
    } catch {
      if (request !== statsRequest.current) return
      setStats(null)
      setStatsError(true)
    }
  }, [])

  useEffect(() => {
    const request = statsRequest
    const timer = setTimeout(() => { void reloadStats() }, 0)
    inputRef.current?.focus()
    return () => { clearTimeout(timer); request.current++ }
  }, [reloadStats])

  useEffect(() => {
    if (search.trim().length < 2) return
    const request = searchRequest.current
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const records = await searchCheckinRecords(createClient(), search, controller.signal)
        if (request !== searchRequest.current || controller.signal.aborted) return
        setResults(records)
        setSearchError(false)
      } catch {
        if (request !== searchRequest.current || controller.signal.aborted) return
        setResults([])
        setSearchError(true)
      } finally {
        if (request === searchRequest.current && !controller.signal.aborted) setSearching(false)
      }
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [search, searchVersion])

  function changeSearch(query: string) {
    searchRequest.current++
    setSearch(query)
    setResults([])
    setSearchError(false)
    setSearching(query.trim().length >= 2)
  }

  function retrySearch() {
    searchRequest.current++
    setSearchError(false)
    setSearching(true)
    setSearchVersion(version => version + 1)
  }

  async function toggleCheckin(reg: RegistrationRecord) {
    if (mutationInFlight.current) return
    mutationInFlight.current = true
    setUpdating(reg.id)
    try {
      const saved = await updateCheckin(createClient(), reg)
      setResults(current => current.map(record => record.id === saved.id ? { ...record, ...saved } : record))
      toast.success(saved.checked_in
        ? (locale === "zh" ? `${reg.name} 已签到` : `${reg.name} checked in`)
        : (locale === "zh" ? `已撤销 ${reg.name} 签到` : `Undone check-in for ${reg.name}`))
      void reloadStats()
    } catch {
      toast.error(locale === "zh" ? "签到状态未能保存，请刷新搜索结果后重试。" : "Unable to save check-in. Refresh the search results and try again.")
    } finally {
      mutationInFlight.current = false
      setUpdating(null)
    }
  }

  function printBadge(reg: RegistrationRecord) {
    const popup = window.open("", "_blank", "width=400,height=300")
    if (!popup) {
      toast.error(locale === "zh" ? "打印窗口被拦截，请允许弹出窗口后重试。" : "The print window was blocked. Allow popups and try again.")
      return
    }
    popup.document.open()
    popup.document.write(buildBadgeHTML(reg, locale))
    popup.document.close()
    const print = () => { if (!popup.closed) { popup.focus(); popup.print() } }
    if (popup.document.readyState === "complete") print()
    else popup.addEventListener("load", print, { once: true })
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h1 className="text-2xl font-bold">{locale === "zh" ? "签到管理" : "Check-In"}</h1>
        <div className="flex items-center gap-2"><Badge variant="outline" className="text-emerald-800 dark:text-emerald-300 border-emerald-700/50 tabular-nums">
          <UserCheck className="h-3 w-3 mr-1" />{stats ? `${stats.checkedIn}/${stats.total}` : "--/--"}
        </Badge>
        <Button size="icon" variant="ghost" title={locale === "zh" ? "刷新" : "Refresh"} aria-label={locale === "zh" ? "刷新" : "Refresh"}
          disabled={searching || updating !== null} onClick={() => { void reloadStats(); if (search.trim().length >= 2) retrySearch() }}>
          <RefreshCw className="size-4" />
        </Button></div>
      </div>
      {statsError && <AdminLoadError onRetry={() => { void reloadStats() }} />}

      <div className="relative my-6">
        <Search className="h-5 w-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input ref={inputRef} value={search} onChange={event => changeSearch(event.target.value)}
          aria-label={locale === "zh" ? "搜索报名" : "Search registrations"}
          placeholder={locale === "zh" ? "输入姓名 / 邮箱 / 手机号搜索..." : "Search by name / email / phone..."}
          className="pl-12 pr-12 h-14 text-base sm:text-lg" />
        {search.length > 0 && <button type="button" aria-label={locale === "zh" ? "清空搜索" : "Clear search"}
          onClick={() => { changeSearch(""); inputRef.current?.focus() }}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>}
      </div>

      {searching && <p role="status" className="text-center text-muted-foreground py-8">{locale === "zh" ? "搜索中..." : "Searching..."}</p>}
      {searchError && <AdminLoadError onRetry={retrySearch} />}
      <div className="space-y-2">
        {results.map(reg => (
          <Card key={reg.id} className={reg.checked_in ? "border-emerald-700/50" : ""}>
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex-1 min-w-0 basis-48">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-medium text-foreground text-lg break-all">{reg.name}</span>
                  {reg.checked_in && <Badge className="bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">{locale === "zh" ? "已签到" : "Checked in"}</Badge>}
                  {reg.status === "cancelled" && <Badge variant="outline" className="text-red-700 dark:text-red-300">{locale === "zh" ? "已取消" : "Cancelled"}</Badge>}
                  {reg.ticket_types && <Badge variant="outline" className="text-[10px] max-w-full whitespace-normal break-all">{locale === "zh" && reg.ticket_types.name_zh ? reg.ticket_types.name_zh : reg.ticket_types.name}</Badge>}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground break-all">
                  <span>{reg.email}</span><span>{reg.phone}</span>{reg.company && <span>{reg.company}</span>}
                  {reg.checked_in_at && <span>{locale === "zh" ? "签到时间: " : "At: "}{new Date(reg.checked_in_at).toLocaleTimeString(locale === "zh" ? "zh-CN" : "en-US")}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant={reg.checked_in ? "outline" : "default"}
                  disabled={updating !== null || (!reg.checked_in && reg.status !== "confirmed")}
                  className={reg.checked_in ? "" : "bg-emerald-700 text-white hover:bg-emerald-800"}
                  onClick={() => { void toggleCheckin(reg) }}>
                  {updating === reg.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  {reg.checked_in ? (locale === "zh" ? "撤销" : "Undo") : (locale === "zh" ? "签到" : "Check In")}
                </Button>
                {reg.checked_in && <Button size="sm" variant="outline" disabled={updating !== null} onClick={() => printBadge(reg)}>
                  <Printer className="h-4 w-4" />{locale === "zh" ? "打印" : "Print"}
                </Button>}
              </div>
            </CardContent>
          </Card>
        ))}
        {search.trim().length >= 2 && !searching && !searchError && results.length === 0 && <div className="text-center py-20 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" /><p className="text-lg">{locale === "zh" ? "未找到匹配的报名信息" : "No matching registrations found"}</p>
        </div>}
        {search.trim().length < 2 && <div className="text-center py-20 text-muted-foreground">
          <QrCode className="h-12 w-12 mx-auto mb-4 opacity-50" /><p className="text-lg">{locale === "zh" ? "输入姓名、邮箱或手机号开始搜索签到" : "Search by name, email or phone to check in"}</p>
        </div>}
      </div>
    </div>
  )
}
