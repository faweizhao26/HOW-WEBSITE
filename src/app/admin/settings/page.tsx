"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { Save, Send } from "lucide-react"
import { toast } from "sonner"
import { publishSiteSettings } from "@/app/admin/actions/publication"
import { PublicationActions } from "@/components/admin/publication-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { conference } from "@/lib/conference"
import { defaultSiteSettings, hasSettingsChanges, validateSettingsDraft } from "@/lib/content/settings"
import type { SiteSettingsRelease } from "@/lib/db/schema"
import { admin as adminT } from "@/lib/i18n/translations"
import type { Locale } from "@/lib/i18n/utils"
import { createClient } from "@/lib/supabase/client"
import { isMockMode } from "@/lib/utils"

type SettingsData = { draft: Record<string, string>; releases: SiteSettingsRelease[] }

function getLocaleFromCookie(): Locale {
  if (typeof document === "undefined") return "en"
  return document.cookie.match(/(?:^|;\s*)lang=([^;]*)/)?.[1] === "zh" ? "zh" : "en"
}

async function fetchSettings(): Promise<SettingsData> {
  const supabase = createClient()
  const [draft, releases] = await Promise.all([
    supabase.from("site_settings").select("key, value"),
    supabase.from("site_settings_releases").select("*").order("version", { ascending: false }),
  ])
  if (draft.error) throw draft.error
  if (releases.error) throw releases.error
  return { draft: Object.fromEntries((draft.data ?? []).map((row: { key: string; value: string }) => [row.key, row.value])), releases: (releases.data ?? []) as SiteSettingsRelease[] }
}

