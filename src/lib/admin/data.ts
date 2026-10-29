import type { SupabaseClient } from "@supabase/supabase-js"
import type { ChannelCode, TicketType, Registration } from "../db/schema"
import type { GroupConfig } from "../group-tickets/types"

type Client = Pick<SupabaseClient, "from">
export type RegistrationRecord = Registration & { ticket_types: Pick<TicketType, "name" | "name_zh"> | null }
export type DashboardStats = { totalSessions: number; pending: number; approved: number; rejected: number; speakers: number; agendaSlots: number }

export async function loadDashboardStats(client: Client): Promise<DashboardStats> {
  const results = await Promise.all([
    client.from("sessions").select("*", { count: "exact", head: true }),
    client.from("sessions").select("*", { count: "exact", head: true }).eq("status", "pending"),
    client.from("sessions").select("*", { count: "exact", head: true }).eq("status", "approved"),
    client.from("sessions").select("*", { count: "exact", head: true }).eq("status", "rejected"),
    client.from("speakers").select("*", { count: "exact", head: true }),
    client.from("agenda_slots").select("*", { count: "exact", head: true }),
  ])
  const [totalSessions, pending, approved, rejected, speakers, agendaSlots] = results.map(result => {
    if (result.error) throw result.error
    if (result.count === null) throw new Error("load_failed")
    return result.count
  })
  return { totalSessions, pending, approved, rejected, speakers, agendaSlots }
}

export async function loadTicketWorkspace(client: Client): Promise<{ tickets: TicketType[]; channels: ChannelCode[]; configs: GroupConfig[] }> {
  const tickets = await client.from("ticket_types").select("*").order("sort_order")
  const channels = await client.from("channel_codes").select("*").order("created_at", { ascending: false })
  const configs = await client.from("group_ticket_configs").select("*")
  for (const result of [tickets, channels, configs]) if (result.error) throw result.error
  if (!tickets.data || !channels.data || !configs.data) throw new Error("load_failed")
  return { tickets: tickets.data, channels: channels.data, configs: configs.data }
}

async function savedId(query: PromiseLike<{ data: { id: string } | null; error: unknown }>): Promise<string> {
  const { data, error } = await query
  if (error) throw error
  if (!data?.id) throw new Error("not_saved")
  return data.id
}

type TicketFields = Pick<TicketType, "name" | "name_zh" | "description" | "description_zh" | "is_free" | "requires_code"> & Partial<Pick<TicketType, "is_active" | "sort_order">>
export function saveTicket(client: Client, fields: TicketFields, id?: string): Promise<string> {
  const query = id ? client.from("ticket_types").update(fields).eq("id", id)
    : client.from("ticket_types").insert({ sort_order: 99, ...fields })
  return savedId(query.select("id").single())
}

type ChannelFields = Pick<ChannelCode, "code" | "name" | "ticket_type_id"> & Partial<Pick<ChannelCode, "is_active">>
export function saveChannel(client: Client, fields: ChannelFields, id?: string): Promise<string> {
  const query = id ? client.from("channel_codes").update(fields).eq("id", id) : client.from("channel_codes").insert(fields)
  return savedId(query.select("id").single())
}

export function deleteTicketRecord(client: Client, id: string): Promise<string> {
  return savedId(client.from("ticket_types").delete().eq("id", id).select("id").single())
}

export function deleteChannelRecord(client: Client, id: string): Promise<string> {
  return savedId(client.from("channel_codes").delete().eq("id", id).select("id").single())
}

export async function loadRegistrationRecords(client: Client): Promise<RegistrationRecord[]> {
  const records: RegistrationRecord[] = []
  const pageSize = 1000
  const seen = new Set<string>()
  let boundary: string | undefined
  let cursor: Pick<RegistrationRecord, "created_at" | "id"> | undefined
  while (true) {
    let query = client.from("registrations")
      .select("*, ticket_types(name, name_zh)")
      .order("created_at", { ascending: false }).order("id")
      .limit(pageSize)
    if (boundary) query = query.lte("created_at", boundary)
    if (cursor) query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.gt.${cursor.id})`)
    const { data, error } = await query
    if (error) throw error
    if (!data) throw new Error("load_failed")
    if (!data.length) return records
    // Retain database timestamp precision; Date would round away microseconds at page boundaries.
    boundary ??= data[0].created_at
    for (const row of data) {
      if (!row.id || !row.created_at || seen.has(row.id)) throw new Error("registration_pagination_failed")
      seen.add(row.id)
    }
    records.push(...data)
    cursor = data[data.length - 1]
  }
}
