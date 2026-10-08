"use client"

import { useLocale } from "@/lib/i18n/provider"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Pencil, Plus, UserRound } from "lucide-react"
import { toast } from "sonner"
import { PublicationActions } from "@/components/admin/publication-actions"
import { PublicationBadge } from "@/components/admin/publication-badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import type { Speaker } from "@/lib/db/schema"
import { mockProducers } from "@/lib/mock-data"
import { createClient } from "@/lib/supabase/client"
import { isMockMode } from "@/lib/utils"

type SpeakerFormState = {
  name: string
  name_zh: string
  company: string
  company_zh: string
  title: string
  title_zh: string
  bio: string
  bio_zh: string
  avatar_url: string
  profile_id: string
  sort_order: string
}

const emptyForm: SpeakerFormState = {
  name: "",
  name_zh: "",
  company: "",
  company_zh: "",
  title: "",
  title_zh: "",
  bio: "",
  bio_zh: "",
  avatar_url: "",
  profile_id: "",
  sort_order: "0",
}


function getMockSpeakers(): Speaker[] {
  const now = new Date().toISOString()
  return Object.values(mockProducers).map((speaker, index) => ({
    id: `mock-speaker-${index + 1}`,
    profile_id: null,
    name: speaker.name,
    name_zh: speaker.name_zh,
    company: null,
    company_zh: null,
    title: speaker.title,
    title_zh: speaker.title_zh,
    bio: speaker.bio,
    bio_zh: speaker.bio_zh,
    avatar_url: speaker.photo_url,
    sort_order: index,
    publication_status: "published",
    published_at: now,
    published_by: null,
    created_at: now,
    updated_at: now,
  }))
}

function toForm(speaker: Speaker): SpeakerFormState {
  return {
    name: speaker.name,
    name_zh: speaker.name_zh ?? "",
    company: speaker.company ?? "",
    company_zh: speaker.company_zh ?? "",
    title: speaker.title ?? "",
    title_zh: speaker.title_zh ?? "",
    bio: speaker.bio ?? "",
    bio_zh: speaker.bio_zh ?? "",
    avatar_url: speaker.avatar_url ?? "",
    profile_id: speaker.profile_id ?? "",
    sort_order: String(speaker.sort_order),
  }
}

async function fetchSpeakerRows() {
  const supabase = createClient()
  const { data, error } = await supabase.from("speakers").select("*").order("sort_order")
  if (error) throw error
  return (data ?? []) as Speaker[]
}

