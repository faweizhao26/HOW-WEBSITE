"use client"
import { isMockMode } from "@/lib/utils"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { admin as adminT, cfp as cfpT, common } from "@/lib/i18n/translations"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { CheckCircle, XCircle, FileText, Video, Eye, Search, Filter } from "lucide-react"

type SessionWithProfile = {
  id: string; user_id: string; title: string; title_zh: string | null; abstract: string; abstract_zh: string | null
  duration: number; type: string; status: string; admin_feedback: string | null; slides_url: string | null
  video_url: string | null; created_at: string
  profiles?: { full_name: string; company: string | null }
}

const mockSessions: SessionWithProfile[] = [
  { id: "ms1", user_id: "u1", title: "High-Performance JSON Queries in PostgreSQL 18", title_zh: "PostgreSQL 18 高性能 JSON 查询", abstract: "Exploring the new JSON optimizations in PostgreSQL 18, including parallel index scans and improved JSONPath performance.", abstract_zh: "探索 PostgreSQL 18 中新的 JSON 优化，包括并行索引扫描和改进的 JSONPath 性能。", duration: 45, type: "talk", status: "pending", admin_feedback: null, slides_url: null, video_url: null, created_at: "2027-01-15", profiles: { full_name: "Li Wei", company: "Independent" } },
  { id: "ms2", user_id: "u2", title: "Building a Real-Time Analytics Platform with PostgreSQL + ClickHouse", title_zh: "用 PostgreSQL + ClickHouse 构建实时分析平台", abstract: "How we combined PostgreSQL for OLTP with ClickHouse for OLAP using logical replication.", abstract_zh: "如何使用逻辑复制将 PostgreSQL (OLTP) 与 ClickHouse (OLAP) 结合。", duration: 30, type: "talk", status: "pending", admin_feedback: null, slides_url: null, video_url: null, created_at: "2027-01-18", profiles: { full_name: "Wang Fang", company: "Kuaishou" } },
  { id: "ms3", user_id: "u3", title: "PostgreSQL Security Best Practices for Financial Services", title_zh: "金融行业 PostgreSQL 安全最佳实践", abstract: "A comprehensive guide to PostgreSQL security in regulated industries.", abstract_zh: "受监管行业中 PostgreSQL 安全的全面指南。", duration: 45, type: "talk", status: "pending", admin_feedback: null, slides_url: null, video_url: null, created_at: "2027-01-20", profiles: { full_name: "Zhang Qiang", company: "Ping An Technology" } },
  { id: "ms4", user_id: "u4", title: "Full-Text Search Showdown: PostgreSQL vs Elasticsearch", title_zh: "全文搜索对决：PostgreSQL vs Elasticsearch", abstract: "Benchmarking PostgreSQL's built-in full-text search against Elasticsearch.", abstract_zh: "基准测试 PostgreSQL 内置全文搜索与 Elasticsearch。", duration: 30, type: "talk", status: "pending", admin_feedback: null, slides_url: null, video_url: null, created_at: "2027-01-22", profiles: { full_name: "Chen Xiao", company: "Zhihu" } },
  { id: "ms5", user_id: "u5", title: "Hands-On: Containerized PostgreSQL with Kubernetes", title_zh: "动手实践：Kubernetes 上的容器化 PostgreSQL", abstract: "A workshop through deploying PostgreSQL on Kubernetes.", abstract_zh: "在 Kubernetes 上部署 PostgreSQL 的动手实践。", duration: 60, type: "workshop", status: "pending", admin_feedback: null, slides_url: null, video_url: null, created_at: "2027-01-25", profiles: { full_name: "Ma Chao", company: "DaoCloud" } },
  { id: "ms6", user_id: "u6", title: "PostgreSQL in Gaming: Handling Millions of Concurrent Players", title_zh: "PostgreSQL 在游戏行业：处理百万并发玩家", abstract: "How NetEase uses PostgreSQL for 50M+ DAU game state.", abstract_zh: "网易如何使用 PostgreSQL 管理游戏状态。", duration: 45, type: "talk", status: "approved", admin_feedback: "Excellent topic! Very relevant.", slides_url: null, video_url: null, created_at: "2027-01-10", profiles: { full_name: "Huang Wei", company: "NetEase" } },
  { id: "ms7", user_id: "u7", title: "Comparing ORMs for PostgreSQL", title_zh: "PostgreSQL ORM 对比", abstract: "A comparison of TypeScript ORMs.", abstract_zh: "TypeScript ORM 比较。", duration: 30, type: "talk", status: "rejected", admin_feedback: "Too niche for main track.", slides_url: null, video_url: null, created_at: "2027-01-05", profiles: { full_name: "Liu Yang", company: "ByteDance" } },
]

