"use client"

import Link from "next/link"
import { ownedProposalPhoto, type ProposalDetails } from "@/lib/cfp/service"
import { isProposalDecision, notificationCsv, topicLabels, topicTypes } from "@/lib/notifications"
import type { ProposalDecision, ProposalReviewStatus } from "@/lib/db/schema"

import { useLocale } from "@/lib/i18n/provider"
import { isMockMode } from "@/lib/utils"

import { useCallback, useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { admin as adminT, cfp as cfpT } from "@/lib/i18n/translations"
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
import { CheckCircle, Clock, XCircle, FileText, Video, Eye, Search, Filter, Download } from "lucide-react"
import { unpublishSession } from "@/app/admin/actions/publication"
import { PublicationActions } from "@/components/admin/publication-actions"
import { PublicationBadge } from "@/components/admin/publication-badge"
import { uploadSessionMedia } from "@/lib/admin/session-media"

type SessionWithProfile = {
  id: string; user_id: string | null; title: string; title_zh: string | null; abstract: string; abstract_zh: string | null
  duration: number; type: string; status: ProposalReviewStatus; admin_feedback: string | null; slides_url: string | null
  video_url: string | null; created_at: string; updated_at?: string
  speaker_id?: string | null; publication_status?: "draft" | "published"; published_at?: string | null
  profiles?: { full_name: string; company: string | null }
  proposal_details?: ProposalDetails | null
  guest_email?: string | null
}

type PublishedSpeakerOption = {
  id: string
  name: string
  name_zh: string | null
  publication_status?: "published"
}

const mockPublishedSpeakers: PublishedSpeakerOption[] = [
  { id: "mock-speaker-1", name: "Digoal", name_zh: "德哥", publication_status: "published" },
  { id: "mock-speaker-2", name: "Zhou Fei", name_zh: "周飞", publication_status: "published" },
]

const mockSessions: SessionWithProfile[] = [
  { id: "ms1", user_id: "u1", title: "High-Performance JSON Queries in PostgreSQL 18", title_zh: "PostgreSQL 18 高性能 JSON 查询", abstract: "Exploring the new JSON optimizations in PostgreSQL 18, including parallel index scans and improved JSONPath performance.", abstract_zh: "探索 PostgreSQL 18 中新的 JSON 优化，包括并行索引扫描和改进的 JSONPath 性能。", duration: 45, type: "talk", status: "pending", admin_feedback: null, slides_url: null, video_url: null, created_at: "2027-01-15", profiles: { full_name: "Li Wei", company: "Independent" } },
  { id: "ms2", user_id: "u2", title: "Building a Real-Time Analytics Platform with PostgreSQL + ClickHouse", title_zh: "用 PostgreSQL + ClickHouse 构建实时分析平台", abstract: "How we combined PostgreSQL for OLTP with ClickHouse for OLAP using logical replication.", abstract_zh: "如何使用逻辑复制将 PostgreSQL (OLTP) 与 ClickHouse (OLAP) 结合。", duration: 30, type: "talk", status: "pending", admin_feedback: null, slides_url: null, video_url: null, created_at: "2027-01-18", profiles: { full_name: "Wang Fang", company: "Kuaishou" } },
  { id: "ms3", user_id: "u3", title: "PostgreSQL Security Best Practices for Financial Services", title_zh: "金融行业 PostgreSQL 安全最佳实践", abstract: "A comprehensive guide to PostgreSQL security in regulated industries.", abstract_zh: "受监管行业中 PostgreSQL 安全的全面指南。", duration: 45, type: "talk", status: "pending", admin_feedback: null, slides_url: null, video_url: null, created_at: "2027-01-20", profiles: { full_name: "Zhang Qiang", company: "Ping An Technology" } },
  { id: "ms4", user_id: "u4", title: "Full-Text Search Showdown: PostgreSQL vs Elasticsearch", title_zh: "全文搜索对决：PostgreSQL vs Elasticsearch", abstract: "Benchmarking PostgreSQL's built-in full-text search against Elasticsearch.", abstract_zh: "基准测试 PostgreSQL 内置全文搜索与 Elasticsearch。", duration: 30, type: "talk", status: "pending", admin_feedback: null, slides_url: null, video_url: null, created_at: "2027-01-22", profiles: { full_name: "Chen Xiao", company: "Zhihu" } },
  { id: "ms5", user_id: "u5", title: "Hands-On: Containerized PostgreSQL with Kubernetes", title_zh: "动手实践：Kubernetes 上的容器化 PostgreSQL", abstract: "A workshop through deploying PostgreSQL on Kubernetes.", abstract_zh: "在 Kubernetes 上部署 PostgreSQL 的动手实践。", duration: 60, type: "workshop", status: "pending", admin_feedback: null, slides_url: null, video_url: null, created_at: "2027-01-25", profiles: { full_name: "Ma Chao", company: "DaoCloud" } },
  { id: "ms6", user_id: "u6", title: "PostgreSQL in Gaming: Handling Millions of Concurrent Players", title_zh: "PostgreSQL 在游戏行业：处理百万并发玩家", abstract: "How NetEase uses PostgreSQL for 50M+ DAU game state.", abstract_zh: "网易如何使用 PostgreSQL 管理游戏状态。", duration: 45, type: "talk", status: "approved", admin_feedback: "Excellent topic! Very relevant.", slides_url: null, video_url: null, created_at: "2027-01-10", profiles: { full_name: "Huang Wei", company: "NetEase" } },
  { id: "ms7", user_id: "u7", title: "Comparing ORMs for PostgreSQL", title_zh: "PostgreSQL ORM 对比", abstract: "A comparison of TypeScript ORMs.", abstract_zh: "TypeScript ORM 比较。", duration: 30, type: "talk", status: "rejected", admin_feedback: "Too niche for main track.", slides_url: null, video_url: null, created_at: "2027-01-05", profiles: { full_name: "Liu Yang", company: "ByteDance" } },
]



function statusBadge(status: string, locale: "en" | "zh") {
  switch (status) {
    case "pending": return <Badge variant="secondary">{cfpT.pending[locale]}</Badge>
    case "approved": return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{cfpT.approved[locale]}</Badge>
    case "waitlisted": return <Badge className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">{cfpT.waitlisted[locale]}</Badge>
    case "rejected": return <Badge variant="destructive">{cfpT.rejected[locale]}</Badge>
    default: return <Badge variant="outline">{status}</Badge>
  }
}

async function fetchSessionData() {
  const supabase = createClient()
  const [proposals, speakers] = await Promise.all([
    supabase.from("sessions").select("*, profiles!sessions_user_id_fkey(full_name, company)").order("created_at", { ascending: false }),
    supabase.from("published_speakers").select("id, name, name_zh").order("sort_order"),
  ])
  if (proposals.error) throw proposals.error
  if (speakers.error) throw speakers.error
  return { sessions: (proposals.data as unknown as SessionWithProfile[]) || [], speakers: (speakers.data as PublishedSpeakerOption[]) || [] }
}

export default function AdminSessionsPage() {
  const mock = isMockMode()
  const locale = useLocale()
  const [sessions, setSessions] = useState<SessionWithProfile[]>(() => mock ? mockSessions.map((session) => ({ ...session, speaker_id: session.status === "approved" ? "mock-speaker-1" : null, publication_status: "draft", published_at: null })) : [])
  const [publishedSpeakers, setPublishedSpeakers] = useState<PublishedSpeakerOption[]>(() => mock ? mockPublishedSpeakers : [])
  const [loading, setLoading] = useState(!mock)
  const [loadError, setLoadError] = useState(false)
  const [filter, setFilter] = useState<"all" | ProposalReviewStatus>("pending")
  const [search, setSearch] = useState("")
  const [feedback, setFeedback] = useState("")
  const [uploading, setUploading] = useState(false)
  const savingReview = useRef(false)
  const [reviewBusy, setReviewBusy] = useState(false)

  const loadSessions = useCallback(async () => {
    if (mock) return
    try {
      const data = await fetchSessionData()
      setSessions(data.sessions)
      setPublishedSpeakers(data.speakers)
      setLoadError(false)
    } catch {
      setLoadError(true)
      toast.error(locale === "zh" ? "议题加载失败" : "Unable to load proposals")
    }
    setLoading(false)
  }, [locale, mock])

  useEffect(() => {
    if (mock) return
    let cancelled = false
    fetchSessionData()
      .then((data) => { if (!cancelled) { setSessions(data.sessions); setPublishedSpeakers(data.speakers) } })
      .catch(() => { if (!cancelled) setLoadError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [mock])

  async function updateStatus(id: string, status: ProposalDecision, feedbackText?: string) {
    const current = sessions.find(session => session.id === id)
    if (savingReview.current || !current || current.status === status) return
    if (status === "waitlisted" && current.publication_status === "published") return
    const success = locale === "zh" ? `审核状态已更新：${cfpT[status].zh}` : `Review status updated: ${cfpT[status].en}`
    if (isMockMode()) {
      setSessions(prev => prev.map(s => s.id === id ? {
        ...s,
        status,
        admin_feedback: feedbackText ?? s.admin_feedback,
        ...(status === "approved" ? {} : { speaker_id: null, publication_status: "draft", published_at: null }),
      } : s))
      toast.success(success)
      return
    }
    savingReview.current = true
    setReviewBusy(true)
    try {
      const supabase = createClient()
      if (status !== "approved" && current.publication_status === "published") {
        const result = await unpublishSession(id)
        if (!result.ok) throw new Error(result.message)
      }
      const update: Record<string, string | null> = { status }
      if (feedbackText !== undefined) update.admin_feedback = feedbackText
      if (status !== "approved") update.speaker_id = null
      const { data, error } = await supabase.from("sessions").update(update).eq("id", id).eq("status", current.status).select("id").maybeSingle()
      if (error || !data) throw error || new Error("review_status_changed")
      toast.success(success)
      await loadSessions()
    } catch { toast.error(locale === "zh" ? "操作失败，请稍后重试" : "Action failed. Please try again.") }
    finally { savingReview.current = false; setReviewBusy(false) }
  }

  async function assignSpeaker(sessionId: string, speakerId: string) {
    const value = speakerId === "unassigned" ? null : speakerId
    if (isMockMode()) {
      setSessions((current) => current.map((session) => session.id === sessionId
        ? { ...session, speaker_id: value, updated_at: new Date().toISOString() }
        : session))
      return
    }

    const supabase = createClient()
    const { error } = await supabase.from("sessions").update({ speaker_id: value }).eq("id", sessionId)
    if (error) {
      toast.error(locale === "zh" ? "讲者绑定失败" : "Unable to assign speaker")
      return
    }
    toast.success(locale === "zh" ? "讲者绑定已保存" : "Speaker assignment saved")
    loadSessions()
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
      await uploadSessionMedia(createClient(), id, file, type)
      toast.success(type === "slides" ? adminT.pptUploaded[locale] : adminT.videoUploaded[locale])
      await loadSessions()
    } catch { toast.error(locale === "zh" ? "附件上传或保存失败，请重试。" : "Unable to upload or save media. Please try again.") }
    finally { setUploading(false) }
  }

  const filtered = sessions.filter((s) => {
    const statusMatch = filter === "all" || s.status === filter
    const q = search.toLowerCase()
    const searchMatch = !q || [s.title,s.title_zh,s.proposal_details?.full_name,s.profiles?.full_name,s.guest_email,s.id].some(value => value?.toLowerCase().includes(q))
    return statusMatch && searchMatch
  })
  const guests = filtered.filter(session => session.guest_email)

  function exportGuests() {
    if (!isProposalDecision(filter)) return
    const { csv } = notificationCsv(guests.map(session => ({
      name: session.proposal_details?.full_name || "",
      email: session.guest_email ?? null,
      proposal_title: session.title,
      proposal_status: filter,
      proposal_type: topicTypes.find(type => type === session.type) ?? null,
      proposal_duration: session.duration,
    })), "result", locale === "zh")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `how-guest-proposals-${filter}.csv`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold">{adminT.sessionProposals[locale]}</h1>
        {mock && <Badge variant="outline" className="text-amber-400 border-amber-800">{adminT.demo[locale]}</Badge>}
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        {mock ? adminT.demoMode[locale] : (locale === "zh" ? "讲师提交的议题在这里查看、审核和管理。" : "View, review and manage speaker proposals here.")}
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={adminT.searchProposals[locale]} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-40" aria-label={locale === "zh" ? "审核状态" : "Review status"}><Filter className="size-4" /><SelectValue>{filter === "all" ? adminT.all[locale] : cfpT[filter][locale]}</SelectValue></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{adminT.all[locale]}</SelectItem>
            <SelectItem value="pending">{cfpT.pending[locale]}</SelectItem>
            <SelectItem value="approved">{cfpT.approved[locale]}</SelectItem>
            <SelectItem value="waitlisted">{cfpT.waitlisted[locale]}</SelectItem>
            <SelectItem value="rejected">{cfpT.rejected[locale]}</SelectItem>
          </SelectContent>
        </Select>
        {isProposalDecision(filter) && <Button size="sm" variant="outline"
          render={<Link href={`/admin/notifications?audience=${filter}&mode=result&query=${encodeURIComponent(search.trim())}`} />} nativeButton={false}>
          {locale === "zh" ? "通知 / 导出账号投稿" : "Notify or export account proposals"}
        </Button>}
        {isProposalDecision(filter) && guests.length > 0 && <Button size="sm" variant="outline" onClick={exportGuests}>
          <Download />{locale === "zh" ? "导出访客投稿邮箱" : "Export guest emails"}
        </Button>}
      </div>

      {loading ? (
        <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full bg-zinc-800" />)}</div>
      ) : loadError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 py-12 text-muted-foreground"><p>{locale === "zh" ? "议题暂时无法加载" : "Proposals are temporarily unavailable"}</p><Button variant="outline" onClick={loadSessions}>{locale === "zh" ? "重试" : "Retry"}</Button></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground"><p>{adminT.noSessions[locale]}</p></div>
      ) : (
        <div className="space-y-4">
          {filtered.map((session) => {
            const details = session.proposal_details
            const speakerName = details?.full_name || session.profiles?.full_name
            const speakerLine = [speakerName, details?.company || session.profiles?.company, details?.position].filter(Boolean).join(" · ")
            const kind = topicTypes.find(type => type === session.type)
            const kindLabel = kind ? topicLabels[kind][locale === "zh" ? 0 : 1] : session.type
            return <Card key={session.id}>
              <CardContent className="p-5">
                <div className="flex flex-col items-start justify-between gap-4 lg:flex-row">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      {statusBadge(session.status, locale)}
                      <PublicationBadge
                        status={session.publication_status ?? "draft"}
                        publishedAt={session.published_at ?? null}
                        updatedAt={session.updated_at ?? session.created_at}
                        locale={locale}
                      />
                      <Badge variant="outline">{session.duration} {locale === "zh" ? "分钟" : "min"} · {kindLabel}</Badge>
                      {details && <Badge variant="outline">{details.language === "zh" ? "中文" : "English"}</Badge>}
                      {session.guest_email && <Badge variant="outline">{locale === "zh" ? "访客投稿" : "Guest proposal"}</Badge>}
                    </div>
                    <h3 className="break-words font-medium text-lg mb-1">{session.title}</h3>
                    {session.title_zh && <p className="text-sm text-muted-foreground mb-2">{session.title_zh}</p>}
                    <p className="text-sm text-zinc-400 line-clamp-2 mb-2">{session.abstract}</p>
                    <p className="break-words text-xs text-muted-foreground">{speakerLine}</p>
                    {session.guest_email && <p className="break-words text-xs text-muted-foreground">
                      {locale === "zh" ? "联系邮箱（未验证）：" : "Contact email (unverified): "}{session.guest_email}
                    </p>}
                    {session.admin_feedback && (
                      <div className="mt-3 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                        <p className="text-xs text-muted-foreground mb-1">{adminT.adminFeedback[locale]}:</p>
                        <p className="text-sm text-zinc-300">{session.admin_feedback}</p>
                      </div>
                    )}

                    {(session.status === "approved" || session.publication_status === "published") && (
                      <div className="mt-4 border-t border-zinc-800 pt-4">
                        <p className="mb-3 text-xs font-medium uppercase text-muted-foreground">
                          {adminT.websitePublication[locale]}
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                          <Select value={session.speaker_id ?? "unassigned"} onValueChange={(value) => assignSpeaker(session.id, value ?? "unassigned")}>
                            <SelectTrigger className="w-full sm:w-64">
                              <SelectValue placeholder={adminT.assignPublishedSpeaker[locale]}>
                                {session.speaker_id
                                  ? (() => {
                                      const speaker = publishedSpeakers.find((item) => item.id === session.speaker_id)
                                      if (!speaker) return adminT.assignPublishedSpeaker[locale]
                                      return locale === "zh" ? (speaker.name_zh ?? speaker.name) : speaker.name
                                    })()
                                  : adminT.noPublishedSpeaker[locale]}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">{adminT.noPublishedSpeaker[locale]}</SelectItem>
                              {publishedSpeakers.map((speaker) => (
                                <SelectItem key={speaker.id} value={speaker.id}>
                                  {locale === "zh" ? (speaker.name_zh ?? speaker.name) : speaker.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {!mock && (session.speaker_id || session.publication_status === "published") && (
                            <PublicationActions
                              id={session.id}
                              locale={locale}
                              kind="session"
                              status={session.publication_status ?? "draft"}
                              publishDisabled={!session.speaker_id || session.status !== "approved"}
                              hasPendingChanges={session.publication_status === "published" && Boolean(session.published_at && (session.updated_at ?? session.created_at) > session.published_at)}
                              onCompleted={loadSessions}
                            />
                          )}
                          {!session.speaker_id && (
                            <span className="text-sm text-muted-foreground">{adminT.publishRequiresSpeaker[locale]}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex max-w-full flex-wrap items-center gap-2 lg:shrink-0">
                    {(session.status === "pending" || session.status === "waitlisted") && (
                      <>
                        <Button size="sm" variant="outline" disabled={reviewBusy} onClick={() => updateStatus(session.id, "approved")}>
                          <CheckCircle className="size-4" /> {locale === "zh" ? "录取" : "Accept"}
                        </Button>
                        {session.status === "pending" && <Button size="sm" variant="outline" disabled={reviewBusy} onClick={() => updateStatus(session.id,"waitlisted")}>
                          <Clock className="size-4" />{locale === "zh" ? "列为候补" : "Waitlist"}
                        </Button>}
                        <Dialog>
                          <DialogTrigger render={<Button size="sm" variant="outline" disabled={reviewBusy} />} onClick={() => setFeedback("")}>
                              <XCircle className="size-4" /> {locale === "zh" ? "不录取" : "Decline"}
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>{locale === "zh" ? "不录取该提案" : "Decline proposal"}</DialogTitle></DialogHeader>
                            <div className="space-y-3">
                              <Label>{adminT.feedback[locale]} (optional)</Label>
                              <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder={adminT.explainReject[locale]} rows={3} />
                              <Button variant="destructive" disabled={reviewBusy} onClick={() => updateStatus(session.id, "rejected", feedback)}>{locale === "zh" ? "确认不录取" : "Confirm decline"}</Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </>
                    )}

                    <Dialog>
                      <DialogTrigger render={<Button size="sm" variant="outline" className="border-zinc-700 text-zinc-400 hover:text-white" />} onClick={() => setFeedback(session.admin_feedback || "")}>
                          <Eye className="h-4 w-4 mr-1" /> {adminT.detail[locale]}
                      </DialogTrigger>
                      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
                        <DialogHeader><DialogTitle className="break-words">{session.title}</DialogTitle></DialogHeader>
                        <div className="space-y-4">
                          <div><Label>{adminT.speaker[locale]}</Label><p className="break-words text-sm">{speakerLine}</p></div>
                          <div><Label>{details ? (locale === "zh" ? "议题简介" : "Abstract") : adminT.abstractEn[locale]}</Label><p className="whitespace-pre-wrap break-words text-sm">{session.abstract}</p></div>
                          {session.abstract_zh && <div><Label className="text-zinc-400">{adminT.abstractZh[locale]}</Label><p className="text-sm text-zinc-300">{session.abstract_zh}</p></div>}
                          {details?.outline && <div><Label>{locale === "zh" ? "议题大纲" : "Outline"}</Label><p className="whitespace-pre-wrap break-words text-sm">{details.outline}</p></div>}
                          {details && <div><Label>{locale === "zh" ? "个人简介" : "Speaker bio"}</Label><p className="whitespace-pre-wrap break-words text-sm">{details.bio}</p></div>}
                          {details?.photo_url && session.user_id && ownedProposalPhoto(details.photo_url,session.user_id) && <a className="text-sm underline underline-offset-4" href={details.photo_url} target="_blank" rel="noopener noreferrer">{locale === "zh" ? "查看个人照片" : "View speaker photo"}</a>}
                          <div className="flex flex-wrap gap-2 items-center">
                            <Badge variant="outline">{session.duration} min</Badge>
                            <Badge variant="outline">{kindLabel}</Badge>
                            {statusBadge(session.status, locale)}
                          </div>
                          {(session.status === "approved" || session.status === "rejected") && (
                            <div className="flex flex-wrap items-center gap-2">
                              <Button size="sm" variant="outline" disabled={reviewBusy} onClick={() => updateStatus(session.id, session.status === "approved" ? "rejected" : "approved")}>
                                {session.status === "approved" ? (locale === "zh" ? "改为未录取" : "Move to declined") : (locale === "zh" ? "改为已录取" : "Move to accepted")}
                              </Button>
                              <Button size="sm" variant="outline" disabled={reviewBusy || session.publication_status === "published"} onClick={() => updateStatus(session.id, "waitlisted")}>
                                <Clock className="size-4" />{locale === "zh" ? "移至候补" : "Move to waitlist"}
                              </Button>
                              {session.publication_status === "published" && <p className="text-sm text-muted-foreground">{locale === "zh" ? "下架后可移至候补。" : "Unpublish before moving to the waitlist."}</p>}
                            </div>
                          )}
                          <div className="border-t border-zinc-800 pt-4">
                            <h4 className="text-sm font-medium text-zinc-300 mb-3">{adminT.sessionMaterials[locale]}</h4>
                            <div className="flex flex-wrap gap-3">
                              <label className="cursor-pointer">
                                <input type="file" accept=".pdf,.ppt,.pptx,.key" disabled={uploading} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMedia(session.id, f, "slides") }} />
                                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-800"><FileText className="h-4 w-4" /> {adminT.uploadPpt[locale]}</span>
                              </label>
                              <label className="cursor-pointer">
                                <input type="file" accept="video/*" disabled={uploading} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMedia(session.id, f, "video") }} />
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
          })}
        </div>
      )}
    </div>
  )
}
