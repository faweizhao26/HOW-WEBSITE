"use client"

import { useLocale } from "@/lib/i18n/provider"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { Eye, Save, Send } from "lucide-react"
import { toast } from "sonner"
import { publishSiteSettings } from "@/app/admin/actions/publication"
import { PublicationActions } from "@/components/admin/publication-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { MediaUploadContext } from "@/components/admin/site-media-field"
import { SettingsPreview } from "@/components/admin/settings-preview"
import { UnsavedSettingsGuard } from "@/components/admin/unsaved-settings-guard"
import { getSettingsIssues } from "@/lib/content/settings-validation"
import { SiteContentEditor } from "@/components/admin/site-content-editor"
import { parseSiteContent, parseSiteContentDraft } from "@/lib/content/site-content"
import { Skeleton } from "@/components/ui/skeleton"
import { conference } from "@/lib/conference"
import { defaultSiteSettings, hasSettingsChanges } from "@/lib/content/settings"
import { cfpDurations, cfpSessionTypes, defaultCFPSettings } from "@/lib/cfp/settings"
import type { SiteSettingsRelease } from "@/lib/db/schema"
import { admin as adminT, cfp as cfpT } from "@/lib/i18n/translations"
import { createClient } from "@/lib/supabase/client"
import { isMockMode } from "@/lib/utils"

type SettingsData = { draft: Record<string, string>; releases: SiteSettingsRelease[] }