export default function AdminSpeakersPage() {
  const locale = useLocale()
  const mockMode = isMockMode()
  const [speakers, setSpeakers] = useState<Speaker[]>(() => mockMode ? getMockSpeakers() : [])
  const [loading, setLoading] = useState(!mockMode)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Speaker | null>(null)
  const [form, setForm] = useState<SpeakerFormState>(emptyForm)

  const sortedSpeakers = useMemo(
    () => [...speakers].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [speakers]
  )

  const loadSpeakers = useCallback(async () => {
    if (mockMode) return

    try {
      setSpeakers(await fetchSpeakerRows())
    } catch {
      toast.error(locale === "zh" ? "讲者数据加载失败" : "Unable to load speakers")
    } finally {
      setLoading(false)
    }
  }, [locale, mockMode])

  useEffect(() => {
    if (mockMode) return
    let cancelled = false

    fetchSpeakerRows()
      .then((rows) => {
        if (!cancelled) setSpeakers(rows)
      })
      .catch(() => {
        if (!cancelled) toast.error(locale === "zh" ? "讲者数据加载失败" : "Unable to load speakers")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [locale, mockMode])

  function openEditor(speaker?: Speaker) {
    setEditing(speaker ?? null)
    setForm(speaker ? toForm(speaker) : emptyForm)
    setOpen(true)
  }

  function setField<K extends keyof SpeakerFormState>(key: K, value: SpeakerFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function saveSpeaker(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    const now = new Date().toISOString()
    const payload = {
      name: form.name.trim(),
      name_zh: form.name_zh.trim() || null,
      company: form.company.trim() || null,
      company_zh: form.company_zh.trim() || null,
      title: form.title.trim() || null,
      title_zh: form.title_zh.trim() || null,
      bio: form.bio.trim() || null,
      bio_zh: form.bio_zh.trim() || null,
      avatar_url: form.avatar_url.trim() || null,
      profile_id: form.profile_id.trim() || null,
      sort_order: Number.parseInt(form.sort_order, 10) || 0,
    }

    try {
      if (mockMode) {
        if (editing) {
          setSpeakers((current) => current.map((speaker) => speaker.id === editing.id
            ? { ...speaker, ...payload, updated_at: now }
            : speaker))
        } else {
          setSpeakers((current) => [...current, {
            ...payload,
            id: `mock-speaker-${Date.now()}`,
            publication_status: "draft",
            published_at: null,
            published_by: null,
            created_at: now,
            updated_at: now,
          }])
        }
      } else {
        const supabase = createClient()
        const query = editing
          ? supabase.from("speakers").update(payload).eq("id", editing.id).select("*").single()
          : supabase.from("speakers").insert(payload).select("*").single()
        const { data, error } = await query
        if (error) throw error
        const saved = data as Speaker
        setSpeakers((current) => editing
          ? current.map((speaker) => speaker.id === saved.id ? saved : speaker)
          : [...current, saved])
      }

      toast.success(locale === "zh" ? "讲者资料已保存" : "Speaker saved")
      setOpen(false)
    } catch {
      toast.error(locale === "zh" ? "保存失败，请检查账户关联和输入内容" : "Unable to save. Check the account link and fields.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{locale === "zh" ? "讲者管理" : "Speakers"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {locale === "zh" ? "编辑草稿不会影响官网，只有发布后才会更新公开资料。" : "Draft edits stay private until you publish them."}
          </p>
        </div>
        <Button onClick={() => openEditor()}><Plus />{locale === "zh" ? "添加讲者" : "Add speaker"}</Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-28 w-full" />)}</div>
      ) : sortedSpeakers.length === 0 ? (
        <div className="border-y py-16 text-center text-muted-foreground">
          <UserRound className="mx-auto mb-3 size-8" />
          <p>{locale === "zh" ? "还没有讲者草稿" : "No speaker drafts yet"}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {sortedSpeakers.map((speaker) => {
            const hasPendingChanges = speaker.publication_status === "published" &&
              speaker.published_at !== null && speaker.updated_at > speaker.published_at
            return (
              <Card key={speaker.id} className="rounded-lg">
                <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
                  <Avatar className="size-14" size="lg">
                    {speaker.avatar_url && <AvatarImage src={speaker.avatar_url} alt={speaker.name} />}
                    <AvatarFallback>{speaker.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{locale === "zh" && speaker.name_zh ? speaker.name_zh : speaker.name}</h2>
                      <PublicationBadge
                        status={speaker.publication_status}
                        publishedAt={speaker.published_at}
                        updatedAt={speaker.updated_at}
                        locale={locale}
                      />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[locale === "zh" ? speaker.title_zh || speaker.title : speaker.title, locale === "zh" ? speaker.company_zh || speaker.company : speaker.company]
                        .filter(Boolean).join(" · ") || (locale === "zh" ? "职位和单位待补充" : "Role and company not set")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{locale === "zh" ? "排序" : "Order"}: {speaker.sort_order}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEditor(speaker)}><Pencil />{locale === "zh" ? "编辑" : "Edit"}</Button>
                    {!mockMode && (
                      <PublicationActions
                        id={speaker.id}
                        kind="speaker"
                        locale={locale}
                        status={speaker.publication_status}
                        hasPendingChanges={hasPendingChanges}
                        onCompleted={loadSpeakers}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? (locale === "zh" ? "编辑讲者" : "Edit speaker") : (locale === "zh" ? "添加讲者" : "Add speaker")}</DialogTitle>
            <DialogDescription>{locale === "zh" ? "英文名称为必填，其余双语字段可按已有信息补充。" : "English name is required; add bilingual details as available."}</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveSpeaker} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="speaker-name">Name</Label><Input id="speaker-name" value={form.name} onChange={(e) => setField("name", e.target.value)} required /></div>
              <div className="space-y-2"><Label htmlFor="speaker-name-zh">姓名</Label><Input id="speaker-name-zh" value={form.name_zh} onChange={(e) => setField("name_zh", e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="speaker-company">Company</Label><Input id="speaker-company" value={form.company} onChange={(e) => setField("company", e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="speaker-company-zh">单位（中文）</Label><Input id="speaker-company-zh" value={form.company_zh} onChange={(e) => setField("company_zh", e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="speaker-title">Title</Label><Input id="speaker-title" value={form.title} onChange={(e) => setField("title", e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="speaker-title-zh">职位（中文）</Label><Input id="speaker-title-zh" value={form.title_zh} onChange={(e) => setField("title_zh", e.target.value)} /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="speaker-bio">Bio</Label><Textarea id="speaker-bio" value={form.bio} onChange={(e) => setField("bio", e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="speaker-bio-zh">简介（中文）</Label><Textarea id="speaker-bio-zh" value={form.bio_zh} onChange={(e) => setField("bio_zh", e.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="speaker-avatar">Avatar URL</Label><Input id="speaker-avatar" type="url" value={form.avatar_url} onChange={(e) => setField("avatar_url", e.target.value)} placeholder="https://..." /></div>
            <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
              <div className="space-y-2"><Label htmlFor="speaker-profile">{locale === "zh" ? "关联账户 ID（可选）" : "Linked profile ID (optional)"}</Label><Input id="speaker-profile" value={form.profile_id} onChange={(e) => setField("profile_id", e.target.value)} placeholder="UUID" /></div>
              <div className="space-y-2"><Label htmlFor="speaker-order">{locale === "zh" ? "排序" : "Sort order"}</Label><Input id="speaker-order" type="number" value={form.sort_order} onChange={(e) => setField("sort_order", e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>{locale === "zh" ? "取消" : "Cancel"}</Button>
              <Button type="submit" disabled={saving}>{saving ? (locale === "zh" ? "保存中" : "Saving") : (locale === "zh" ? "保存" : "Save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
