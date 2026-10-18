import type { SupabaseClient } from "@supabase/supabase-js"

export class SettingsDraftConflictError extends Error {
  constructor() { super("settings_draft_conflict"); this.name = "SettingsDraftConflictError" }
}

export async function saveSettingsDraft(
  client: Pick<SupabaseClient, "rpc">,
  baseline: Record<string, string>,
  local: Record<string, string>,
): Promise<Record<string, string>> {
  const draft = Object.fromEntries(Object.entries(local).map(([key, value]) => [key, value.trim()]))
  const { data, error } = await client.rpc("save_site_settings_draft", { p_expected: baseline, p_draft: draft })
  if (error?.code === "PT409") throw new SettingsDraftConflictError()
  if (error) throw error
  if (!data || Array.isArray(data) || typeof data !== "object"
    || Object.keys(data).length !== Object.keys(draft).length
    || Object.entries(data).some(([key, value]) => typeof value !== "string" || draft[key] !== value)) {
    throw new Error("settings_draft_not_saved")
  }
  return data as Record<string, string>
}
