import type { PublishedSiteSettings } from "@/lib/db/schema"

export const defaultSiteSettings: PublishedSiteSettings = {
  conference_name: "HOW 2027",
  conference_date: "2027.4.16-4.18",
  conference_location: "Jinan, China",
  conference_location_zh: "中国·济南",
  contact_email: "faweizhao26@gmail.com",
  hero_title: "Linking the World with Open Source",
  hero_title_zh: "开源互联世界",
  hero_subtitle: "HOW2027: PostgreSQL Eco Conference",
  hero_subtitle_zh: "HOW2027：PostgreSQL 生态大会",
}

export const requiredSettingsKeys = Object.keys(defaultSiteSettings)

export function validateSettingsDraft(settings: Record<string, string>): "required" | "date" | null {
  if (requiredSettingsKeys.some((key) => !settings[key]?.trim())) return "required"
  if (!/^2027([.-])4([.-])16-4([.-])18$/.test(settings.conference_date)) return "date"
  return null
}

export function hasSettingsChanges(draft: Record<string, string>, published: Record<string, string> | null): boolean {
  if (!published) return true
  const keys = new Set([...Object.keys(draft), ...Object.keys(published)])
  return [...keys].some((key) => (draft[key] ?? "") !== (published[key] ?? ""))
}
