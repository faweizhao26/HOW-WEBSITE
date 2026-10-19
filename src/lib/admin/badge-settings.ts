import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"

export const badgePrintSchema = z.object({
  widthMm: z.number().min(40).max(150),
  heightMm: z.number().min(25).max(150),
  paddingMm: z.number().min(0).max(8),
  style: z.enum(["mono", "color"]),
  showConference: z.boolean(),
  showCompany: z.boolean(),
  showTicket: z.boolean(),
}).strict().refine(value => value.widthMm - 2 * value.paddingMm >= 30 && value.heightMm - 2 * value.paddingMm >= 17)

export type BadgePrintConfig = z.infer<typeof badgePrintSchema>
export const defaultBadgePrintConfig: BadgePrintConfig = {
  widthMm: 90, heightMm: 55, paddingMm: 4, style: "color",
  showConference: true, showCompany: true, showTicket: true,
}

export function parseBadgePrintSettings(settings: Record<string, string>): BadgePrintConfig {
  if (!settings.badge_print?.trim()) return { ...defaultBadgePrintConfig }
  return badgePrintSchema.parse(JSON.parse(settings.badge_print))
}

export async function loadBadgePrintSettings(client: Pick<SupabaseClient, "from">): Promise<Record<string, string>> {
  const { data, error } = await client.from("site_settings_releases").select("payload").eq("is_current", true).maybeSingle()
  if (error) throw error
  if (!data) return {}
  const settings = z.record(z.string(), z.string()).parse(data.payload)
  parseBadgePrintSettings(settings)
  return settings
}