function selectedOptions(value: string | undefined, fallback: string, options: readonly (string | number)[]) {
  try {
    const values = JSON.parse(value || fallback)
    return Array.isArray(values) ? options.filter(option => values.includes(option)) : []
  } catch { return [] }
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
  const locale = useLocale()
  const mockMode = isMockMode()
  const [data, setData] = useState<SettingsData>(() => ({ draft: mockMode ? { ...defaultSiteSettings } : {}, releases: [] }))
  const [settings, setSettings] = useState<Record<string, string>>(() => mockMode ? { ...defaultSiteSettings } : {})
  const [loading, setLoading] = useState(!mockMode)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [publishing, startPublishing] = useTransition()
  const [publishError, setPublishError] = useState("")
  const [uploads, setUploads] = useState(0)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [validationAttempted, setValidationAttempted] = useState(false)
  const issues = useMemo(() => validationAttempted ? getSettingsIssues(settings) : [], [settings, validationAttempted])
  const busy = saving || publishing || uploads > 0
  const reportUpload = useCallback((active: boolean) => setUploads(count => Math.max(0, count + (active ? 1 : -1))), [])

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
    if (busy) return
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

  function locateIssue(path: string) {
    let target: HTMLElement | null = null
    const parts = path.split(".")
    while (parts.length && !target) {
      target = document.querySelector<HTMLElement>(`[data-setting-path="${CSS.escape(parts.join("."))}"]`)
      parts.pop()
    }
    target ||= document.querySelector<HTMLElement>('[data-setting-path="site_content"]')
    if (!target) return
    for (let parent: HTMLElement | null = target; parent; parent = parent.parentElement) if (parent instanceof HTMLDetailsElement) parent.open = true
    const control = target.matches("input,textarea,button") ? target : target.querySelector<HTMLElement>("input:not([type=hidden]),textarea,button,summary")
    target.scrollIntoView({ block: "center", behavior: "smooth" })
    control?.focus({ preventScroll: true })
  }

  function preview() {
    if (busy) return
    setValidationAttempted(true)
    const found = getSettingsIssues(settings)
    if (found.length) { locateIssue(found[0].path); return }
    setPublishError("")
    setPreviewOpen(true)
  }

  function publish() {
    if (busy) return
    if (unsaved) { setPublishError(locale === "zh" ? "请先保存草稿。" : "Save the draft first."); return }
    const found = getSettingsIssues(data.draft)
    setValidationAttempted(true)
    if (found.length) { setPublishError(""); locateIssue(found[0].path); return }
    setPublishError("")
    startPublishing(async () => {
      const result = await publishSiteSettings()
      if (!result.ok) { setPublishError(result.message); return }
      toast.success(locale === "zh" ? "整版设置已发布" : "Complete settings published")
      await loadSettings()
    })
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-52" /><Skeleton className="h-36" /><Skeleton className="h-36" /></div>

  let siteContent
  try { siteContent = parseSiteContentDraft(settings) } catch { siteContent = null }

  const fields = [
    { key: "conference_name", label: adminT.conferenceName[locale] },
    { key: "conference_date", label: adminT.conferenceDate[locale], placeholder: conference.settingDate },
    { key: "conference_location", label: adminT.locationEn[locale] },
    { key: "conference_location_zh", label: adminT.locationZh[locale] },
    { key: "register_url", label: adminT.registerUrl[locale], type: "url", placeholder: "https://..." },
    { key: "contact_email", label: adminT.contactEmail[locale], type: "email", placeholder: "faweizhao26@gmail.com" },
  ]
  const heroFields = [
    { key: "hero_title", label: adminT.heroTitleEn[locale] },
    { key: "hero_title_zh", label: adminT.heroTitleZh[locale] },
    { key: "hero_subtitle", label: adminT.heroSubtitleEn[locale] },
    { key: "hero_subtitle_zh", label: adminT.heroSubtitleZh[locale] },
  ]
  const cfpFields = [
    { key: "cfp_intro", label: locale === "zh" ? "征稿说明（英文）" : "CFP introduction (English)" },
    { key: "cfp_intro_zh", label: locale === "zh" ? "征稿说明（中文）" : "CFP introduction (Chinese)" },
    { key: "cfp_requirements", label: locale === "zh" ? "提交要求（英文）" : "Submission requirements (English)" },
    { key: "cfp_requirements_zh", label: locale === "zh" ? "提交要求（中文）" : "Submission requirements (Chinese)" },
    { key: "cfp_review_notes", label: locale === "zh" ? "审核及结果通知说明（英文）" : "Review and result notification notes (English)" },
    { key: "cfp_review_notes_zh", label: locale === "zh" ? "审核及结果通知说明（中文）" : "Review and result notification notes (Chinese)" },
  ]
  function changeOption(key: "cfp_types" | "cfp_durations", option: string | number, checked: boolean, options: readonly (string | number)[]) {
    setSettings(current => {
      const selected = selectedOptions(current[key], defaultCFPSettings[key], options)
      return { ...current, [key]: JSON.stringify(options.filter(value => value === option ? checked : selected.includes(value))) }
    })
  }

  return (
    <form noValidate onSubmit={saveSettings} className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{adminT.siteSettings[locale]}</h1>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={preview} disabled={busy || loadError}><Eye />{locale === "zh" ? "预览草稿" : "Preview draft"}</Button>
          <Button type="submit" variant="outline" disabled={busy || loadError}><Save />{saving ? adminT.saving[locale] : (locale === "zh" ? "保存草稿" : "Save draft")}</Button>
          {!mockMode && <Button type="button" onClick={publish} disabled={busy || loadError}><Send />{publishing ? (locale === "zh" ? "发布中" : "Publishing") : (locale === "zh" ? "发布整版设置" : "Publish complete settings")}</Button>}
        </div>
      </div>
      <div className="space-y-2 border-y py-4 text-sm text-muted-foreground">
        <p>{currentRelease ? `${locale === "zh" ? "当前公开版本" : "Current public release"}: v${currentRelease.version} · ${new Date(currentRelease.published_at).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}` : (locale === "zh" ? "尚未发布网站设置" : "No settings release yet")}</p>
        <Badge variant="outline">{unsaved ? (locale === "zh" ? "有未保存修改" : "Unsaved changes") : pending ? (locale === "zh" ? "草稿待发布" : "Draft pending publication") : (locale === "zh" ? "与公开版本一致" : "Matches public release")}</Badge>
        {uploads > 0 && <p role="status">{locale === "zh" ? "素材上传中" : "Uploading media"}</p>}
        {issues.length > 0 && <div role="alert" className="space-y-1 border-l-2 border-red-500 pl-3">{issues.map(issue => <button key={issue.path} type="button" className="block max-w-full break-words text-left text-red-700 underline underline-offset-4 dark:text-red-400" onClick={() => locateIssue(issue.path)}>{issue.label[locale]}: {issue.message[locale]}</button>)}</div>}
        {publishError && <p role="alert" className="text-red-700 dark:text-red-400">{publishError}</p>}
      </div>
      {loadError ? <div className="flex flex-wrap items-center gap-3 text-muted-foreground"><p>{locale === "zh" ? "设置加载失败" : "Unable to load settings"}</p><Button type="button" variant="outline" onClick={loadSettings}>{locale === "zh" ? "重试" : "Retry"}</Button></div> : <>
        <section className="space-y-5"><h2 className="text-lg font-semibold">{adminT.conferenceInfo[locale]}</h2><div className="grid gap-5 sm:grid-cols-2">{fields.map(({ key, label, type, placeholder }) => <div key={key} className="space-y-2"><Label htmlFor={`setting-${key}`}>{label}</Label><Input data-setting-path={key} aria-invalid={issues.some(issue => issue.path === key)} id={`setting-${key}`} type={type || "text"} value={settings[key] || ""} placeholder={placeholder} disabled={busy} onChange={(event) => setSettings((current) => ({ ...current, [key]: event.target.value }))} /></div>)}</div></section>
        <section className="space-y-5 border-t pt-6">
          <h2 className="text-lg font-semibold">{locale === "zh" ? "征稿设置" : "Call for proposals"}</h2>
          <fieldset disabled={busy} className="space-y-5 min-w-0">
            <div data-setting-path="cfp_enabled" className="flex items-center justify-between gap-4"><Label htmlFor="setting-cfp_enabled">{locale === "zh" ? "开放征稿" : "Accepting proposals"}</Label><Switch id="setting-cfp_enabled" checked={settings.cfp_enabled !== "false"} onCheckedChange={checked => setSettings(current => ({ ...current, cfp_enabled: String(checked) }))} /></div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="setting-cfp_deadline">{locale === "zh" ? "征稿截止日期（北京时间）" : "CFP deadline (Beijing time)"}</Label><Input data-setting-path="cfp_deadline" id="setting-cfp_deadline" type="date" value={settings.cfp_deadline || ""} onChange={event => setSettings(current => ({ ...current, cfp_deadline: event.target.value }))} /></div>
              <div className="space-y-2"><Label htmlFor="setting-cfp_contact_email">{locale === "zh" ? "投稿咨询邮箱" : "CFP contact email"}</Label><Input data-setting-path="cfp_contact_email" id="setting-cfp_contact_email" type="email" value={settings.cfp_contact_email || ""} placeholder={settings.contact_email || ""} onChange={event => setSettings(current => ({ ...current, cfp_contact_email: event.target.value }))} /></div>
            </div>
            <fieldset data-setting-path="cfp_types" className="space-y-3"><legend className="mb-3 text-sm font-medium">{locale === "zh" ? "允许的演讲类型" : "Allowed session types"}</legend><div className="flex flex-wrap gap-x-6 gap-y-3">{cfpSessionTypes.map(type => <label key={type} className="flex items-center gap-2 text-sm"><input type="checkbox" name="cfp_types" value={type} checked={selectedOptions(settings.cfp_types, defaultCFPSettings.cfp_types, cfpSessionTypes).includes(type)} onChange={event => changeOption("cfp_types", type, event.target.checked, cfpSessionTypes)} className="size-4 accent-emerald-600" />{cfpT[type][locale]}</label>)}</div></fieldset>
            <fieldset data-setting-path="cfp_durations" className="space-y-3"><legend className="mb-3 text-sm font-medium">{locale === "zh" ? "允许的演讲时长" : "Allowed session durations"}</legend><div className="flex flex-wrap gap-x-6 gap-y-3">{cfpDurations.map(duration => <label key={duration} className="flex items-center gap-2 text-sm"><input type="checkbox" name="cfp_durations" value={duration} checked={selectedOptions(settings.cfp_durations, defaultCFPSettings.cfp_durations, cfpDurations).includes(duration)} onChange={event => changeOption("cfp_durations", duration, event.target.checked, cfpDurations)} className="size-4 accent-emerald-600" />{duration} {locale === "zh" ? "分钟" : "min"}</label>)}</div></fieldset>
            <div className="grid gap-5 sm:grid-cols-2">{cfpFields.map(({ key, label }) => <div key={key} className="space-y-2"><Label htmlFor={`setting-${key}`}>{label}</Label><Textarea data-setting-path={key} aria-invalid={issues.some(issue => issue.path === key)} id={`setting-${key}`} value={settings[key] || ""} rows={4} maxLength={10000} onChange={event => setSettings(current => ({ ...current, [key]: event.target.value }))} /></div>)}</div>
          </fieldset>
        </section>
        <section className="space-y-5 border-t pt-6"><h2 className="text-lg font-semibold">{adminT.heroSection[locale]}</h2><div className="grid gap-5 sm:grid-cols-2">{heroFields.map(({ key, label }) => <div key={key} className="space-y-2"><Label htmlFor={`setting-${key}`}>{label}</Label><Input data-setting-path={key} aria-invalid={issues.some(issue => issue.path === key)} id={`setting-${key}`} value={settings[key] || ""} disabled={busy} onChange={(event) => setSettings((current) => ({ ...current, [key]: event.target.value }))} /></div>)}</div></section>
        <MediaUploadContext.Provider value={reportUpload}>{siteContent ? <SiteContentEditor value={siteContent} locale={locale} disabled={busy} onChange={content => setSettings(current => ({ ...current, site_content: JSON.stringify(content) }))} /> : <div data-setting-path="site_content" className="space-y-3 border-t pt-6"><p role="alert">{locale === "zh" ? "页面内容草稿无法解析。其他设置已保留。" : "Page content draft cannot be parsed. Other settings are retained."}</p><Button type="button" variant="outline" disabled={busy} onClick={() => setSettings(current => ({ ...current, site_content: JSON.stringify(parseSiteContent({})) }))}>{locale === "zh" ? "恢复默认页面内容" : "Restore default page content"}</Button></div>}</MediaUploadContext.Provider>
      </>}
      {data.releases.length > 0 && <fieldset disabled={busy || unsaved}><section className="border-t pt-6"><h2 className="mb-3 text-lg font-semibold">{locale === "zh" ? "发布历史" : "Release history"}</h2><div className="divide-y">{data.releases.map((release) => <div key={release.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="text-sm">v{release.version} · {new Date(release.published_at).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}{release.is_current && <Badge className="ml-2" variant="outline">{locale === "zh" ? "当前" : "Current"}</Badge>}</span>{!release.is_current && <PublicationActions id={release.id} kind="settings-release" locale={locale} onCompleted={loadSettings} />}</div>)}</div></section></fieldset>}
      <UnsavedSettingsGuard active={unsaved || uploads > 0} locale={locale} />
      <SettingsPreview open={previewOpen} onOpenChange={setPreviewOpen} settings={settings} locale={locale} />
    </form>
  )
}