function getLocaleFromCookie(): "en" | "zh" {
  if (typeof document === "undefined") return "en"
  const match = document.cookie.match(/(?:^|;\s*)lang=([^;]*)/)
  return match?.[1] === "zh" ? "zh" : "en"
}


function statusBadge(status: string, locale: "en" | "zh") {
  switch (status) {
    case "pending": return <Badge variant="secondary">{adminT.pending[locale]}</Badge>
    case "approved": return <Badge className="bg-emerald-900/50 text-emerald-300 border-emerald-800">{adminT.approved[locale]}</Badge>
    case "rejected": return <Badge variant="destructive">{adminT.rejected[locale]}</Badge>
    default: return <Badge variant="outline">{status}</Badge>
  }
}

export default function AdminSessionsPage() {
  const [locale] = useState<"en" | "zh">(getLocaleFromCookie())
  const [sessions, setSessions] = useState<SessionWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending")
  const [search, setSearch] = useState("")
  const [selectedSession, setSelectedSession] = useState<SessionWithProfile | null>(null)
  const [feedback, setFeedback] = useState("")
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (isMockMode()) { setSessions(mockSessions); setLoading(false); return }
    loadSessions()
  }, [])

  async function loadSessions() {
    try {
      const supabase = createClient()
      const { data } = await supabase.from("sessions").select("*, profiles(full_name, company)").order("created_at", { ascending: false })
      setSessions((data as SessionWithProfile[]) || [])
    } catch {}
    setLoading(false)
  }

  async function updateStatus(id: string, status: string, feedbackText?: string) {
    if (isMockMode()) {
      setSessions(prev => prev.map(s => s.id === id ? { ...s, status, admin_feedback: feedbackText ?? s.admin_feedback } : s))
      toast.success(status === "approved" ? adminT.sessionApprovedMsg[locale] : adminT.sessionRejectedMsg[locale])
      setSelectedSession(null)
      return
    }
    try {
      const supabase = createClient()
      const update: any = { status }
      if (feedbackText !== undefined) update.admin_feedback = feedbackText
      await supabase.from("sessions").update(update).eq("id", id)
      toast.success(status === "approved" ? adminT.sessionApprovedMsg[locale] : adminT.sessionRejectedMsg[locale])
      loadSessions()
      setSelectedSession(null)
    } catch (e: any) { toast.error(e.message) }
  }

  async function uploadMedia(id: string, file: File, type: "slides" | "video") {
    if (isMockMode()) {
      const fakeUrl = `https://example.com/${type}/${file.name}`
      setSessions(prev => prev.map(s => s.id === id ? { ...s, [type === "slides" ? "slides_url" : "video_url"]: fakeUrl } : s))
      toast.success(type === "slides" ? adminT.pptUploadedDemo[locale] : adminT.videoUploadedDemo[locale])
      return
    }
    setUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split(".").pop()
      const path = `sessions/${id}/${type}-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from("conference-media").upload(path, file)
      if (uploadError) { toast.error(uploadError.message); setUploading(false); return }
      const { data: urlData } = supabase.storage.from("conference-media").getPublicUrl(path)
      const field = type === "slides" ? "slides_url" : "video_url"
      await supabase.from("sessions").update({ [field]: urlData.publicUrl }).eq("id", id)
      toast.success(type === "slides" ? adminT.pptUploaded[locale] : adminT.videoUploaded[locale])
      loadSessions()
    } catch {}
    setUploading(false)
  }

  const filtered = sessions.filter((s) => {
    const statusMatch = filter === "all" || s.status === filter
    const q = search.toLowerCase()
    const searchMatch = !q || s.title.toLowerCase().includes(q) || (s.title_zh && s.title_zh.includes(q)) || s.profiles?.full_name.toLowerCase().includes(q)
    return statusMatch && searchMatch
  })

  const mock = isMockMode()

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold">{adminT.sessionProposals[locale]}</h1>
        {mock && <Badge variant="outline" className="text-amber-400 border-amber-800">{adminT.demo[locale]}</Badge>}
      </div>
      <p className="text-sm text-zinc-500 mb-6">
        {mock ? adminT.demoMode[locale] : (locale === "zh" ? "讲师提交的议题在这里查看、审核和管理。" : "View, review and manage speaker proposals here.")}
      </p>

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input placeholder={adminT.searchProposals[locale]} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
          <SelectTrigger className="w-32"><Filter className="h-4 w-4 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{adminT.all[locale]}</SelectItem>
            <SelectItem value="pending">{adminT.pending[locale]}</SelectItem>
            <SelectItem value="approved">{adminT.approved[locale]}</SelectItem>
            <SelectItem value="rejected">{adminT.rejected[locale]}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full bg-zinc-800" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-zinc-500"><p>{adminT.noSessions[locale]}</p></div>
      ) : (
        <div className="space-y-4">
          {filtered.map((session) => (
            <Card key={session.id} className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      {statusBadge(session.status, locale)}
                      <Badge variant="outline" className="text-zinc-400 border-zinc-700">{session.duration}min · {session.type}</Badge>
                    </div>
                    <h3 className="font-medium text-white text-lg mb-1">{session.title}</h3>
                    {session.title_zh && <p className="text-sm text-zinc-500 mb-2">{session.title_zh}</p>}
                    <p className="text-sm text-zinc-400 line-clamp-2 mb-2">{session.abstract}</p>
                    <p className="text-xs text-zinc-500">{session.profiles?.full_name}{session.profiles?.company && ` · ${session.profiles.company}`}</p>
                    {session.admin_feedback && (
                      <div className="mt-3 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                        <p className="text-xs text-zinc-500 mb-1">{adminT.adminFeedback[locale]}:</p>
                        <p className="text-sm text-zinc-300">{session.admin_feedback}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {session.status === "pending" && (
                      <>
                        <Button size="sm" variant="outline" className="border-emerald-800 text-emerald-400 hover:bg-emerald-950/50" onClick={() => updateStatus(session.id, "approved")}>
                          <CheckCircle className="h-4 w-4 mr-1" /> {adminT.approve[locale]}
                        </Button>
                        <Dialog>
                          <DialogTrigger>
                            <Button size="sm" variant="outline" className="border-red-800 text-red-400 hover:bg-red-950/50" onClick={() => { setSelectedSession(session); setFeedback("") }}>
                              <XCircle className="h-4 w-4 mr-1" /> {adminT.reject[locale]}
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-zinc-900 border-zinc-800">
                            <DialogHeader><DialogTitle>{adminT.rejectProposal[locale]}</DialogTitle></DialogHeader>
                            <div className="space-y-3">
                              <Label>{adminT.feedback[locale]} (optional)</Label>
                              <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder={adminT.explainReject[locale]} rows={3} />
                              <Button variant="destructive" onClick={() => updateStatus(session.id, "rejected", feedback)}>{adminT.confirmReject[locale]}</Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </>
                    )}

                    <Dialog>
                      <DialogTrigger>
                        <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-400 hover:text-white" onClick={() => { setSelectedSession(session); setFeedback(session.admin_feedback || "") }}>
                          <Eye className="h-4 w-4 mr-1" /> {adminT.detail[locale]}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg">
                        <DialogHeader><DialogTitle>{session.title}</DialogTitle></DialogHeader>
                        <div className="space-y-4">
                          <div><Label className="text-zinc-400">{adminT.speaker[locale]}</Label><p className="text-white">{session.profiles?.full_name} · {session.profiles?.company}</p></div>
                          <div><Label className="text-zinc-400">{adminT.abstractEn[locale]}</Label><p className="text-sm text-zinc-300">{session.abstract}</p></div>
                          {session.abstract_zh && <div><Label className="text-zinc-400">{adminT.abstractZh[locale]}</Label><p className="text-sm text-zinc-300">{session.abstract_zh}</p></div>}
                          <div className="flex gap-4 items-center">
                            <Badge variant="outline">{session.duration} min</Badge>
                            <Badge variant="outline">{session.type}</Badge>
                            {statusBadge(session.status, locale)}
                          </div>
                          {session.status !== "pending" && (
                            <div><Button size="sm" variant="outline" onClick={() => updateStatus(session.id, session.status === "approved" ? "rejected" : "approved")}>
                              {session.status === "approved" ? adminT.moveToRejected[locale] : adminT.moveToApproved[locale]}
                            </Button></div>
                          )}
                          <div className="border-t border-zinc-800 pt-4">
                            <h4 className="text-sm font-medium text-zinc-300 mb-3">{adminT.sessionMaterials[locale]}</h4>
                            <div className="flex flex-wrap gap-3">
                              <label className="cursor-pointer">
                                <input type="file" accept=".pdf,.ppt,.pptx,.key" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMedia(session.id, f, "slides") }} />
                                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-800"><FileText className="h-4 w-4" /> {adminT.uploadPpt[locale]}</span>
                              </label>
                              <label className="cursor-pointer">
                                <input type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMedia(session.id, f, "video") }} />
                                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-800"><Video className="h-4 w-4" /> {adminT.uploadVideo[locale]}</span>
                              </label>
                            </div>
                            {session.slides_url && <a href={session.slides_url} target="_blank" className="block mt-2 text-sm text-emerald-400 hover:underline"><FileText className="h-3 w-3 inline mr-1" /> {adminT.viewSlides[locale]}</a>}
                            {session.video_url && <a href={session.video_url} target="_blank" className="block mt-1 text-sm text-emerald-400 hover:underline"><Video className="h-3 w-3 inline mr-1" /> {adminT.watchVideo[locale]}</a>}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