export default function AdminSettingsPage() {
  const [locale] = useState<Locale>(getLocaleFromCookie)
  const mockMode = isMockMode()
  const [data, setData] = useState<SettingsData>(() => ({ draft: mockMode ? { ...defaultSiteSettings } : {}, releases: [] }))
  const [settings, setSettings] = useState<Record<string, string>>(() => mockMode ? { ...defaultSiteSettings } : {})
  const [loading, setLoading] = useState(!mockMode)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [publishing, startPublishing] = useTransition()
  const [publishError, setPublishError] = useState("")

  const loadSettings = useCallback(async () => {
    if (mockMode) return
    try {
      const rows = await fetchSettings()
      setData(rows)
      setSettings(rows.draft)
      setLoadError(false)
    } catch {
      setLoadError(true)
      toast.error(locale === "zh" ? "设置加载失败" : "Unable to load settings")
    } finally { setLoading(false) }
  }, [locale, mockMode])

  useEffect(() => {
    if (mockMode) return
    let cancelled = false
    fetchSettings()
      .then((rows) => { if (!cancelled) { setData(rows); setSettings(rows.draft) } })
      .catch(() => { if (!cancelled) setLoadError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [mockMode])

  const currentRelease = data.releases.find((release) => release.is_current)
  const unsaved = hasSettingsChanges(settings, data.draft)
  const pending = hasSettingsChanges(data.draft, currentRelease?.payload ?? null)

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const draft = Object.fromEntries(Object.entries(settings).map(([key, value]) => [key, value.trim()]))
      if (!mockMode) {
        const { error } = await createClient().from("site_settings").upsert(Object.entries(draft).map(([key, value]) => ({ key, value })))
        if (error) throw error
      }
      setSettings(draft)
      setData((current) => ({ ...current, draft }))
      setPublishError("")
      toast.success(locale === "zh" ? "设置草稿已保存" : "Settings draft saved")
    } catch { toast.error(locale === "zh" ? "保存失败" : "Unable to save settings") }
    finally { setSaving(false) }
  }

  function publish() {
    if (unsaved) { setPublishError(locale === "zh" ? "请先保存草稿。" : "Save the draft first."); return }
    const issue = validateSettingsDraft(data.draft)
    if (issue) {
      setPublishError(issue === "required"
        ? (locale === "zh" ? "请补全大会信息和中英文首页标题。" : "Complete the conference information and both hero translations.")
        : (locale === "zh" ? "大会日期必须为 2027.4.16-4.18。" : "The conference period must be 2027.4.16-4.18."))
      return
    }
    setPublishError("")
    startPublishing(async () => {
      const result = await publishSiteSettings()
      if (!result.ok) { setPublishError(result.message); return }
      toast.success(locale === "zh" ? "整版设置已发布" : "Complete settings published")
      await loadSettings()
    })
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-52" /><Skeleton className="h-36" /><Skeleton className="h-36" /></div>

  const fields = [
    { key: "conference_name", label: adminT.conferenceName[locale] },
    { key: "conference_date", label: adminT.conferenceDate[locale], placeholder: conference.settingDate },
    { key: "conference_location", label: adminT.locationEn[locale] },
    { key: "conference_location_zh", label: adminT.locationZh[locale] },
    { key: "cfp_deadline", label: adminT.cfpDeadline[locale], type: "date" },
    { key: "register_url", label: adminT.registerUrl[locale], type: "url", placeholder: "https://..." },
    { key: "contact_email", label: adminT.contactEmail[locale], type: "email", placeholder: "faweizhao26@gmail.com" },
  ]
  const heroFields = [
    { key: "hero_title", label: adminT.heroTitleEn[locale] },
    { key: "hero_title_zh", label: adminT.heroTitleZh[locale] },
    { key: "hero_subtitle", label: adminT.heroSubtitleEn[locale] },
    { key: "hero_subtitle_zh", label: adminT.heroSubtitleZh[locale] },
  ]

  return (
    <form onSubmit={saveSettings} className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{adminT.siteSettings[locale]}</h1>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="outline" disabled={saving || publishing || loadError}><Save />{saving ? adminT.saving[locale] : (locale === "zh" ? "保存草稿" : "Save draft")}</Button>
          {!mockMode && <Button type="button" onClick={publish} disabled={saving || publishing || loadError}><Send />{publishing ? (locale === "zh" ? "发布中" : "Publishing") : (locale === "zh" ? "发布整版设置" : "Publish complete settings")}</Button>}
        </div>
      </div>
      <div className="space-y-2 border-y py-4 text-sm text-muted-foreground">
        <p>{currentRelease ? `${locale === "zh" ? "当前公开版本" : "Current public release"}: v${currentRelease.version} · ${new Date(currentRelease.published_at).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}` : (locale === "zh" ? "尚未发布网站设置" : "No settings release yet")}</p>
        <Badge variant="outline">{unsaved ? (locale === "zh" ? "有未保存修改" : "Unsaved changes") : pending ? (locale === "zh" ? "草稿待发布" : "Draft pending publication") : (locale === "zh" ? "与公开版本一致" : "Matches public release")}</Badge>
        {publishError && <p role="alert" className="text-red-700 dark:text-red-400">{publishError}</p>}
      </div>
      {loadError ? <div className="flex flex-wrap items-center gap-3 text-muted-foreground"><p>{locale === "zh" ? "设置加载失败" : "Unable to load settings"}</p><Button type="button" variant="outline" onClick={loadSettings}>{locale === "zh" ? "重试" : "Retry"}</Button></div> : <>
        <section className="space-y-5"><h2 className="text-lg font-semibold">{adminT.conferenceInfo[locale]}</h2><div className="grid gap-5 sm:grid-cols-2">{fields.map(({ key, label, type, placeholder }) => <div key={key} className="space-y-2"><Label htmlFor={`setting-${key}`}>{label}</Label><Input id={`setting-${key}`} type={type || "text"} value={settings[key] || ""} placeholder={placeholder} disabled={saving || publishing} onChange={(event) => setSettings((current) => ({ ...current, [key]: event.target.value }))} /></div>)}</div></section>
        <section className="space-y-5 border-t pt-6"><h2 className="text-lg font-semibold">{adminT.heroSection[locale]}</h2><div className="grid gap-5 sm:grid-cols-2">{heroFields.map(({ key, label }) => <div key={key} className="space-y-2"><Label htmlFor={`setting-${key}`}>{label}</Label><Input id={`setting-${key}`} value={settings[key] || ""} disabled={saving || publishing} onChange={(event) => setSettings((current) => ({ ...current, [key]: event.target.value }))} /></div>)}</div></section>
      </>}
      {data.releases.length > 0 && <section className="border-t pt-6"><h2 className="mb-3 text-lg font-semibold">{locale === "zh" ? "发布历史" : "Release history"}</h2><div className="divide-y">{data.releases.map((release) => <div key={release.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="text-sm">v{release.version} · {new Date(release.published_at).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}{release.is_current && <Badge className="ml-2" variant="outline">{locale === "zh" ? "当前" : "Current"}</Badge>}</span>{!release.is_current && <PublicationActions id={release.id} kind="settings-release" locale={locale} onCompleted={loadSettings} />}</div>)}</div></section>}
    </form>
  )
}
