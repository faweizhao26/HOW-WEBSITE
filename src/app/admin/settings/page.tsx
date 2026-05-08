"use client"

import { isMockMode } from "@/lib/utils"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { admin as adminT } from "@/lib/i18n/translations"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

function getLocaleFromCookie(): "en" | "zh" {
  if (typeof document === "undefined") return "en"
  const match = document.cookie.match(/(?:^|;\s*)lang=([^;]*)/)
  return match?.[1] === "zh" ? "zh" : "en"
}

export default function AdminSettingsPage() {
  const [locale] = useState<"en" | "zh">(getLocaleFromCookie())
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const defaults: Record<string, string> = {
      conference_name: "HOW 2027",
      conference_date: "2027.4.26-4.28",
      conference_location: "Jinan, China",
      conference_location_zh: "中国·济南",
      cfp_deadline: "2027-02-27",
      register_url: "",
      contact_email: "conference@how2027.org",
      hero_title: "Linking the World with Open Source",
      hero_title_zh: "开源互联世界",
      hero_subtitle: "HOW2027: PostgreSQL Eco Conference",
      hero_subtitle_zh: "HOW2027：PostgreSQL 生态大会",
    }
    if (isMockMode()) { setSettings(defaults); setLoading(false); return }
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      const supabase = createClient()
      const { data } = await supabase.from("site_settings").select("*")
      const map: Record<string, string> = {
        conference_name: "HOW 2027", conference_date: "", conference_location: "Jinan, China",
        conference_location_zh: "中国·济南", cfp_deadline: "", register_url: "",
        contact_email: "conference@how2027.org", hero_title: "Linking the World with Open Source",
        hero_title_zh: "开源互联世界", hero_subtitle: "HOW2027: PostgreSQL Eco Conference",
        hero_subtitle_zh: "HOW2027：PostgreSQL 生态大会",
      }
      data?.forEach((s: any) => (map[s.key] = s.value))
      setSettings(map)
    } catch {}
    setLoading(false)
  }

  async function saveSettings() {
    if (isMockMode()) { toast.success(adminT.settingsSaved[locale]); return }
    setSaving(true)
    try {
      const supabase = createClient()
      const entries = Object.entries(settings).map(([key, value]) => ({ key, value }))
      await supabase.from("site_settings").upsert(entries)
      toast.success(adminT.settingsSaved[locale])
    } catch {}
    setSaving(false)
  }

  if (loading) return <div><h1 className="text-2xl font-bold mb-8">{adminT.siteSettings[locale]}</h1><div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-12 bg-zinc-800" />)}</div></div>

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">{adminT.siteSettings[locale]}</h1>
        <Button onClick={saveSettings} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500">{saving ? adminT.saving[locale] : adminT.saveSettings[locale]}</Button>
      </div>
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader><CardTitle>{adminT.conferenceInfo[locale]}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "conference_name", label: adminT.conferenceName[locale] },
            { key: "conference_date", label: adminT.conferenceDate[locale], placeholder: "2027.4.26-4.28" },
            { key: "conference_location", label: adminT.locationEn[locale] },
            { key: "conference_location_zh", label: adminT.locationZh[locale] },
            { key: "cfp_deadline", label: adminT.cfpDeadline[locale], type: "date" },
            { key: "register_url", label: adminT.registerUrl[locale], placeholder: "https://..." },
            { key: "contact_email", label: adminT.contactEmail[locale] },
          ].map(({ key, label, type, placeholder }) => (
            <div key={key} className="space-y-2">
              <Label>{label}</Label>
              <Input type={type || "text"} value={settings[key] || ""} placeholder={placeholder}
                onChange={(e) => setSettings(p => ({ ...p, [key]: e.target.value }))} />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="bg-zinc-900/50 border-zinc-800 mt-6">
        <CardHeader><CardTitle>{adminT.heroSection[locale]}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "hero_title", label: adminT.heroTitleEn[locale] },
            { key: "hero_title_zh", label: adminT.heroTitleZh[locale] },
            { key: "hero_subtitle", label: adminT.heroSubtitleEn[locale] },
            { key: "hero_subtitle_zh", label: adminT.heroSubtitleZh[locale] },
          ].map(({ key, label }) => (
            <div key={key} className="space-y-2">
              <Label>{label}</Label>
              <Input value={settings[key] || ""} onChange={(e) => setSettings(p => ({ ...p, [key]: e.target.value }))} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
