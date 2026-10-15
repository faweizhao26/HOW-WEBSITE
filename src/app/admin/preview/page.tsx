import { cookies } from "next/headers"
import { notFound } from "next/navigation"
import { requireAdmin } from "@/lib/auth/require-admin"
import { createServerSupabase } from "@/lib/supabase/server"
import { getPublishedSessions, getPublishedSponsors } from "@/lib/content/public"
import { getLocale } from "@/lib/i18n/utils"
import { SettingsPreviewFrame } from "@/components/admin/settings-preview-frame"

export default async function AdminPreviewPage() {
  try { await requireAdmin() } catch { notFound() }
  const supabase = await createServerSupabase()
  const [saved, sessions, sponsors, cookieStore] = await Promise.all([
    supabase.from("site_settings").select("key,value"),
    getPublishedSessions(),
    getPublishedSponsors(),
    cookies(),
  ])
  const settings: Record<string, string> | null = saved.error || !saved.data ? null
    : Object.fromEntries(saved.data.map(row => [row.key, row.value]))
  return <SettingsPreviewFrame settings={settings} locale={getLocale(cookieStore.get("lang")?.value)} theme={cookieStore.get("theme")?.value === "light" ? "light" : "dark"} sessions={sessions} sponsors={sponsors} />
}
