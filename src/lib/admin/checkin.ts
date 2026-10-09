import type { SupabaseClient } from "@supabase/supabase-js"
import type { Registration } from "../db/schema"
import type { RegistrationRecord } from "./data"

type Client = Pick<SupabaseClient, "from">
export type CheckinStats = { total: number; checkedIn: number }

export async function loadCheckinStats(client: Client): Promise<CheckinStats> {
  const results = await Promise.all([
    client.from("registrations").select("*", { count: "exact", head: true }),
    client.from("registrations").select("*", { count: "exact", head: true }).eq("checked_in", true),
  ])
  const [total, checkedIn] = results.map(result => {
    if (result.error) throw result.error
    if (result.count === null) throw new Error("load_failed")
    return result.count
  })
  return { total, checkedIn }
}

export async function searchCheckinRecords(client: Client, query: string, signal?: AbortSignal): Promise<RegistrationRecord[]> {
  const text = query.trim()
  if (text.length < 2) return []
  const pattern = JSON.stringify(`%${text.replace(/[\\%_]/g, "\\$&")}%`)
  const request = client.from("registrations").select("*, ticket_types(name, name_zh)")
    .or(["name", "email", "phone"].map(field => `${field}.ilike.${pattern}`).join(","))
    .order("checked_in", { ascending: true }).order("created_at", { ascending: false }).limit(20)
  const { data, error } = await (signal ? request.abortSignal(signal) : request)
  if (error) throw error
  if (!data) throw new Error("load_failed")
  return data
}

export async function updateCheckin(client: Client, registration: Pick<Registration, "id" | "checked_in">): Promise<Pick<Registration, "id" | "checked_in" | "checked_in_at">> {
  const next = !registration.checked_in
  let request = client.from("registrations")
    .update({ checked_in: next, checked_in_at: next ? new Date().toISOString() : null })
    .eq("id", registration.id).eq("checked_in", registration.checked_in)
  if (next) request = request.eq("status", "confirmed")
  const { data, error } = await request.select("id,checked_in,checked_in_at").single()
  if (error) throw error
  if (!data?.id || data.checked_in !== next) throw new Error("not_saved")
  return data
}
